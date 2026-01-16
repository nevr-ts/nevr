// =============================================================================
// PAYMENT PLUGIN TYPES
// Provider-based payment integration (Stripe, LemonSqueezy, Paddle, etc.)
// Follows better-auth patterns with nevr plugin conventions
// =============================================================================

import type { Driver } from "../../types.js"

// -----------------------------------------------------------------------------
// Provider Types
// -----------------------------------------------------------------------------

/**
 * Supported payment providers
 */
export type PaymentProviderType = "stripe" | "lemonsqueezy" | "paddle"

/**
 * Abstract payment provider interface
 * Implement this to add new payment providers
 */
export interface PaymentProvider {
    /** Provider type identifier */
    readonly type: PaymentProviderType

    // Customer operations
    createCustomer(params: CreateCustomerParams): Promise<ProviderCustomer>
    getCustomer(customerId: string): Promise<ProviderCustomer | null>
    updateCustomer(customerId: string, params: UpdateCustomerParams): Promise<ProviderCustomer>
    deleteCustomer(customerId: string): Promise<void>
    listCustomersByEmail(email: string): Promise<ProviderCustomer[]>

    // Checkout operations
    createCheckoutSession(params: CreateCheckoutParams): Promise<ProviderCheckoutSession>

    // Billing portal
    createBillingPortalSession(params: CreatePortalParams): Promise<ProviderPortalSession>

    // Subscription operations
    getSubscription(subscriptionId: string): Promise<ProviderSubscription | null>
    listSubscriptions(customerId: string, status?: SubscriptionStatus): Promise<ProviderSubscription[]>
    updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<ProviderSubscription>
    cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<ProviderSubscription>

    // Webhook handling
    constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Promise<WebhookEvent>

    // Price utilities
    resolvePriceId(lookupKey: string): Promise<string | undefined>
}

// -----------------------------------------------------------------------------
// Provider-specific Configs
// -----------------------------------------------------------------------------

/**
 * Stripe provider configuration
 */
export interface StripeProviderConfig {
    /** Stripe secret key */
    secretKey: string
    /** Stripe API version */
    apiVersion?: string
    /** Stripe webhook secret for signature verification */
    webhookSecret?: string
}

/**
 * LemonSqueezy provider configuration (future)
 */
export interface LemonSqueezyProviderConfig {
    /** API key */
    apiKey: string
    /** Store ID */
    storeId: string
    /** Webhook secret */
    webhookSecret?: string
}

/**
 * Paddle provider configuration (future)
 */
export interface PaddleProviderConfig {
    /** Vendor ID */
    vendorId: string
    /** API key */
    apiKey: string
    /** Webhook secret */
    webhookSecret?: string
}

// -----------------------------------------------------------------------------
// Plugin Options
// -----------------------------------------------------------------------------

/**
 * Payment plan configuration
 */
export interface PaymentPlan {
    /** Plan name (used as identifier) */
    name: string
    /** Display name */
    displayName?: string
    /** Plan description */
    description?: string
    /** Monthly price ID */
    priceId?: string
    /** Lookup key (alternative to priceId) */
    lookupKey?: string
    /** Annual discount price ID */
    annualPriceId?: string
    /** Annual discount lookup key */
    annualLookupKey?: string
    /** Feature limits for this plan */
    limits?: Record<string, number | boolean>
    /** Plan group (for multiple subscriptions) */
    group?: string
    /** Free trial configuration */
    freeTrial?: {
        /** Trial days */
        days: number
        /** Called when trial starts */
        onTrialStart?: (subscription: Subscription) => Promise<void>
        /** Called when trial ends */
        onTrialEnd?: (subscription: Subscription, ctx: EndpointContext) => Promise<void>
        /** Called when trial expires without conversion */
        onTrialExpired?: (subscription: Subscription, ctx: EndpointContext) => Promise<void>
    }
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
    /** Enable subscription features */
    enabled: boolean
    /** Subscription plans - can be static or dynamic */
    plans: PaymentPlan[] | (() => PaymentPlan[] | Promise<PaymentPlan[]>)
    /** Require email verification before subscribing */
    requireEmailVerification?: boolean
    /** Enable organization/team subscriptions */
    organization?: { enabled: boolean }

