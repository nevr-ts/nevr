// =============================================================================
// STRIPE PAYMENT PROVIDER
// Implements PaymentProvider interface for Stripe
// =============================================================================

import type {
    PaymentProvider,
    StripeProviderConfig,
    CreateCustomerParams,
    UpdateCustomerParams,
    CreateCheckoutParams,
    CreatePortalParams,
    UpdateSubscriptionParams,
    ProviderCustomer,
    ProviderCheckoutSession,
    ProviderPortalSession,
    ProviderSubscription,
    SubscriptionStatus,
    WebhookEvent,
} from "../types.js"
import { getLogger } from "../../../logger.js"

// -----------------------------------------------------------------------------
// Stripe SDK Types (minimal interface for dynamic import)
// -----------------------------------------------------------------------------

interface StripeSDK {
    customers: {
        create(params: any): Promise<any>
        retrieve(id: string): Promise<any>
        update(id: string, params: any): Promise<any>
        del(id: string): Promise<any>
        list(params: any): Promise<{ data: any[] }>
    }
    checkout: {
        sessions: {
            create(params: any, options?: any): Promise<any>
        }
    }
    billingPortal: {
        sessions: {
            create(params: any): Promise<any>
        }
    }
    subscriptions: {
        retrieve(id: string): Promise<any>
        list(params: any): Promise<{ data: any[] }>
        update(id: string, params: any): Promise<any>
    }
    prices: {
        list(params: any): Promise<{ data: any[] }>
    }
    webhooks: {
        constructEvent(payload: string | Buffer, sig: string, secret: string): any
        constructEventAsync?(payload: string | Buffer, sig: string, secret: string): Promise<any>
    }
}

// -----------------------------------------------------------------------------
// Stripe Provider Implementation
// -----------------------------------------------------------------------------

/**
 * Create Stripe payment provider
 */
