// =============================================================================
// PAYMENT BILLING ROUTES
// Billing portal and success callback endpoints
// =============================================================================

import { endpoint, z, EndpointError, requireAuth } from "../../../unified/endpoint.js"
import { createPaymentAdapter } from "../internal-adapter.js"
import { getLogger } from "../../../../logger.js"
import type {
    PaymentRouteConfig,
    SubscriptionOptions,
} from "../../types.js"
import {
    SUBSCRIPTION_ERROR_CODES,
    getUrl,
    getPlanByPriceInfo,
    createReferenceMiddleware,
} from "./helpers.js"

// =============================================================================
// SUBSCRIPTION SUCCESS
// =============================================================================

export function subscriptionSuccess(config: PaymentRouteConfig) {
    return endpoint("/subscription/success", {
        method: "GET",
        query: z.object({
            callbackURL: z.string().optional(),
            subscriptionId: z.string().optional(),
        }).optional(),
        meta: {
            summary: "Subscription success callback",
            description: "Handle redirect after successful subscription checkout",
            tags: ["Payment", "Subscription"],
        },
        handler: async (ctx) => {
            const { user, driver, query } = ctx
            const baseURL = (ctx as any).context?.options?.baseURL || ""

            if (!query?.callbackURL || !query?.subscriptionId) {
                return ctx.redirect(getUrl(ctx, baseURL, query?.callbackURL || "/"))
            }

            if (!user) {
                return ctx.redirect(getUrl(ctx, baseURL, query.callbackURL))
            }

            const adapter = createPaymentAdapter(driver)
            const provider = config.getProvider()

            const subscription = await adapter.findSubscriptionById(query.subscriptionId)

            if (subscription?.status === "active" || subscription?.status === "trialing") {
                return ctx.redirect(getUrl(ctx, baseURL, query.callbackURL))
            }

            const customerId = subscription?.stripeCustomerId || (user as any).stripeCustomerId

            if (customerId) {
                try {
                    const providerSubscriptions = await provider.listSubscriptions(customerId, "active")
                    const providerSub = providerSubscriptions[0]

                    if (providerSub && subscription) {
                        const plan = await getPlanByPriceInfo(
                            config,
                            providerSub.items[0]?.price.id || "",
                            providerSub.items[0]?.price.lookupKey
                        )

                        if (plan) {
                            await adapter.updateSubscription(subscription.id, {
                                status: providerSub.status,
                                seats: providerSub.items[0]?.quantity || 1,
                                plan: plan.name.toLowerCase(),
                                periodEnd: new Date(providerSub.currentPeriodEnd * 1000),
                                periodStart: new Date(providerSub.currentPeriodStart * 1000),
                                stripeSubscriptionId: providerSub.id,
                                ...(providerSub.trialStart && providerSub.trialEnd ? {
                                    trialStart: new Date(providerSub.trialStart * 1000),
                                    trialEnd: new Date(providerSub.trialEnd * 1000),
                                } : {}),
                            })
                        }
                    }
                } catch (error) {
                    getLogger().error("Error fetching subscription from provider", error)
                }
            }

            return ctx.redirect(getUrl(ctx, baseURL, query.callbackURL))
        },
    })
}

// =============================================================================
// CREATE BILLING PORTAL
// =============================================================================

export function createBillingPortal(config: PaymentRouteConfig) {
    const subscriptionOptions = config.options.subscription && "enabled" in config.options.subscription && config.options.subscription.enabled
        ? config.options.subscription as SubscriptionOptions
        : undefined

    return endpoint("/subscription/billing-portal", {
        method: "POST",
        body: z.object({
            locale: z.string().optional(),
            referenceId: z.string().optional(),
            returnUrl: z.string().default("/"),
        }),
        use: [
            requireAuth,
            createReferenceMiddleware(subscriptionOptions, "billing-portal"),
        ],
        meta: {
            summary: "Create billing portal",
            description: "Open Stripe billing portal for subscription management",
            tags: ["Payment", "Subscription"],
        },
        handler: async (ctx) => {
            const { user, driver, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = createPaymentAdapter(driver)
            const provider = config.getProvider()
            const baseURL = (ctx as any).context?.options?.baseURL || ""

            const referenceId = body.referenceId || user.id

            let customerId = (user as any).stripeCustomerId

            if (!customerId) {
                const subscription = await adapter.findActiveSubscription(referenceId)
                customerId = subscription?.stripeCustomerId
            }

            if (!customerId) {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.NO_STRIPE_CUSTOMER,
                })
            }

            const portal = await provider.createBillingPortalSession({
                customerId,
                returnUrl: getUrl(ctx, baseURL, body.returnUrl),
                locale: body.locale,
            })

            return ctx.json({ url: portal.url, redirect: true })
        },
    })
}
