// =============================================================================
// STRIPE WEBHOOK ROUTE
// Handle Stripe webhook events for subscription lifecycle
// =============================================================================

import { endpoint, EndpointError } from "../../../unified/endpoint.js"
import { createPaymentAdapter } from "../internal-adapter.js"
import { getLogger } from "../../../../logger.js"
import type {
    PaymentRouteConfig,
    SubscriptionOptions,
    WebhookEvent,
} from "../../types.js"
import {
    SUBSCRIPTION_ERROR_CODES,
    getPlanByPriceInfo,
} from "./helpers.js"

// =============================================================================
// STRIPE WEBHOOK
// =============================================================================

export function stripeWebhook(config: PaymentRouteConfig) {
    const subscriptionOptions = config.options.subscription && "enabled" in config.options.subscription && config.options.subscription.enabled
        ? config.options.subscription as SubscriptionOptions
        : undefined

    return endpoint("/stripe/webhook", {
        method: "POST",
        meta: {
            summary: "Stripe webhook",
            description: "Handle Stripe webhook events",
            tags: ["Payment", "Webhook"],
        },
        handler: async (ctx) => {
            const { driver, request } = ctx

            const provider = config.getProvider()
            const webhookSecret = config.options.stripe?.webhookSecret

            if (!webhookSecret) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: SUBSCRIPTION_ERROR_CODES.WEBHOOK_SECRET_NOT_FOUND,
                })
            }

            // Get raw body and signature from request
            let rawBody: string
            const nativeRequest = request.native as Request | undefined

            if (nativeRequest && typeof nativeRequest.text === "function") {
                rawBody = await nativeRequest.text()
            } else if (typeof request.body === "string") {
                rawBody = request.body
            } else {
                rawBody = JSON.stringify(request.body)
            }

            const signature = request.headers["stripe-signature"]

            if (!signature) {
                throw new EndpointError("BAD_REQUEST", {
                    message: "Missing stripe-signature header",
                })
            }

            let event: WebhookEvent

            try {
                event = await provider.constructWebhookEvent(rawBody, signature, webhookSecret)
            } catch (err: any) {
                getLogger().error(`Webhook signature verification failed: ${err.message}`)
                throw new EndpointError("BAD_REQUEST", {
                    message: `Webhook Error: ${err.message}`,
                })
            }

            const adapter = createPaymentAdapter(driver)

            try {
                switch (event.type) {
                    case "checkout.session.completed":
                        await handleCheckoutSessionCompleted(config, adapter, event, subscriptionOptions)
                        break

                    case "customer.subscription.updated":
                        await handleSubscriptionUpdated(config, adapter, event, subscriptionOptions)
                        break

                    case "customer.subscription.deleted":
                        await handleSubscriptionDeleted(config, adapter, event, subscriptionOptions)
                        break

                    default:
                        await config.options.onEvent?.(event)
                        break
                }
            } catch (e: any) {
                getLogger().error(`Stripe webhook failed: ${e.message}`)
                throw new EndpointError("BAD_REQUEST", {
                    message: "Webhook error: See server logs for more information.",
                })
            }

            return ctx.json({ success: true })
        },
    })
}

// =============================================================================
// WEBHOOK HANDLERS
// =============================================================================

async function handleCheckoutSessionCompleted(
    config: PaymentRouteConfig,
    adapter: ReturnType<typeof createPaymentAdapter>,
    event: WebhookEvent,
    subscriptionOptions?: SubscriptionOptions
) {
    const provider = config.getProvider()
    const checkoutSession = event.data.object as any

    if (checkoutSession.mode === "setup" || !subscriptionOptions) {
        return
    }

    const providerSub = await provider.getSubscription(checkoutSession.subscription)
    if (!providerSub) return

    const priceId = providerSub.items[0]?.price.id
    const lookupKey = providerSub.items[0]?.price.lookupKey

    const plan = await getPlanByPriceInfo(config, priceId || "", lookupKey)
    if (!plan) return

    const referenceId = checkoutSession.client_reference_id || checkoutSession.metadata?.referenceId
    const subscriptionId = checkoutSession.metadata?.subscriptionId
    const seats = providerSub.items[0]?.quantity || 1

    if (referenceId && subscriptionId) {
        const trial = providerSub.trialStart && providerSub.trialEnd
            ? {
                trialStart: new Date(providerSub.trialStart * 1000),
                trialEnd: new Date(providerSub.trialEnd * 1000),
            }
            : {}

        const dbSubscription = await adapter.updateSubscription(subscriptionId, {
            plan: plan.name.toLowerCase(),
            status: providerSub.status,
            periodStart: new Date(providerSub.currentPeriodStart * 1000),
            periodEnd: new Date(providerSub.currentPeriodEnd * 1000),
            stripeSubscriptionId: checkoutSession.subscription,
            seats,
            ...trial,
        })

        if (trial.trialStart && plan.freeTrial?.onTrialStart && dbSubscription) {
            await plan.freeTrial.onTrialStart(dbSubscription)
        }

        const finalSubscription = dbSubscription || await adapter.findSubscriptionById(subscriptionId)
        if (finalSubscription) {
            await subscriptionOptions.onSubscriptionComplete?.({
                event,
                subscription: finalSubscription,
                providerSubscription: providerSub,
                plan,
            }, {} as any)
        }
    }
}