export async function createStripeProvider(config: StripeProviderConfig): Promise<PaymentProvider> {
    let stripe: StripeSDK

    try {
        // Dynamic import Stripe SDK
        const Stripe = await import("stripe").then((m: any) => m.default || m)
        stripe = new Stripe(config.secretKey, {
            apiVersion: config.apiVersion || "2023-10-16",
        }) as StripeSDK
    } catch (error) {
        throw new Error(
            "[Payment] Failed to load Stripe SDK. Install it with: npm install stripe"
        )
    }

    getLogger().debug("[Payment] Stripe provider initialized")

    return {
        type: "stripe",

        // -------------------------------------------------------------------------
        // Customer Operations
        // -------------------------------------------------------------------------

        async createCustomer(params: CreateCustomerParams): Promise<ProviderCustomer> {
            const customer = await stripe.customers.create({
                email: params.email,
                name: params.name,
                metadata: params.metadata,
            })

            return {
                id: customer.id,
                email: customer.email,
                name: customer.name || undefined,
                metadata: customer.metadata,
            }
        },

        async getCustomer(customerId: string): Promise<ProviderCustomer | null> {
            try {
                const customer = await stripe.customers.retrieve(customerId)

                if (customer.deleted) {
                    return null
                }

                return {
                    id: customer.id,
                    email: customer.email,
                    name: customer.name || undefined,
                    deleted: customer.deleted,
                    metadata: customer.metadata,
                }
            } catch (error: any) {
                if (error.code === "resource_missing") {
                    return null
                }
                throw error
            }
        },

        async updateCustomer(customerId: string, params: UpdateCustomerParams): Promise<ProviderCustomer> {
            const customer = await stripe.customers.update(customerId, {
                email: params.email,
                name: params.name,
                metadata: params.metadata,
            })

            return {
                id: customer.id,
                email: customer.email,
                name: customer.name || undefined,
                metadata: customer.metadata,
            }
        },

        async deleteCustomer(customerId: string): Promise<void> {
            await stripe.customers.del(customerId)
        },

        async listCustomersByEmail(email: string): Promise<ProviderCustomer[]> {
            const result = await stripe.customers.list({
                email,
                limit: 10,
            })

            return result.data
                .filter((c: any) => !c.deleted)
                .map((c: any) => ({
                    id: c.id,
                    email: c.email,
                    name: c.name || undefined,
                    metadata: c.metadata,
                }))
        },

        // -------------------------------------------------------------------------
        // Checkout Operations
        // -------------------------------------------------------------------------

        async createCheckoutSession(params: CreateCheckoutParams): Promise<ProviderCheckoutSession> {
            const sessionParams: any = {
                mode: params.mode,
                success_url: params.successUrl,
                cancel_url: params.cancelUrl,
                line_items: params.lineItems.map(item => ({
                    price: item.price,
                    quantity: item.quantity,
                })),
                metadata: params.metadata,
                client_reference_id: params.clientReferenceId,
            }

            // Customer handling
            if (params.customerId) {
                sessionParams.customer = params.customerId
                if (params.customerUpdate) {
                    sessionParams.customer_update = {
                        name: params.customerUpdate.name,
                        address: params.customerUpdate.address,
                    }
                }
            }

            // Trial period for subscriptions
            if (params.mode === "subscription" && params.trialPeriodDays) {
                sessionParams.subscription_data = {
                    trial_period_days: params.trialPeriodDays,
                }
            }

            const session = await stripe.checkout.sessions.create(sessionParams)

            return {
                id: session.id,
                url: session.url,
                status: session.status,
            }
        },

        // -------------------------------------------------------------------------
        // Billing Portal
        // -------------------------------------------------------------------------

        async createBillingPortalSession(params: CreatePortalParams): Promise<ProviderPortalSession> {
            const portalParams: any = {
                customer: params.customerId,
                return_url: params.returnUrl,
            }

            if (params.locale) {
                portalParams.locale = params.locale
            }

            if (params.flowData) {
                portalParams.flow_data = {
                    type: params.flowData.type,
                }

                if (params.flowData.subscriptionCancel) {
                    portalParams.flow_data.subscription_cancel = {
                        subscription: params.flowData.subscriptionCancel.subscription,
                    }
                }

                if (params.flowData.subscriptionUpdateConfirm) {
                    portalParams.flow_data.subscription_update_confirm = {
                        subscription: params.flowData.subscriptionUpdateConfirm.subscription,
                        items: params.flowData.subscriptionUpdateConfirm.items.map(item => ({
                            id: item.id,
                            price: item.price,
                            quantity: item.quantity,
                        })),
                    }
                }

                if (params.flowData.afterCompletion) {
                    portalParams.flow_data.after_completion = {
                        type: params.flowData.afterCompletion.type,
                        redirect: {
                            return_url: params.flowData.afterCompletion.redirect.returnUrl,
                        },
                    }
                }
            }

            const session = await stripe.billingPortal.sessions.create(portalParams)

            return {
                id: session.id,
                url: session.url,
            }
        },

        // -------------------------------------------------------------------------
        // Subscription Operations
        // -------------------------------------------------------------------------

        async getSubscription(subscriptionId: string): Promise<ProviderSubscription | null> {
            try {
                const sub = await stripe.subscriptions.retrieve(subscriptionId)
                return mapStripeSubscription(sub)
            } catch (error: any) {
                if (error.code === "resource_missing") {
                    return null
                }
                throw error
            }
        },

        async listSubscriptions(customerId: string, status?: SubscriptionStatus): Promise<ProviderSubscription[]> {
            const params: any = { customer: customerId }
            if (status) {
                params.status = status
            }

            const result = await stripe.subscriptions.list(params)
            return result.data.map(mapStripeSubscription)
        },

        async updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<ProviderSubscription> {
            const updateParams: any = {}

            if (params.cancelAtPeriodEnd !== undefined) {
                updateParams.cancel_at_period_end = params.cancelAtPeriodEnd
            }

            if (params.metadata) {
                updateParams.metadata = params.metadata
            }

            // Note: Changing price requires updating subscription items
            // This is a simplified implementation
            if (params.priceId) {
                // Get current subscription to find item ID
                const current = await stripe.subscriptions.retrieve(subscriptionId)
                const itemId = current.items.data[0]?.id
                if (itemId) {
                    updateParams.items = [{
                        id: itemId,
                        price: params.priceId,
                        quantity: params.quantity || 1,
                    }]
                }
            }

            const sub = await stripe.subscriptions.update(subscriptionId, updateParams)
            return mapStripeSubscription(sub)
        },

        async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true): Promise<ProviderSubscription> {
            const sub = await stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: cancelAtPeriodEnd,
            })
            return mapStripeSubscription(sub)
        },

        // -------------------------------------------------------------------------
        // Webhook Handling
        // -------------------------------------------------------------------------

        async constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Promise<WebhookEvent> {
            let event: any

            // Support both Stripe v18 (constructEvent) and v19+ (constructEventAsync)
            if (typeof stripe.webhooks.constructEventAsync === "function") {
                event = await stripe.webhooks.constructEventAsync(payload, signature, secret)
            } else {
                event = stripe.webhooks.constructEvent(payload, signature, secret)
            }

            return {
                id: event.id,
                type: event.type,
                data: {
                    object: event.data.object,
                },
            }
        },

        // -------------------------------------------------------------------------
        // Price Utilities
        // -------------------------------------------------------------------------

        async resolvePriceId(lookupKey: string): Promise<string | undefined> {
            const prices = await stripe.prices.list({
                lookup_keys: [lookupKey],
                active: true,
                limit: 1,
            })
            return prices.data[0]?.id
        },
    }
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function mapStripeSubscription(sub: any): ProviderSubscription {
    return {
        id: sub.id,
        customerId: sub.customer,
        status: sub.status as SubscriptionStatus,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at,
        trialStart: sub.trial_start,
        trialEnd: sub.trial_end,
        items: sub.items.data.map((item: any) => ({
            id: item.id,
            price: {
                id: item.price.id,
                lookupKey: item.price.lookup_key,
            },
            quantity: item.quantity,
        })),
        cancellationDetails: sub.cancellation_details,
    }
}

