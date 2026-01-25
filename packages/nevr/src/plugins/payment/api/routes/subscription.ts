// =============================================================================
// PAYMENT SUBSCRIPTION ROUTES
// Subscription management endpoints: upgrade, cancel, restore, list
// =============================================================================

import { endpoint, z, EndpointError, requireAuth } from "../../../unified/endpoint.js"
import type { EndpointContext } from "../../../unified/endpoint.js"
import { createPaymentAdapter, getUserStripeCustomerId, updateUserStripeCustomerId } from "../internal-adapter.js"
import { getLogger } from "../../../../logger.js"
import type {
    PaymentRouteConfig,
    SubscriptionOptions,
} from "../../types.js"
import {
    SUBSCRIPTION_ERROR_CODES,
    getUrl,
    getPlanByName,
    createReferenceMiddleware,
} from "./helpers.js"

// =============================================================================
// UPGRADE SUBSCRIPTION
// =============================================================================

export function upgradeSubscription(config: PaymentRouteConfig) {
    const subscriptionOptions = config.options.subscription && "enabled" in config.options.subscription && config.options.subscription.enabled
        ? config.options.subscription as SubscriptionOptions
        : undefined

    return endpoint("/subscription/upgrade", {
        method: "POST",
        body: z.object({
            plan: z.string(),
            annual: z.boolean().optional(),
            referenceId: z.string().optional(),
            subscriptionId: z.string().optional(),
            metadata: z.record(z.string(), z.any()).optional(),
            seats: z.number().optional(),
            successUrl: z.string().default("/"),
            cancelUrl: z.string().default("/"),
            returnUrl: z.string().optional(),
            disableRedirect: z.boolean().default(false),
        }),
        use: [
            requireAuth,
            createReferenceMiddleware(subscriptionOptions, "upgrade-subscription"),
        ],
        meta: {
            summary: "Upgrade subscription",
            description: "Create or upgrade a subscription to a new plan",
            tags: ["Payment", "Subscription"],
        },
        handler: async (ctx) => {
            const { user, driver, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = createPaymentAdapter(driver)
            const provider = config.getProvider()
            const baseURL = (ctx as any).context?.options?.baseURL || ""

            // Check email verification if required
            if (subscriptionOptions?.requireEmailVerification && !(user as any).emailVerified) {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
                })
            }

            const referenceId = body.referenceId || user.id

            // Get plan
            const plan = await getPlanByName(config, body.plan)
            if (!plan) {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
                })
            }

            // Find existing subscription
            let subscriptionToUpdate = body.subscriptionId
                ? await adapter.findSubscriptionById(body.subscriptionId)
                || await adapter.findSubscriptionByProviderId(body.subscriptionId)
                : await adapter.findActiveSubscription(referenceId)

            // Validate subscription belongs to referenceId
            if (body.subscriptionId && subscriptionToUpdate && subscriptionToUpdate.referenceId !== referenceId) {
                subscriptionToUpdate = null
            }

            if (body.subscriptionId && !subscriptionToUpdate) {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
                })
            }

            // Get or create customer
            let customerId = subscriptionToUpdate?.stripeCustomerId || (user as any).stripeCustomerId

            if (!customerId) {
                const userEmail = user.email || (user as any).email
                if (!userEmail) {
                    throw new EndpointError("BAD_REQUEST", {
                        message: "User email is required for subscription",
                    })
                }

                try {
                    const existingCustomers = await provider.listCustomersByEmail(userEmail)
                    let customer = existingCustomers[0]

                    if (!customer) {
                        customer = await provider.createCustomer({
                            email: userEmail,
                            name: (user as any).name,
                            metadata: { userId: user.id, ...body.metadata },
                        })
                    }

                    await updateUserStripeCustomerId(driver, user.id, customer.id)
                    customerId = customer.id
                } catch (e: any) {
                    getLogger().error(`Failed to create customer: ${e.message}`)
                    throw new EndpointError("BAD_REQUEST", {
                        message: SUBSCRIPTION_ERROR_CODES.UNABLE_TO_CREATE_CUSTOMER,
                    })
                }
            }

            // Get all subscriptions for this reference
            const subscriptions = subscriptionToUpdate
                ? [subscriptionToUpdate]
                : await adapter.findSubscriptionsByReferenceId(referenceId)

            const activeOrTrialingSubscription = subscriptions.find(
                sub => sub.status === "active" || sub.status === "trialing"
            )

            // Check if already on same plan
            if (
                activeOrTrialingSubscription &&
                activeOrTrialingSubscription.status === "active" &&
                activeOrTrialingSubscription.plan === body.plan &&
                activeOrTrialingSubscription.seats === (body.seats || 1)
            ) {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.ALREADY_SUBSCRIBED_PLAN,
                })
            }

            // Check for active subscription in provider
            const activeProviderSubscriptions = await provider.listSubscriptions(customerId)
            const activeProviderSub = activeProviderSubscriptions.find(sub => {
                if (subscriptionToUpdate?.stripeSubscriptionId) {
                    return sub.id === subscriptionToUpdate.stripeSubscriptionId
                }
                if (activeOrTrialingSubscription?.stripeSubscriptionId) {
                    return sub.id === activeOrTrialingSubscription.stripeSubscriptionId
                }
                return sub.status === "active" || sub.status === "trialing"
            })

            // If active subscription exists, upgrade via billing portal
            if (activeProviderSub && customerId) {
                let priceIdToUse = body.annual ? plan.annualPriceId : plan.priceId

                if (!priceIdToUse) {
                    const lookupKey = body.annual ? plan.annualLookupKey : plan.lookupKey
                    if (lookupKey) {
                        priceIdToUse = await provider.resolvePriceId(lookupKey)
                    }
                }

                if (!priceIdToUse) {
                    throw new EndpointError("BAD_REQUEST", {
                        message: "Price ID not found for the selected plan",
                    })
                }

                const portal = await provider.createBillingPortalSession({
                    customerId,
                    returnUrl: getUrl(ctx, baseURL, body.returnUrl || "/"),
                    flowData: {
                        type: "subscription_update_confirm",
                        subscriptionUpdateConfirm: {
                            subscription: activeProviderSub.id,
                            items: [{
                                id: activeProviderSub.items[0]?.id || "",
                                price: priceIdToUse,
                                quantity: body.seats || 1,
                            }],
                        },
                        afterCompletion: {
                            type: "redirect",
                            redirect: { returnUrl: getUrl(ctx, baseURL, body.returnUrl || "/") },
                        },
                    },
                })

                return ctx.json({ url: portal.url, redirect: true })
            }

            // Find or create incomplete subscription
            const incompleteSubscription = subscriptions.find(sub => sub.status === "incomplete")
            let subscription = activeOrTrialingSubscription || incompleteSubscription

            if (incompleteSubscription && !activeOrTrialingSubscription) {
                subscription = await adapter.updateSubscription(incompleteSubscription.id, {
                    plan: plan.name.toLowerCase(),
                    seats: body.seats || 1,
                }) || incompleteSubscription
            }

            if (!subscription) {
                subscription = await adapter.createSubscription({
                    plan: plan.name.toLowerCase(),
                    stripeCustomerId: customerId,
                    status: "incomplete",
                    referenceId,
                    seats: body.seats || 1,
                    cancelAtPeriodEnd: false,
                })
            }

            // Check if user ever had a trial
            const hasEverTrialed = subscriptions.some(s =>
                !!(s.trialStart || s.trialEnd) || s.status === "trialing"
            )

            const trialPeriodDays = !hasEverTrialed && plan.freeTrial
                ? plan.freeTrial.days
                : undefined

            // Resolve price ID
            let priceIdToUse = body.annual ? plan.annualPriceId : plan.priceId
            if (!priceIdToUse) {
                const lookupKey = body.annual ? plan.annualLookupKey : plan.lookupKey
                if (lookupKey) {
                    priceIdToUse = await provider.resolvePriceId(lookupKey)
                }
            }

            if (!priceIdToUse) {
                throw new EndpointError("BAD_REQUEST", {
                    message: "Price ID not found for the selected plan",
                })
            }

            // Get custom checkout params
            const customParams = subscriptionOptions?.getCheckoutSessionParams
                ? await subscriptionOptions.getCheckoutSessionParams(
                    { user, session: (ctx as any).session, plan, subscription },
                    ctx as any
                )
                : undefined

            // Create checkout session
            const successUrl = getUrl(
                ctx,
                baseURL,
                `/api/payment/subscription/success?callbackURL=${encodeURIComponent(body.successUrl)}&subscriptionId=${encodeURIComponent(subscription.id)}`
            )

            const checkoutSession = await provider.createCheckoutSession({
                customerId,
                mode: "subscription",
                lineItems: [{ price: priceIdToUse, quantity: body.seats || 1 }],
                successUrl,
                cancelUrl: getUrl(ctx, baseURL, body.cancelUrl),
                trialPeriodDays,
                clientReferenceId: referenceId,
                metadata: {
                    userId: user.id,
                    subscriptionId: subscription.id,
                    referenceId,
                },
                customerUpdate: { name: "auto", address: "auto" },
            })

            return ctx.json({
                ...checkoutSession,
                redirect: !body.disableRedirect,
            })
        },
    })
}