async function handleSubscriptionUpdated(
    config: PaymentRouteConfig,
    adapter: ReturnType<typeof createPaymentAdapter>,
    event: WebhookEvent,
    subscriptionOptions?: SubscriptionOptions
) {
    if (!subscriptionOptions) return

    const providerSub = event.data.object as any
    const priceId = providerSub.items?.data?.[0]?.price?.id
    const lookupKey = providerSub.items?.data?.[0]?.price?.lookup_key

    const plan = await getPlanByPriceInfo(config, priceId || "", lookupKey)

    const subscriptionId = providerSub.metadata?.subscriptionId
    const customerId = providerSub.customer?.toString()

    let subscription = subscriptionId
        ? await adapter.findSubscriptionById(subscriptionId)
        : await adapter.findSubscriptionByProviderId(providerSub.id)

    if (!subscription && customerId) {
        const subs = await adapter.findSubscriptionsByReferenceId(customerId)
        subscription = subs.find(s => s.status === "active" || s.status === "trialing") || subs[0]
    }

    if (!subscription) {
        getLogger().warn(`Subscription not found for webhook event: ${event.id}`)
        return
    }

    const seats = providerSub.items?.data?.[0]?.quantity || 1
    const wasScheduledForCancel = subscription.cancelAtPeriodEnd

    const updatedSubscription = await adapter.updateSubscription(subscription.id, {
        ...(plan ? { plan: plan.name.toLowerCase() } : {}),
        status: providerSub.status,
        periodStart: new Date(providerSub.items?.data?.[0]?.current_period_start * 1000),
        periodEnd: new Date(providerSub.items?.data?.[0]?.current_period_end * 1000),
        cancelAtPeriodEnd: providerSub.cancel_at_period_end,
        seats,
        stripeSubscriptionId: providerSub.id,
    })

    const justScheduledForCancel = providerSub.cancel_at_period_end && !wasScheduledForCancel

    if (justScheduledForCancel) {
        await subscriptionOptions.onSubscriptionCancel?.({
            subscription,
            providerSubscription: {
                id: providerSub.id,
                customerId: providerSub.customer,
                status: providerSub.status,
                currentPeriodStart: providerSub.items?.data?.[0]?.current_period_start,
                currentPeriodEnd: providerSub.items?.data?.[0]?.current_period_end,
                cancelAtPeriodEnd: providerSub.cancel_at_period_end,
                canceledAt: providerSub.canceled_at,
                items: providerSub.items?.data?.map((item: any) => ({
                    id: item.id,
                    price: { id: item.price.id, lookupKey: item.price.lookup_key },
                    quantity: item.quantity,
                })) || [],
                cancellationDetails: providerSub.cancellation_details,
            },
            cancellationDetails: providerSub.cancellation_details,
            event,
        })
    }

    await subscriptionOptions.onSubscriptionUpdate?.({
        event,
        subscription: updatedSubscription || subscription,
    })

    // Handle trial end
    if (plan?.freeTrial) {
        if (providerSub.status === "active" && subscription.status === "trialing" && plan.freeTrial.onTrialEnd) {
            await plan.freeTrial.onTrialEnd(subscription, {} as any)
        }
        if (providerSub.status === "incomplete_expired" && subscription.status === "trialing" && plan.freeTrial.onTrialExpired) {
            await plan.freeTrial.onTrialExpired(subscription, {} as any)
        }
    }
}

async function handleSubscriptionDeleted(
    config: PaymentRouteConfig,
    adapter: ReturnType<typeof createPaymentAdapter>,
    event: WebhookEvent,
    subscriptionOptions?: SubscriptionOptions
) {
    if (!subscriptionOptions) return

    const providerSub = event.data.object as any
    const subscriptionId = providerSub.id

    const subscription = await adapter.findSubscriptionByProviderId(subscriptionId)

    if (subscription) {
        await adapter.updateSubscription(subscription.id, {
            status: "canceled",
        })

        await subscriptionOptions.onSubscriptionDeleted?.({
            event,
            providerSubscription: {
                id: providerSub.id,
                customerId: providerSub.customer,
                status: "canceled",
                currentPeriodStart: providerSub.current_period_start,
                currentPeriodEnd: providerSub.current_period_end,
                cancelAtPeriodEnd: providerSub.cancel_at_period_end,
                canceledAt: providerSub.canceled_at,
                items: providerSub.items?.data?.map((item: any) => ({
                    id: item.id,
                    price: { id: item.price.id, lookupKey: item.price.lookup_key },
                    quantity: item.quantity,
                })) || [],
            },
            subscription,
        })
    } else {
        getLogger().warn(`Subscription not found for deletion: ${subscriptionId}`)
    }
}
