// =============================================================================
// PAYMENT INTERNAL ADAPTER
// Database operations for payment plugin
// =============================================================================

import type { Driver } from "../../../types.js"
import type { PaymentAdapter, Subscription } from "../types.js"
import { generateId } from "../../auth/crypto/index.js"

// -----------------------------------------------------------------------------
// Internal Adapter Factory
// -----------------------------------------------------------------------------

/**
 * Create internal adapter for payment database operations
 * Follows better-auth patterns with referenceId for multi-tenant support
 */
export function createPaymentAdapter(driver: Driver): PaymentAdapter {
    return {
        // -------------------------------------------------------------------------
        // Subscription Operations
        // -------------------------------------------------------------------------

        async findSubscriptionById(id: string): Promise<Subscription | null> {
            return driver.findOne<Subscription>("subscription", { id })
        },

        async findSubscriptionByProviderId(providerSubscriptionId: string): Promise<Subscription | null> {
            return driver.findOne<Subscription>("subscription", {
                stripeSubscriptionId: providerSubscriptionId,
            })
        },

        async findSubscriptionsByReferenceId(referenceId: string): Promise<Subscription[]> {
            return driver.findMany<Subscription>("subscription", {
                where: { referenceId },
            })
        },

        async findActiveSubscription(referenceId: string): Promise<Subscription | null> {
            const subscriptions = await driver.findMany<Subscription>("subscription", {
                where: { referenceId },
            })

            // Find active or trialing subscription (better-auth pattern)
            return subscriptions.find(
                sub => sub.status === "active" || sub.status === "trialing"
            ) || null
        },

        async createSubscription(
            data: Omit<Subscription, "id" | "createdAt" | "updatedAt">
        ): Promise<Subscription> {
            const now = new Date()
            return driver.create<Subscription>("subscription", {
                id: generateId(),
                ...data,
                createdAt: now,
                updatedAt: now,
            })
        },

        async updateSubscription(
            id: string,
            data: Partial<Subscription>
        ): Promise<Subscription | null> {
            return driver.update<Subscription>("subscription", { id }, {
                ...data,
                updatedAt: new Date(),
            })
        },

        async deleteSubscription(id: string): Promise<void> {
            await driver.delete("subscription", { id })
        },

        async deleteSubscriptionsByReferenceId(referenceId: string): Promise<void> {
            // Get all subscriptions for this reference
            const subscriptions = await driver.findMany<Subscription>("subscription", {
                where: { referenceId },
            })

            // Delete each one
            for (const sub of subscriptions) {
                await driver.delete("subscription", { id: sub.id })
            }
        },
    }
}

// -----------------------------------------------------------------------------
// User Operations (for stripeCustomerId on user entity)
// -----------------------------------------------------------------------------

export interface UserWithStripeCustomer {
    id: string
    email: string
    name?: string
    stripeCustomerId?: string | null
    [key: string]: unknown
}

/**
 * Update user's stripeCustomerId
 */
export async function updateUserStripeCustomerId(
    driver: Driver,
    userId: string,
    stripeCustomerId: string
): Promise<void> {
    await driver.update("user", { id: userId }, { stripeCustomerId })
}

/**
 * Get user with stripeCustomerId
 */
export async function getUserWithStripeCustomer(
    driver: Driver,
    userId: string
): Promise<UserWithStripeCustomer | null> {
    return driver.findOne<UserWithStripeCustomer>("user", { id: userId })
}

/**
 * Get user's stripeCustomerId
 */
export async function getUserStripeCustomerId(
    driver: Driver,
    userId: string
): Promise<string | null> {
    const user = await driver.findOne<{ stripeCustomerId?: string }>("user", { id: userId })
    return user?.stripeCustomerId || null
}
