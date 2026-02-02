// =============================================================================
// PAYMENT PLUGIN
// Provider-based payment integration (Stripe, LemonSqueezy, Paddle)
// =============================================================================

import { createPlugin } from "../unified/facade.js"
import { getLogger } from "../../logger.js"
import type {
    PaymentPluginOptions,
    PaymentProvider,
    PaymentPlan,
    Subscription,
    SubscriptionOptions,
    PaymentRouteConfig,
} from "./types.js"
import { getPaymentSchema } from "./schema.js"
import { createStripeProvider, createMockStripeProvider } from "./providers/stripe.js"
import { createPaymentAdapter, updateUserStripeCustomerId } from "./api/internal-adapter.js"
import { PAYMENT_ERROR_CODES } from "./error-codes.js"
import {
    upgradeSubscription,
    cancelSubscription,
    cancelSubscriptionCallback,
    restoreSubscription,
    listActiveSubscriptions,
    subscriptionSuccess,
    createBillingPortal,
    stripeWebhook,
} from "./api/routes/index.js"

// =============================================================================
// RE-EXPORTS
// =============================================================================

export * from "./types.js"
export { PAYMENT_ERROR_CODES } from "./error-codes.js"
export { getPaymentSchema } from "./schema.js"
export { createStripeProvider, createMockStripeProvider } from "./providers/stripe.js"
export { createPaymentAdapter } from "./api/internal-adapter.js"

// Hooks
export * from "./api/hooks.js"

// Middleware
export { createReferenceMiddleware, sessionMiddleware } from "./api/middleware.js"

// Unified endpoint utilities
export { z, endpoint, EndpointError, createMiddleware } from "../unified/endpoint.js"

// =============================================================================
// CLIENT EXPORTS - Import from "nevr/plugins/payment/client" instead
// =============================================================================

//
// For frontend/client usage:
//   import { paymentClient } from "nevr/plugins/payment/client"
// =============================================================================

// Re-export type-only client types for convenience
export type { PaymentClientOptions, PaymentClientMethods } from "./client.js"

// =============================================================================
// PRE-REGISTRATION (Side Effect)
// Allows plugin('payment').subscription to work during generation
// =============================================================================

import { preRegisterPluginSchema } from "../unified/runtime.js"

preRegisterPluginSchema("payment", getPaymentSchema())

// =============================================================================
// PROVIDER CACHE
// =============================================================================

const providerCache = new Map<string, Promise<PaymentProvider>>()

function getCacheKey(options: PaymentPluginOptions): string {
    return JSON.stringify({
        provider: options.provider,
        stripe: options.stripe ? { secretKey: options.stripe.secretKey.slice(0, 10) } : undefined,
    })
}

async function getOrCreateProvider(options: PaymentPluginOptions): Promise<PaymentProvider> {
    const cacheKey = getCacheKey(options)

    let cached = providerCache.get(cacheKey)
    if (cached) {
        return cached
    }

    const providerPromise = (async () => {
        switch (options.provider) {
            case "stripe":
                if (!options.stripe?.secretKey) {
                    getLogger().warn("[Payment] No Stripe secret key, using mock provider")
                    return createMockStripeProvider()
                }
                return createStripeProvider(options.stripe)

            case "lemonsqueezy":
                throw new Error("[Payment] LemonSqueezy provider not yet implemented")

            case "paddle":
                throw new Error("[Payment] Paddle provider not yet implemented")

            default:
                throw new Error(`[Payment] Unknown provider: ${options.provider}`)
        }
    })()

    providerCache.set(cacheKey, providerPromise)
    return providerPromise
}

// =============================================================================
// PLAN UTILITIES
// =============================================================================

async function getPlans(subscription?: SubscriptionOptions | { enabled: false }): Promise<PaymentPlan[]> {
    if (!subscription || !("enabled" in subscription) || !subscription.enabled) {
        return []
    }

    const plans = subscription.plans
    if (typeof plans === "function") {
        return await plans()
    }
    return plans
}

function getPlanByName(plans: PaymentPlan[], name: string): PaymentPlan | undefined {
    return plans.find(p => p.name.toLowerCase() === name.toLowerCase())
}

