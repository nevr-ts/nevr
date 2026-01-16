// =============================================================================
// PAYMENT PLUGIN SCHEMA
// Entity definitions for payment/subscription management
// Follows better-auth stripe schema patterns
// =============================================================================

import { string, int, bool, datetime, json } from "../../index.js"
import type { PluginSchema } from "../unified/types.js"

// -----------------------------------------------------------------------------
// Schema Export
// -----------------------------------------------------------------------------

/**
 * Get the payment plugin schema
 *
 * Follows better-auth patterns:
 * - User entity extended with stripeCustomerId
 * - Subscription entity with referenceId for multi-tenant support
 *
 * @param options Schema options
 * @returns Plugin schema with entities and extensions
 */
export function getPaymentSchema(options?: {
    /** Enable subscription entity (default: true) */
    subscription?: boolean
}): PluginSchema {
    const enableSubscription = options?.subscription !== false

    const schema: PluginSchema = {
        // Extend user entity with stripeCustomerId (better-auth pattern)
        extend: {
            user: {
                stripeCustomerId: string.optional().omit().label("Stripe Customer ID"),
            },
        },
        entities: {},
    }

    // Add subscription entity if enabled
    if (enableSubscription) {
        schema.entities = {
            subscription: {
                description: "Subscription record for payment plans",
                fields: {
                    // Plan information
                    plan: string.label("Plan Name"),

                    // Reference ID (userId, workspaceId, organizationId, etc.)
                    // This is the key for multi-tenant subscriptions (better-auth pattern)
                    referenceId: string.label("Reference ID"),

                    // Provider-specific IDs
                    stripeCustomerId: string.optional().omit().label("Stripe Customer ID"),
                    stripeSubscriptionId: string.optional().omit().label("Stripe Subscription ID"),
                    priceId: string.optional().omit().label("Price ID"),

                    // Subscription status
                    status: string
                        .options([
                            "active",
                            "canceled",
                            "incomplete",
                            "incomplete_expired",
                            "past_due",
                            "paused",
                            "trialing",
                            "unpaid",
                        ])
                        .default("incomplete")
                        .label("Status"),

                    // Billing period
                    periodStart: datetime.optional().label("Period Start"),
                    periodEnd: datetime.optional().label("Period End"),

                    // Trial period
                    trialStart: datetime.optional().label("Trial Start"),
                    trialEnd: datetime.optional().label("Trial End"),

                    // Cancellation
                    cancelAtPeriodEnd: bool.default(false).label("Cancel at Period End"),

                    // Team/seats support (better-auth pattern)
                    seats: int.optional().label("Number of Seats"),

                    // Group ID for multiple subscriptions per reference (better-auth pattern)
                    groupId: string.optional().label("Group ID"),
                },
            },
        }
    }

    return schema
}

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default getPaymentSchema
