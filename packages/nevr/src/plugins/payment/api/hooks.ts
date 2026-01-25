// =============================================================================
// PAYMENT HOOKS
// Hook system for payment plugin extensibility
// =============================================================================

import type {
    Subscription,
    PaymentPlan,
    ProviderSubscription,
    ProviderCustomer,
    WebhookEvent,
    EndpointContext,
} from "../types.js"

// -----------------------------------------------------------------------------
// Hook Definitions
// -----------------------------------------------------------------------------

export interface PaymentPluginHooks {
    // Customer hooks
    /** Called after a customer is created in the payment provider */
    onCustomerCreate?: (
        data: { customer: ProviderCustomer; user: any },
        ctx: EndpointContext
    ) => Promise<void>

    // Subscription hooks (better-auth pattern)
    /** Called after a subscription is successfully completed */
    onSubscriptionComplete?: (
        data: {
            event: WebhookEvent
            providerSubscription: ProviderSubscription
            subscription: Subscription
            plan: PaymentPlan
        },
        ctx: EndpointContext
    ) => Promise<void>

    /** Called when a subscription is updated */
    onSubscriptionUpdate?: (data: {
        event: WebhookEvent
        subscription: Subscription
    }) => Promise<void>

    /** Called when a subscription is canceled */
    onSubscriptionCancel?: (data: {
        event?: WebhookEvent
        subscription: Subscription
        providerSubscription: ProviderSubscription
        cancellationDetails?: Record<string, unknown>
    }) => Promise<void>

    /** Called when a subscription is deleted */
    onSubscriptionDeleted?: (data: {
        event: WebhookEvent
        providerSubscription: ProviderSubscription
        subscription: Subscription
    }) => Promise<void>

    // Trial hooks
    /** Called when a trial starts */
    onTrialStart?: (subscription: Subscription) => Promise<void>

    /** Called when a trial ends (converts to paid) */
    onTrialEnd?: (subscription: Subscription, ctx: EndpointContext) => Promise<void>

    /** Called when a trial expires without conversion */
    onTrialExpired?: (subscription: Subscription, ctx: EndpointContext) => Promise<void>

    // Generic event hook
    /** Called for all webhook events */
    onEvent?: (event: WebhookEvent) => Promise<void>
}

// -----------------------------------------------------------------------------
// Hook Registry
// -----------------------------------------------------------------------------

const hookRegistry: PaymentPluginHooks[] = []

/**
 * Register hooks for payment plugin
 *
 * @example
 * ```typescript
 * registerPaymentHooks({
 *     onSubscriptionComplete: async ({ subscription, plan }) => {
 *         console.log(`User subscribed to ${plan.name}`)
 *         await sendWelcomeEmail(subscription.referenceId)
 *     },
 *     onSubscriptionCancel: async ({ subscription }) => {
 *         console.log(`User canceled subscription`)
 *         await sendCancellationEmail(subscription.referenceId)
 *     },
 * })
 * ```
 */
export function registerPaymentHooks(hooks: PaymentPluginHooks): void {
    hookRegistry.push(hooks)
}

/**
 * Clear all registered hooks (for testing)
 */
export function clearPaymentHooks(): void {
    hookRegistry.length = 0
}

/**
 * Get all registered hooks
 */
export function getPaymentHooks(): readonly PaymentPluginHooks[] {
    return hookRegistry
}

// -----------------------------------------------------------------------------
// Hook Runners
// -----------------------------------------------------------------------------

/**
 * Run onCustomerCreate hooks
 */
export async function runOnCustomerCreate(
    data: { customer: ProviderCustomer; user: any },
    ctx: EndpointContext
): Promise<void> {
    for (const hooks of hookRegistry) {
        if (hooks.onCustomerCreate) {
            await hooks.onCustomerCreate(data, ctx)
        }
    }
}

/**
 * Run onSubscriptionComplete hooks
 */
export async function runOnSubscriptionComplete(
    data: {
        event: WebhookEvent
        providerSubscription: ProviderSubscription
        subscription: Subscription
        plan: PaymentPlan
    },
    ctx: EndpointContext
): Promise<void> {
    for (const hooks of hookRegistry) {
        if (hooks.onSubscriptionComplete) {
            await hooks.onSubscriptionComplete(data, ctx)
        }
    }
}

/**
 * Run onSubscriptionUpdate hooks
 */
export async function runOnSubscriptionUpdate(data: {
    event: WebhookEvent
    subscription: Subscription
}): Promise<void> {
    for (const hooks of hookRegistry) {
        if (hooks.onSubscriptionUpdate) {
            await hooks.onSubscriptionUpdate(data)
        }
    }
}

/**
 * Run onSubscriptionCancel hooks
 */
export async function runOnSubscriptionCancel(data: {
    event?: WebhookEvent
    subscription: Subscription
    providerSubscription: ProviderSubscription
    cancellationDetails?: Record<string, unknown>
}): Promise<void> {
    for (const hooks of hookRegistry) {
        if (hooks.onSubscriptionCancel) {
            await hooks.onSubscriptionCancel(data)
        }
    }
}

/**
 * Run onSubscriptionDeleted hooks
 */
export async function runOnSubscriptionDeleted(data: {
    event: WebhookEvent
    providerSubscription: ProviderSubscription
    subscription: Subscription
}): Promise<void> {
    for (const hooks of hookRegistry) {
        if (hooks.onSubscriptionDeleted) {
            await hooks.onSubscriptionDeleted(data)
        }
    }
}

/**
 * Run onTrialStart hooks
 */
export async function runOnTrialStart(subscription: Subscription): Promise<void> {
    for (const hooks of hookRegistry) {
        if (hooks.onTrialStart) {
            await hooks.onTrialStart(subscription)
        }
    }
}

/**
 * Run onTrialEnd hooks
 */
export async function runOnTrialEnd(
    subscription: Subscription,
    ctx: EndpointContext
): Promise<void> {
    for (const hooks of hookRegistry) {
        if (hooks.onTrialEnd) {
            await hooks.onTrialEnd(subscription, ctx)
        }
    }
}

/**
 * Run onTrialExpired hooks
 */
export async function runOnTrialExpired(
    subscription: Subscription,
    ctx: EndpointContext
): Promise<void> {
    for (const hooks of hookRegistry) {
        if (hooks.onTrialExpired) {
            await hooks.onTrialExpired(subscription, ctx)
        }
    }
}

/**
 * Run onEvent hooks
 */
export async function runOnEvent(event: WebhookEvent): Promise<void> {
    for (const hooks of hookRegistry) {
        if (hooks.onEvent) {
            await hooks.onEvent(event)
        }
    }
}