// =============================================================================
// CANCEL SUBSCRIPTION
// =============================================================================

export function cancelSubscription(config: PaymentRouteConfig) {
    const subscriptionOptions = config.options.subscription && "enabled" in config.options.subscription && config.options.subscription.enabled
        ? config.options.subscription as SubscriptionOptions
        : undefined

    return endpoint("/subscription/cancel", {
        method: "POST",
        body: z.object({
            referenceId: z.string().optional(),
            subscriptionId: z.string().optional(),
            returnUrl: z.string(),
        }),
        use: [
            requireAuth,
            createReferenceMiddleware(subscriptionOptions, "cancel-subscription"),
        ],
        meta: {
            summary: "Cancel subscription",
            description: "Cancel an active subscription via billing portal",
            tags: ["Payment", "Subscription"],
        },
        handler: async (ctx) => {
            const { user, driver, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = createPaymentAdapter(driver)
            const provider = config.getProvider()
            const baseURL = (ctx as any).context?.options?.baseURL || ""

            const referenceId = body.referenceId || user.id

            // Find subscription
            let subscription = body.subscriptionId
                ? await adapter.findSubscriptionById(body.subscriptionId)
                : await adapter.findActiveSubscription(referenceId)

            if (body.subscriptionId && subscription && subscription.referenceId !== referenceId) {
                subscription = null
            }

            if (!subscription || !subscription.stripeCustomerId) {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
                })
            }

            // Get active subscriptions from provider
            const activeSubscriptions = await provider.listSubscriptions(subscription.stripeCustomerId)
            const activeProviderSub = activeSubscriptions.find(
                sub => sub.id === subscription!.stripeSubscriptionId &&
                    (sub.status === "active" || sub.status === "trialing")
            )

            if (!activeProviderSub) {
                // Clean up stale subscription data
                await adapter.deleteSubscriptionsByReferenceId(referenceId)
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
                })
            }

            // Create billing portal session for cancellation
            const callbackUrl = `/api/payment/subscription/cancel/callback?callbackURL=${encodeURIComponent(body.returnUrl)}&subscriptionId=${encodeURIComponent(subscription.id)}`

            const portal = await provider.createBillingPortalSession({
                customerId: subscription.stripeCustomerId,
                returnUrl: getUrl(ctx, baseURL, callbackUrl),
                flowData: {
                    type: "subscription_cancel",
                    subscriptionCancel: { subscription: activeProviderSub.id },
                },
            })

            return ctx.json({ url: portal.url, redirect: true })
        },
    })
}

