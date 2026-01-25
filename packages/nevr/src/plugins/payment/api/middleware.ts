// =============================================================================
// PAYMENT MIDDLEWARE
// Reference authorization and session middleware
// =============================================================================

import { createMiddleware, EndpointError } from "../../unified/endpoint.js"
import type { EndpointContext } from "../../unified/endpoint.js"
import type { SubscriptionOptions, AuthorizeReferenceData } from "../types.js"
import { getLogger } from "../../../logger.js"

// -----------------------------------------------------------------------------
// Extended Context Type
// -----------------------------------------------------------------------------

export interface PaymentEndpointContext extends EndpointContext {
    session?: { user: any; [key: string]: unknown }
    referenceId?: string
}

// -----------------------------------------------------------------------------
// Reference Middleware
// Validates that user has access to the given referenceId
// Follows better-auth referenceMiddleware pattern
// -----------------------------------------------------------------------------

export type ReferenceAction =
    | "upgrade-subscription"
    | "list-subscription"
    | "cancel-subscription"
    | "restore-subscription"
    | "billing-portal"

/**
 * Create reference authorization middleware
 *
 * This middleware:
 * 1. Ensures user is authenticated
 * 2. Validates referenceId access if provided
 * 3. Falls back to user.id if no referenceId
 *
 * @example
 * ```typescript
 * const subscriptionRoutes = endpoint("/subscription/upgrade", {
 *   method: "POST",
 *   use: [referenceMiddleware(options.subscription, "upgrade-subscription")],
 *   handler: async (ctx) => {
 *     const referenceId = ctx.body.referenceId || ctx.user.id
 *     // ...
 *   },
 * })
 * ```
 */
export function createReferenceMiddleware(
    subscriptionOptions: SubscriptionOptions | undefined,
    action: ReferenceAction
) {
    return createMiddleware(async (ctx) => {
        const paymentCtx = ctx as PaymentEndpointContext

        // Ensure user is authenticated
        const session = paymentCtx.session || (paymentCtx.context as any)?.session
        const user = paymentCtx.user || session?.user

        if (!session || !user) {
            throw new EndpointError("UNAUTHORIZED", {
                message: "Authentication required",
            })
        }

        // Get referenceId from body or query
        const body = paymentCtx.body as Record<string, unknown> | undefined
        const query = paymentCtx.query as Record<string, unknown> | undefined
        const referenceId = (body?.referenceId || query?.referenceId || user.id) as string

        // If referenceId is different from user.id, check authorization
        if (referenceId !== user.id) {
            // authorizeReference is required when using referenceId
            if (!subscriptionOptions?.authorizeReference) {
                getLogger().error(
                    `[Payment] Passing referenceId into a subscription action isn't allowed if subscription.authorizeReference isn't defined.`
                )
                throw new EndpointError("BAD_REQUEST", {
                    message: "Reference ID is not allowed. Configure authorizeReference in plugin options.",
                })
            }

            // Call authorization function
            const isAuthorized = await subscriptionOptions.authorizeReference(
                {
                    user,
                    session,
                    referenceId,
                    action,
                } as AuthorizeReferenceData,
                ctx as any
            )

            if (!isAuthorized) {
                throw new EndpointError("FORBIDDEN", {
                    message: "Not authorized to access this subscription",
                })
            }
        }

        // Add validated referenceId to context
        paymentCtx.referenceId = referenceId
    })
}

// -----------------------------------------------------------------------------
// Session Middleware
// Ensures user is authenticated
// -----------------------------------------------------------------------------

export const sessionMiddleware = createMiddleware(async (ctx) => {
    const paymentCtx = ctx as PaymentEndpointContext

    const session = paymentCtx.session || (paymentCtx.context as any)?.session
    const user = paymentCtx.user || session?.user

    if (!session || !user) {
        throw new EndpointError("UNAUTHORIZED", {
            message: "Authentication required",
        })
    }

    // Ensure ctx has user and session
    ;(paymentCtx as any).user = user
    paymentCtx.session = session
})

// -----------------------------------------------------------------------------
// Email Verification Middleware
// Ensures user's email is verified (for subscription operations)
// -----------------------------------------------------------------------------

export function createEmailVerificationMiddleware(requireEmailVerification?: boolean) {
    return createMiddleware(async (ctx) => {
        if (!requireEmailVerification) return

        const paymentCtx = ctx as PaymentEndpointContext
        const user = paymentCtx.user || paymentCtx.session?.user || (paymentCtx.context as any)?.session?.user

        if (!user?.emailVerified) {
            throw new EndpointError("BAD_REQUEST", {
                code: "EMAIL_VERIFICATION_REQUIRED",
                message: "Email verification is required before you can subscribe to a plan",
            })
        }
    })
}