// -----------------------------------------------------------------------------
// Mock Provider (for testing)
// -----------------------------------------------------------------------------

/**
 * Create mock Stripe provider for testing/development
 */
export function createMockStripeProvider(): PaymentProvider {
    const customers = new Map<string, ProviderCustomer>()
    const subscriptions = new Map<string, ProviderSubscription>()
    let idCounter = 0

    const generateId = (prefix: string) => `${prefix}_mock_${++idCounter}`

    return {
        type: "stripe",

        async createCustomer(params) {
            const customer: ProviderCustomer = {
                id: generateId("cus"),
                email: params.email,
                name: params.name,
                metadata: params.metadata,
            }
            customers.set(customer.id, customer)
            return customer
        },

        async getCustomer(customerId) {
            return customers.get(customerId) || null
        },

        async updateCustomer(customerId, params) {
            const customer = customers.get(customerId)
            if (!customer) throw new Error("Customer not found")

            const updated = { ...customer, ...params }
            customers.set(customerId, updated)
            return updated
        },

        async deleteCustomer(customerId) {
            customers.delete(customerId)
        },

        async listCustomersByEmail(email) {
            return Array.from(customers.values()).filter(c => c.email === email)
        },

        async createCheckoutSession(params) {
            return {
                id: generateId("cs"),
                url: `https://checkout.stripe.com/mock/${generateId("session")}`,
                status: "open",
            }
        },

        async createBillingPortalSession(params) {
            return {
                id: generateId("bps"),
                url: `https://billing.stripe.com/mock/${generateId("portal")}`,
            }
        },

        async getSubscription(subscriptionId) {
            return subscriptions.get(subscriptionId) || null
        },

        async listSubscriptions(customerId, status) {
            return Array.from(subscriptions.values())
                .filter(s => s.customerId === customerId)
                .filter(s => !status || s.status === status)
        },

        async updateSubscription(subscriptionId, params) {
            const sub = subscriptions.get(subscriptionId)
            if (!sub) throw new Error("Subscription not found")

            const updated: ProviderSubscription = {
                ...sub,
                cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? sub.cancelAtPeriodEnd,
            }
            subscriptions.set(subscriptionId, updated)
            return updated
        },

        async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
            const sub = subscriptions.get(subscriptionId)
            if (!sub) throw new Error("Subscription not found")

            const updated: ProviderSubscription = {
                ...sub,
                cancelAtPeriodEnd,
                status: cancelAtPeriodEnd ? sub.status : "canceled",
            }
            subscriptions.set(subscriptionId, updated)
            return updated
        },

        async constructWebhookEvent(payload, signature, secret) {
            // Mock webhook event construction
            const data = typeof payload === "string" ? JSON.parse(payload) : JSON.parse(payload.toString())
            return {
                id: generateId("evt"),
                type: data.type || "mock.event",
                data: {
                    object: data.data?.object || {},
                },
            }
        },

        async resolvePriceId(lookupKey) {
            // Mock returns the lookup key as price ID
            return `price_${lookupKey}`
        },
    }
}