// =============================================================================
// PAYMENT PLUGIN
// =============================================================================

/**
 * Payment plugin with provider pattern
 *
 * @example
 * ```typescript
 * // Stripe provider
 * import { payment } from "nevr/plugins"
 *
 * const app = nevr({
 *   plugins: [
 *     payment({
 *       provider: "stripe",
 *       stripe: {
 *         secretKey: process.env.STRIPE_SECRET_KEY!,
 *         webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
 *       },
 *       createCustomerOnSignUp: true,
 *       subscription: {
 *         enabled: true,
 *         plans: [
 *           { name: "free", priceId: "price_free" },
 *           { name: "pro", priceId: "price_pro", limits: { projects: 10 } },
 *           { name: "enterprise", priceId: "price_enterprise", limits: { projects: -1 } },
 *         ],
 *         // Multi-tenant support
 *         authorizeReference: async ({ user, referenceId }) => {
 *           return isWorkspaceAdmin(user.id, referenceId)
 *         },
 *       },
 *     }),
 *   ],
 * })
 * ```
 */
export const payment = createPlugin<PaymentPluginOptions>({
    id: "payment",
    name: "Payment",
    version: "1.0.0",
    description: "Provider-based payment integration",
    basePath: "/payment",

    defaults: {
        provider: "stripe",
        defaultCurrency: "usd",
        createCustomerOnSignUp: true,
    },

    validate: (options) => {
        const errors: string[] = []

        if (!options.provider) {
            errors.push("Provider is required")
        }

        if (options.provider === "stripe" && !options.stripe?.secretKey) {
            // Not an error - we use mock in development
            getLogger().warn("[Payment] No Stripe secret key configured. Using mock provider.")
        }

        return errors
    },

    factory: (options) => {
        // Provider instance (lazy initialized)
        let providerInstance: PaymentProvider | null = null

        const getProvider = (): PaymentProvider => {
            if (!providerInstance) {
                throw new Error("[Payment] Provider not initialized")
            }
            return providerInstance
        }

        // Subscription options helper
        const subscriptionOptions = options.subscription && "enabled" in options.subscription && options.subscription.enabled
            ? options.subscription as SubscriptionOptions
            : undefined

        // Build route config
        const routeConfig: PaymentRouteConfig = {
            options,
            getProvider,
            getPlans: () => getPlans(options.subscription),
        }

        // Build subscription endpoints conditionally (better-auth pattern)
        const subscriptionEndpoints = subscriptionOptions ? {
            upgradeSubscription: upgradeSubscription(routeConfig),
            cancelSubscription: cancelSubscription(routeConfig),
            cancelSubscriptionCallback: cancelSubscriptionCallback(routeConfig),
            restoreSubscription: restoreSubscription(routeConfig),
            listActiveSubscriptions: listActiveSubscriptions(routeConfig),
            subscriptionSuccess: subscriptionSuccess(routeConfig),
            createBillingPortal: createBillingPortal(routeConfig),
        } : {}

        return {
            schema: getPaymentSchema({
                subscription: !!subscriptionOptions,
            }),

            endpoints: {
                // Webhook is always available
                stripeWebhook: stripeWebhook(routeConfig),
                // Subscription endpoints only if enabled
                ...subscriptionEndpoints,
            } as any,

            // Database hooks for auto customer creation (better-auth pattern)
            entityHooks: options.createCustomerOnSignUp ? {
                user: {
                    create: {
                        after: async (ctx) => {
                            const user = ctx.data as any
                            if (!user?.email) return

                            try {
                                const provider = getProvider()
                                const driver = ctx.driver

                                // Check if user already has stripeCustomerId
                                if (user.stripeCustomerId) return

                                // Check if customer exists in provider by email
                                const existingCustomers = await provider.listCustomersByEmail(user.email)
                                let customer = existingCustomers[0]

                                if (customer) {
                                    // Link existing customer
                                    await updateUserStripeCustomerId(driver, user.id, customer.id)
                                    getLogger().info(`[Payment] Linked existing customer ${customer.id} to user ${user.id}`)
                                } else {
                                    // Create new customer
                                    let createParams: {
                                        email: string
                                        name?: string
                                        metadata: Record<string, string>
                                    } = {
                                        email: user.email,
                                        name: user.name,
                                        metadata: { userId: user.id },
                                    }

                                    // Apply custom params if provided
                                    if (options.getCustomerCreateParams) {
                                        const extraParams = await options.getCustomerCreateParams(user, ctx as any)
                                        createParams = {
                                            ...createParams,
                                            ...extraParams,
                                            metadata: { ...createParams.metadata, ...extraParams.metadata },
                                        }
                                    }

                                    customer = await provider.createCustomer(createParams)
                                    await updateUserStripeCustomerId(driver, user.id, customer.id)
                                    getLogger().info(`[Payment] Created customer ${customer.id} for user ${user.id}`)
                                }

                                // Call onCustomerCreate hook
                                if (options.onCustomerCreate) {
                                    await options.onCustomerCreate(
                                        { customer, user: { ...user, stripeCustomerId: customer.id } },
                                        ctx as any
                                    )
                                }
                            } catch (error: any) {
                                getLogger().error(`[Payment] Failed to create customer: ${error.message}`)
                                // Don't throw - user creation should succeed even if payment fails
                            }
                        },
                    },
                    update: {
                        after: async (ctx) => {
                            const user = ctx.data as any
                            if (!user?.stripeCustomerId) return

                            try {
                                const provider = getProvider()

                                // Get current customer from provider
                                const customer = await provider.getCustomer(user.stripeCustomerId)
                                if (!customer || customer.deleted) return

                                // Sync email if changed
                                if (customer.email !== user.email) {
                                    await provider.updateCustomer(user.stripeCustomerId, {
                                        email: user.email,
                                        name: user.name,
                                    })
                                    getLogger().info(`[Payment] Synced user ${user.id} email to provider`)
                                }
                            } catch (error: any) {
                                getLogger().error(`[Payment] Failed to sync user: ${error.message}`)
                            }
                        },
                    },
                },
            } : undefined,

            lifecycle: {
                onInit: async () => {
                    getLogger().debug("[Payment] Initializing payment plugin...")

                    // Initialize provider
                    providerInstance = await getOrCreateProvider(options)

                    getLogger().info(`[Payment] Initialized with ${options.provider} provider`)
                },
            },

            $Infer: {
                Subscription: {} as Subscription,
                PaymentPlan: {} as PaymentPlan,
            },
            $ERROR_CODES: PAYMENT_ERROR_CODES,
        }
    },
})

