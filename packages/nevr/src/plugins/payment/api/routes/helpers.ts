// =============================================================================
// PAYMENT ROUTE HELPERS
// Shared utilities, error codes, and middleware for payment routes
// =============================================================================

import { EndpointError } from "../../../unified/endpoint.js"
import type { EndpointContext } from "../../../unified/endpoint.js"
import { getLogger } from "../../../../logger.js"
import type {
    PaymentRouteConfig,
    PaymentPlan,
    SubscriptionOptions,
} from "../../types.js"

// =============================================================================
// ERROR CODES
// =============================================================================

export const SUBSCRIPTION_ERROR_CODES = {
    SUBSCRIPTION_NOT_FOUND: "Subscription not found",
    SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
    ALREADY_SUBSCRIBED_PLAN: "You're already subscribed to this plan",
    UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer",
    EMAIL_VERIFICATION_REQUIRED: "Email verification is required before subscribing",
    SUBSCRIPTION_NOT_ACTIVE: "Subscription is not active",
    SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION: "Subscription is not scheduled for cancellation",
    NO_STRIPE_CUSTOMER: "No Stripe customer found for this user",
    WEBHOOK_SECRET_NOT_FOUND: "Stripe webhook secret not configured",
} as const

// =============================================================================
// URL HELPER
// =============================================================================

/**
 * Build a full URL from base URL and path
 */
export function getUrl(ctx: EndpointContext, baseURL: string, url: string): string {
    if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) {
        return url
    }
    return `${baseURL}${url.startsWith("/") ? url : `/${url}`}`
}

// =============================================================================
// PLAN HELPERS
// =============================================================================

/**
 * Get a plan by name (case-insensitive)
 */
export async function getPlanByName(
    config: PaymentRouteConfig,
    planName: string
): Promise<PaymentPlan | undefined> {
    const plans = await config.getPlans()
    return plans.find(p => p.name.toLowerCase() === planName.toLowerCase())
}

/**
 * Get a plan by price ID or lookup key
 */
export async function getPlanByPriceInfo(
    config: PaymentRouteConfig,
    priceId: string,
    lookupKey?: string | null
): Promise<PaymentPlan | undefined> {
    const plans = await config.getPlans()
    return plans.find(p => {
        if (p.priceId === priceId) return true
        if (p.annualPriceId === priceId) return true
        if (lookupKey && p.lookupKey === lookupKey) return true
        if (lookupKey && p.annualLookupKey === lookupKey) return true
        return false
    })
}

// =============================================================================
// REFERENCE AUTHORIZATION MIDDLEWARE
// =============================================================================

export type ReferenceAction =
    | "upgrade-subscription"
    | "list-subscription"
    | "cancel-subscription"
    | "restore-subscription"
    | "billing-portal"

/**
 * Create middleware to authorize reference IDs for subscription actions
 */
export function createReferenceMiddleware(
    subscriptionOptions: SubscriptionOptions | undefined,
    action: ReferenceAction
) {
    return async (ctx: EndpointContext) => {
        if (!ctx.user) {
            throw new EndpointError("UNAUTHORIZED", { message: "Authentication required" })
        }

        const referenceId = (ctx.body as any)?.referenceId || (ctx.query as any)?.referenceId || ctx.user.id

        if (referenceId !== ctx.user.id && !subscriptionOptions?.authorizeReference) {
            getLogger().error(
                `Passing referenceId into a subscription action isn't allowed if subscription.authorizeReference isn't defined.`
            )
            throw new EndpointError("BAD_REQUEST", {
                message: "Reference id is not allowed without authorizeReference configured",
            })
        }

        const sameReference = referenceId === ctx.user.id

        if (referenceId !== ctx.user.id && subscriptionOptions?.authorizeReference) {
            const isAuthorized = await subscriptionOptions.authorizeReference(
                {
                    user: ctx.user,
                    session: (ctx as any).session,
                    referenceId,
                    action,
                },
                ctx as any
            )

            if (!isAuthorized && !sameReference) {
                throw new EndpointError("FORBIDDEN", { message: "Not authorized for this reference" })
            }
        }
    }
}