// =============================================================================
// CANCEL SUBSCRIPTION CALLBACK
// =============================================================================

export function cancelSubscriptionCallback(config: PaymentRouteConfig) {
    const subscriptionOptions = config.options.subscription && "enabled" in config.options.subscription && config.options.subscription.enabled
        ? config.options.subscription as SubscriptionOptions
        : undefined

    return endpoint("/subscription/cancel/callback", {
        method: "GET",
        query: z.object({
            callbackURL: z.string().optional(),
            subscriptionId: z.string().optional(),
        }).optional(),
        meta: {
            summary: "Cancel subscription callback",
            description: "Handle redirect after subscription cancellation",
            tags: ["Payment", "Subscription"],
        },
        handler: async (ctx) => {
            const { user, driver, query } = ctx
            const baseURL = (ctx as any).context?.options?.baseURL || ""

            if (!query?.callbackURL || !query?.subscriptionId) {
                return ctx.redirect(getUrl(ctx, baseURL, query?.callbackURL || "/"))
            }

            if (!user || !(user as any).stripeCustomerId) {
                return ctx.redirect(getUrl(ctx, baseURL, query.callbackURL))
            }

            const adapter = createPaymentAdapter(driver)
            const provider = config.getProvider()

            try {
                const subscription = await adapter.findSubscriptionById(query.subscriptionId)

                if (!subscription || subscription.cancelAtPeriodEnd || subscription.status === "canceled") {
                    return ctx.redirect(getUrl(ctx, baseURL, query.callbackURL))
                }

                const providerSubscriptions = await provider.listSubscriptions(
                    (user as any).stripeCustomerId,
                    "active"
                )
                const currentSub = providerSubscriptions.find(
                    sub => sub.id === subscription.stripeSubscriptionId
                )

                if (currentSub?.cancelAtPeriodEnd) {
                    await adapter.updateSubscription(subscription.id, {
                        status: currentSub.status,
                        cancelAtPeriodEnd: true,
                    })

                    await subscriptionOptions?.onSubscriptionCancel?.({
                        subscription,
                        providerSubscription: currentSub,
                        cancellationDetails: currentSub.cancellationDetails,
                    })
                }
            } catch (error) {
                getLogger().error("Error checking subscription status", error)
            }

            return ctx.redirect(getUrl(ctx, baseURL, query.callbackURL))
        },
    })
}