export default payment

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a reference has an active subscription
 */
export async function hasActiveSubscription(
    driver: any,
    referenceId: string
): Promise<boolean> {
    const adapter = createPaymentAdapter(driver)
    const subscription = await adapter.findActiveSubscription(referenceId)
    return subscription !== null
}

/**
 * Get the current plan for a reference
 */
export async function getCurrentPlan(
    driver: any,
    referenceId: string
): Promise<string | null> {
    const adapter = createPaymentAdapter(driver)
    const subscription = await adapter.findActiveSubscription(referenceId)
    return subscription?.plan || null
}

/**
 * Check if a reference has access to a feature based on plan limits
 */
export async function hasFeatureAccess(
    driver: any,
    referenceId: string,
    feature: string,
    plans: PaymentPlan[]
): Promise<boolean> {
    const currentPlan = await getCurrentPlan(driver, referenceId)
    if (!currentPlan) return false

    const plan = getPlanByName(plans, currentPlan)
    if (!plan?.limits) return true // No limits = unlimited

    const limit = plan.limits[feature]
    if (limit === undefined) return true
    if (typeof limit === "boolean") return limit
    return limit === -1 || limit > 0 // -1 = unlimited
}

/**
 * Get feature limit for a reference
 */
export async function getFeatureLimit(
    driver: any,
    referenceId: string,
    feature: string,
    plans: PaymentPlan[]
): Promise<number | null> {
    const currentPlan = await getCurrentPlan(driver, referenceId)
    if (!currentPlan) return 0

    const plan = getPlanByName(plans, currentPlan)
    if (!plan?.limits) return null // null = no limit

    const limit = plan.limits[feature]
    if (typeof limit === "number") return limit
    return null
}