    // Authorization
    /**
     * Authorize access to subscription operations for a referenceId
     * Required when using referenceId for multi-tenant subscriptions
     */
    authorizeReference?: (
        data: AuthorizeReferenceData,
        ctx: EndpointContext
    ) => Promise<boolean>

    // Customization hooks
    /**
     * Custom checkout session parameters
     */
    getCheckoutSessionParams?: (
        data: CheckoutParamsData,
        ctx: EndpointContext
    ) => Promise<CheckoutSessionCustomParams> | CheckoutSessionCustomParams

    // Event callbacks
    onSubscriptionComplete?: (data: SubscriptionCompleteData, ctx: EndpointContext) => Promise<void>
    onSubscriptionUpdate?: (data: SubscriptionUpdateData) => Promise<void>
    onSubscriptionCancel?: (data: SubscriptionCancelData) => Promise<void>
    onSubscriptionDeleted?: (data: SubscriptionDeletedData) => Promise<void>
}

/**
 * Payment plugin configuration options
 */
export interface PaymentPluginOptions {
    /**
     * Payment provider type
     */
    provider: PaymentProviderType

    /**
     * Stripe provider configuration
     * Required when provider is "stripe"
     */
    stripe?: StripeProviderConfig

    /**
     * LemonSqueezy provider configuration (future)
     * Required when provider is "lemonsqueezy"
     */
    lemonsqueezy?: LemonSqueezyProviderConfig

    /**
     * Paddle provider configuration (future)
     * Required when provider is "paddle"
     */
    paddle?: PaddleProviderConfig

    /**
     * Subscription configuration
     */
    subscription?: SubscriptionOptions | { enabled: false }

    /**
     * Default currency for payments
     * @default "usd"
     */
    defaultCurrency?: string

    /**
     * Whether to automatically create customer on user signup
     * @default true
     */
    createCustomerOnSignUp?: boolean

    /**
     * Custom customer creation parameters
     */
    getCustomerCreateParams?: (
        user: any,
        ctx: EndpointContext
    ) => Promise<Partial<CreateCustomerParams>>

    /**
     * Callback when customer is created
     */
    onCustomerCreate?: (
        data: { customer: ProviderCustomer; user: any },
        ctx: EndpointContext
    ) => Promise<void>

    /**
     * Generic webhook event handler (for unhandled events)
     */
    onEvent?: (event: WebhookEvent) => Promise<void>
}

// -----------------------------------------------------------------------------
// Callback Data Types
// -----------------------------------------------------------------------------

export interface AuthorizeReferenceData {
    user: any
    session: any
    referenceId: string
    action: "upgrade-subscription" | "list-subscription" | "cancel-subscription" | "restore-subscription" | "billing-portal"
}

export interface CheckoutParamsData {
    user: any
    session: any
    plan: PaymentPlan
    subscription: Subscription
}

export interface CheckoutSessionCustomParams {
    params?: Record<string, unknown>
    options?: Record<string, unknown>
}

export interface SubscriptionCompleteData {
    event: WebhookEvent
    providerSubscription: ProviderSubscription
    subscription: Subscription
    plan: PaymentPlan
}

export interface SubscriptionUpdateData {
    event: WebhookEvent
    subscription: Subscription
}

export interface SubscriptionCancelData {
    event?: WebhookEvent
    subscription: Subscription
    providerSubscription: ProviderSubscription
    cancellationDetails?: Record<string, unknown>
}

export interface SubscriptionDeletedData {
    event: WebhookEvent
    providerSubscription: ProviderSubscription
    subscription: Subscription
}

export interface EndpointContext {
    user?: any
    session?: any
    driver: Driver
    request?: Request
    [key: string]: unknown
}

// -----------------------------------------------------------------------------
// Provider Operation Types
// -----------------------------------------------------------------------------

export interface CreateCustomerParams {
    email: string
    name?: string
    metadata?: Record<string, string>
}

export interface UpdateCustomerParams {
    email?: string
    name?: string
    metadata?: Record<string, string>
}