// =============================================================================
// RESTORE SUBSCRIPTION
// =============================================================================

export function restoreSubscription(config: PaymentRouteConfig) {
    const subscriptionOptions = config.options.subscription && "enabled" in config.options.subscription && config.options.subscription.enabled
        ? config.options.subscription as SubscriptionOptions
        : undefined

    return endpoint("/subscription/restore", {
        method: "POST",
        body: z.object({
            referenceId: z.string().optional(),
            subscriptionId: z.string().optional(),
        }),
        use: [
            requireAuth,
            createReferenceMiddleware(subscriptionOptions, "restore-subscription"),
        ],
        meta: {
            summary: "Restore subscription",
            description: "Restore a subscription scheduled for cancellation",
            tags: ["Payment", "Subscription"],
        },
        handler: async (ctx) => {
            const { user, driver, body } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = createPaymentAdapter(driver)
            const provider = config.getProvider()

            const referenceId = body.referenceId || user.id

            // Find subscription
            let subscription = body.subscriptionId
                ? await adapter.findSubscriptionById(body.subscriptionId)
                : await adapter.findActiveSubscription(referenceId)

            if (body.subscriptionId && subscription && subscription.referenceId !== referenceId) {
                subscription = null
            }

            if (!subscription || !subscription.stripeCustomerId) {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
                })
            }

            if (subscription.status !== "active" && subscription.status !== "trialing") {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_NOT_ACTIVE,
                })
            }

            if (!subscription.cancelAtPeriodEnd) {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION,
                })
            }

            // Get active subscription from provider
            const providerSubscriptions = await provider.listSubscriptions(subscription.stripeCustomerId)
            const activeProviderSub = providerSubscriptions.find(
                sub => sub.status === "active" || sub.status === "trialing"
            )

            if (!activeProviderSub) {
                throw new EndpointError("BAD_REQUEST", {
                    message: SUBSCRIPTION_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
                })
            }

            // Update subscription to not cancel
            const updatedSub = await provider.updateSubscription(activeProviderSub.id, {
                cancelAtPeriodEnd: false,
            })

            await adapter.updateSubscription(subscription.id, {
                cancelAtPeriodEnd: false,
            })

            return ctx.json(updatedSub)
        },
    })
}

// =============================================================================
// LIST ACTIVE SUBSCRIPTIONS
// =============================================================================

export function listActiveSubscriptions(config: PaymentRouteConfig) {
    const subscriptionOptions = config.options.subscription && "enabled" in config.options.subscription && config.options.subscription.enabled
        ? config.options.subscription as SubscriptionOptions
        : undefined

    return endpoint("/subscription/list", {
        method: "GET",
        query: z.object({
            referenceId: z.string().optional(),
        }).optional(),
        use: [
            requireAuth,
            createReferenceMiddleware(subscriptionOptions, "list-subscription"),
        ],
        meta: {
            summary: "List active subscriptions",
            description: "List all active subscriptions for a user or reference",
            tags: ["Payment", "Subscription"],
        },
        handler: async (ctx) => {
            const { user, driver, query } = ctx
            if (!user) throw new EndpointError("UNAUTHORIZED")

            const adapter = createPaymentAdapter(driver)

            const referenceId = query?.referenceId || user.id

            const subscriptions = await adapter.findSubscriptionsByReferenceId(referenceId)

            if (!subscriptions.length) {
                return ctx.json([])
            }

            const plans = await config.getPlans()

            const activeSubs = subscriptions
                .filter(sub => sub.status === "active" || sub.status === "trialing")
                .map(sub => {
                    const plan = plans.find(p => p.name.toLowerCase() === sub.plan.toLowerCase())
                    return {
                        ...sub,
                        limits: plan?.limits,
                        priceId: plan?.priceId,
                    }
                })

            return ctx.json(activeSubs)
        },
    })
}