export interface CreateCheckoutParams {
    customerId: string
    mode: "payment" | "subscription" | "setup"
    lineItems: Array<{ price: string; quantity: number }>
    successUrl: string
    cancelUrl: string
    metadata?: Record<string, string>
    trialPeriodDays?: number
    clientReferenceId?: string
    customerUpdate?: { name?: "auto"; address?: "auto" }
}

export interface CreatePortalParams {
    customerId: string
    returnUrl: string
    locale?: string
    flowData?: {
        type: "subscription_cancel" | "subscription_update_confirm"
        subscriptionCancel?: { subscription: string }
        subscriptionUpdateConfirm?: {
            subscription: string
            items: Array<{ id: string; price: string; quantity: number }>
        }
        afterCompletion?: {
            type: "redirect"
            redirect: { returnUrl: string }
        }
    }
}

export interface UpdateSubscriptionParams {
    priceId?: string
    quantity?: number
    cancelAtPeriodEnd?: boolean
    metadata?: Record<string, string>
}

// -----------------------------------------------------------------------------
// Provider Response Types
// -----------------------------------------------------------------------------

export interface ProviderCustomer {
    id: string
    email: string
    name?: string
    deleted?: boolean
    metadata?: Record<string, string>
}

export interface ProviderCheckoutSession {
    id: string
    url: string
    status?: string
}

export interface ProviderPortalSession {
    id: string
    url: string
}

export interface ProviderSubscription {
    id: string
    customerId: string
    status: SubscriptionStatus
    currentPeriodStart: number
    currentPeriodEnd: number
    cancelAtPeriodEnd: boolean
    canceledAt?: number | null
    trialStart?: number | null
    trialEnd?: number | null
    items: Array<{
        id: string
        price: { id: string; lookupKey?: string }
        quantity: number
    }>
    cancellationDetails?: Record<string, unknown>
}

export interface WebhookEvent {
    id: string
    type: string
    data: {
        object: Record<string, unknown>
    }
}

// -----------------------------------------------------------------------------
// Entity Types
// -----------------------------------------------------------------------------

/**
 * Subscription record (stored in database)
 * Matches better-auth subscription schema
 */
export interface Subscription {
    id: string
    /** Plan name */
    plan: string
    /** Reference ID (userId, workspaceId, organizationId, etc.) */
    referenceId: string
    /** Provider customer ID */
    stripeCustomerId?: string | null
    /** Provider subscription ID */
    stripeSubscriptionId?: string | null
    /** Price ID */
    priceId?: string | null
    /** Subscription status */
    status: SubscriptionStatus
    /** Billing period start */
    periodStart?: Date | null
    /** Billing period end */
    periodEnd?: Date | null
    /** Trial start date */
    trialStart?: Date | null
    /** Trial end date */
    trialEnd?: Date | null
    /** Cancel at period end */
    cancelAtPeriodEnd: boolean
    /** Number of seats (for team plans) */
    seats?: number | null
    /** Group ID (for multiple subscriptions per reference) */
    groupId?: string | null
    createdAt: Date
    updatedAt: Date
}

/**
 * Subscription status
 */
export type SubscriptionStatus =
    | "active"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "paused"
    | "trialing"
    | "unpaid"

// -----------------------------------------------------------------------------
// Internal Adapter Interface
// -----------------------------------------------------------------------------

/**
 * Internal adapter for payment database operations
 */
export interface PaymentAdapter {
    // Subscription operations
    findSubscriptionById(id: string): Promise<Subscription | null>
    findSubscriptionByProviderId(providerSubscriptionId: string): Promise<Subscription | null>
    findSubscriptionsByReferenceId(referenceId: string): Promise<Subscription[]>
    findActiveSubscription(referenceId: string): Promise<Subscription | null>
    createSubscription(data: Omit<Subscription, "id" | "createdAt" | "updatedAt">): Promise<Subscription>
    updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription | null>
    deleteSubscription(id: string): Promise<void>
    deleteSubscriptionsByReferenceId(referenceId: string): Promise<void>
}

// -----------------------------------------------------------------------------
// Route Config Types
// -----------------------------------------------------------------------------

export interface PaymentRouteConfig {
    options: PaymentPluginOptions
    getProvider: () => PaymentProvider
    getPlans: () => Promise<PaymentPlan[]>
}
