// =============================================================================
// PAYMENT PLUGIN TESTS
// Tests for subscription routes: upgrade, cancel, restore, list, billing-portal
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
    upgradeSubscription,
    cancelSubscription,
    restoreSubscription,
    listActiveSubscriptions,
    createBillingPortal,
} from "./api/routes/index.js"
import type { EndpointContext } from "../unified/endpoint.js"
import type { PaymentRouteConfig, Subscription, PaymentPlan, PaymentProvider } from "./types.js"
import type { User } from "../../types.js"

// =============================================================================
// MOCK PROVIDER
// =============================================================================

const mockProvider: PaymentProvider = {
    createCustomer: vi.fn(),
    getCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    listCustomersByEmail: vi.fn(),
    createCheckoutSession: vi.fn(),
    getSubscription: vi.fn(),
    listSubscriptions: vi.fn(),
    updateSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    createBillingPortalSession: vi.fn(),
    resolvePriceId: vi.fn(),
    constructWebhookEvent: vi.fn(),
}

// =============================================================================
// MOCK DRIVER (used by internal adapter)
// =============================================================================

const mockDriver = {
    // The internal adapter uses findOne and findMany
    findOne: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}

// =============================================================================
// MOCK CONFIG
// =============================================================================

const mockPlans: PaymentPlan[] = [
    { name: "free", priceId: "price_free" },
    { name: "pro", priceId: "price_pro", annualPriceId: "price_pro_annual", limits: { projects: 10 } },
    { name: "enterprise", priceId: "price_enterprise", limits: { projects: -1 } },
]

const mockConfig: PaymentRouteConfig = {
    options: {
        provider: "stripe",
        stripe: {
            secretKey: "sk_test_xxx",
            webhookSecret: "whsec_xxx",
        },
        subscription: {
            enabled: true,
            plans: mockPlans,
            authorizeReference: async ({ user, referenceId }) => {
                // Admin can access anything, users can only access their own
                return user.id === referenceId || user.id === "admin-user"
            },
        },
    },
    getProvider: () => mockProvider,
    getPlans: async () => mockPlans,
}

// =============================================================================
// MOCK CONTEXT HELPER
// =============================================================================

function createMockContext(
    user?: Partial<User> & { stripeCustomerId?: string },
    body: any = {},
    query: any = {}
): EndpointContext {
    return {
        user: user ? { id: "user-1", role: "user", ...user } as any : null,
        body,
        query,
        params: {},
        driver: mockDriver as any,
        json: (data: any) => ({ status: 200, body: data }),
        redirect: (url: string) => ({ status: 302, headers: { location: url } }),
        context: { options: { baseURL: "http://localhost:3000" } },
    } as unknown as EndpointContext
}


// =============================================================================
// TESTS
// =============================================================================

describe("Payment Plugin Endpoints", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // =========================================================================
    // UPGRADE SUBSCRIPTION
    // =========================================================================

    describe("upgradeSubscription", () => {
        it("should create checkout session for new subscription", async () => {
            const endpoint = upgradeSubscription(mockConfig)
            const ctx = createMockContext(
                { id: "user-1", email: "user@test.com" },
                { plan: "pro", successUrl: "/success", cancelUrl: "/cancel" }
            )

            // Mock: no existing customer/subscription
            mockProvider.listCustomersByEmail = vi.fn().mockResolvedValue([])
            mockProvider.createCustomer = vi.fn().mockResolvedValue({ id: "cus_new" })
            mockProvider.listSubscriptions = vi.fn().mockResolvedValue([])
            mockProvider.createCheckoutSession = vi.fn().mockResolvedValue({
                id: "cs_123",
                url: "https://checkout.stripe.com/xxx",
            })
            mockDriver.findFirst = vi.fn().mockResolvedValue(null)
            mockDriver.findMany = vi.fn().mockResolvedValue([])
            mockDriver.create = vi.fn().mockResolvedValue({ id: "sub-1", status: "incomplete" })
            mockDriver.update = vi.fn().mockResolvedValue({ id: "user-1" })

            const response = await endpoint.handler(ctx)

            expect(mockProvider.createCheckoutSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: "cus_new",
                    mode: "subscription",
                })
            )
            expect((response as any).body).toHaveProperty("url")
            expect((response as any).body.redirect).toBe(true)
        })

        it("should fail if plan not found", async () => {
            const endpoint = upgradeSubscription(mockConfig)
            const ctx = createMockContext(
                { id: "user-1", email: "user@test.com" },
                { plan: "nonexistent", successUrl: "/success" }
            )

            await expect(endpoint.handler(ctx)).rejects.toThrow("Subscription plan not found")
        })

        it("should fail if user not authenticated", async () => {
            const endpoint = upgradeSubscription(mockConfig)
            const ctx = createMockContext(undefined, { plan: "pro" })

            await expect(endpoint.handler(ctx)).rejects.toThrow("UNAUTHORIZED")
        })

        it("should fail if already on same plan", async () => {
            const endpoint = upgradeSubscription(mockConfig)
            const ctx = createMockContext(
                { id: "user-1", email: "user@test.com", stripeCustomerId: "cus_123" },
                { plan: "pro", successUrl: "/success" }
            )

            // Mock: existing active subscription on same plan
            mockDriver.findFirst = vi.fn().mockResolvedValue(null)
            mockDriver.findMany = vi.fn().mockResolvedValue([
                { id: "sub-1", plan: "pro", status: "active", referenceId: "user-1", seats: 1, stripeCustomerId: "cus_123" }
            ])
            mockProvider.listSubscriptions = vi.fn().mockResolvedValue([])

            await expect(endpoint.handler(ctx)).rejects.toThrow("already subscribed")
        })
    })

    // =========================================================================
    // CANCEL SUBSCRIPTION
    // =========================================================================

    describe("cancelSubscription", () => {
        it("should create billing portal for cancellation", async () => {
            const endpoint = cancelSubscription(mockConfig)
            const ctx = createMockContext(
                { id: "user-1", stripeCustomerId: "cus_123" },
                { returnUrl: "/account" }
            )

            // Mock: findActiveSubscription uses findMany then filters
            mockDriver.findMany = vi.fn().mockResolvedValue([
                {
                    id: "sub-1",
                    status: "active",
                    stripeCustomerId: "cus_123",
                    stripeSubscriptionId: "stripe_sub_1",
                    referenceId: "user-1",
                }
            ])
            mockDriver.findOne = vi.fn().mockResolvedValue(null) // for findSubscriptionById
            mockProvider.listSubscriptions = vi.fn().mockResolvedValue([
                { id: "stripe_sub_1", status: "active" }
            ])
            mockProvider.createBillingPortalSession = vi.fn().mockResolvedValue({
                url: "https://billing.stripe.com/portal/xxx"
            })

            const response = await endpoint.handler(ctx)

            expect(mockProvider.createBillingPortalSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: "cus_123",
                })
            )
            expect((response as any).body.url).toContain("billing.stripe.com")
        })

        it("should fail if no active subscription", async () => {
            const endpoint = cancelSubscription(mockConfig)
            const ctx = createMockContext(
                { id: "user-1" },
                { returnUrl: "/account" }
            )

            mockDriver.findOne = vi.fn().mockResolvedValue(null)
            mockDriver.findMany = vi.fn().mockResolvedValue([])

            await expect(endpoint.handler(ctx)).rejects.toThrow("not found")
        })
    })

    // =========================================================================
    // RESTORE SUBSCRIPTION
    // =========================================================================

    describe("restoreSubscription", () => {
        it("should restore a subscription scheduled for cancellation", async () => {
            const endpoint = restoreSubscription(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, {})

            // Mock: findActiveSubscription finds subscription with cancelAtPeriodEnd: true
            mockDriver.findMany = vi.fn().mockResolvedValue([
                {
                    id: "sub-1",
                    status: "active",
                    cancelAtPeriodEnd: true,
                    stripeCustomerId: "cus_123",
                    stripeSubscriptionId: "stripe_sub_1",
                    referenceId: "user-1",
                }
            ])
            mockDriver.findOne = vi.fn().mockResolvedValue(null)
            mockProvider.listSubscriptions = vi.fn().mockResolvedValue([
                { id: "stripe_sub_1", status: "active" }
            ])
            mockProvider.updateSubscription = vi.fn().mockResolvedValue({
                id: "stripe_sub_1",
                status: "active",
                cancelAtPeriodEnd: false,
            })
            mockDriver.update = vi.fn().mockResolvedValue({ id: "sub-1" })

            const response = await endpoint.handler(ctx)

            expect(mockProvider.updateSubscription).toHaveBeenCalledWith(
                "stripe_sub_1",
                expect.objectContaining({ cancelAtPeriodEnd: false })
            )
        })

        it("should fail if subscription not scheduled for cancellation", async () => {
            const endpoint = restoreSubscription(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, {})

            mockDriver.findOne = vi.fn().mockResolvedValue(null)
            mockDriver.findMany = vi.fn().mockResolvedValue([
                {
                    id: "sub-1",
                    status: "active",
                    cancelAtPeriodEnd: false,
                    stripeCustomerId: "cus_123",
                    referenceId: "user-1",
                }
            ])

            await expect(endpoint.handler(ctx)).rejects.toThrow("not scheduled for cancellation")
        })
    })

    // =========================================================================
    // LIST ACTIVE SUBSCRIPTIONS
    // =========================================================================

    describe("listActiveSubscriptions", () => {
        it("should return active subscriptions with plan limits", async () => {
            const endpoint = listActiveSubscriptions(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, {}, {})

            mockDriver.findMany = vi.fn().mockResolvedValue([
                { id: "sub-1", plan: "pro", status: "active", referenceId: "user-1" },
                { id: "sub-2", plan: "pro", status: "canceled", referenceId: "user-1" },
            ])

            const response = await endpoint.handler(ctx)
            const subs = (response as any).body

            expect(subs.length).toBe(1)
            expect(subs[0].plan).toBe("pro")
            expect(subs[0].limits).toEqual({ projects: 10 })
        })

        it("should return empty array if no subscriptions", async () => {
            const endpoint = listActiveSubscriptions(mockConfig)
            const ctx = createMockContext({ id: "user-1" }, {}, {})

            mockDriver.findMany = vi.fn().mockResolvedValue([])

            const response = await endpoint.handler(ctx)

            expect((response as any).body).toEqual([])
        })

        it("should support referenceId for multi-tenant", async () => {
            const endpoint = listActiveSubscriptions(mockConfig)
            const ctx = createMockContext(
                { id: "admin-user" },
                {},
                { referenceId: "org-1" }
            )

            mockDriver.findMany = vi.fn().mockResolvedValue([
                { id: "sub-1", plan: "enterprise", status: "active", referenceId: "org-1" }
            ])

            const response = await endpoint.handler(ctx)

            expect(mockDriver.findMany).toHaveBeenCalled()
            expect((response as any).body[0].referenceId).toBe("org-1")
        })
    })

    // =========================================================================
    // BILLING PORTAL
    // =========================================================================

    describe("createBillingPortal", () => {
        it("should create billing portal session", async () => {
            const endpoint = createBillingPortal(mockConfig)
            const ctx = createMockContext(
                { id: "user-1", stripeCustomerId: "cus_123" },
                { returnUrl: "/settings" }
            )

            mockProvider.createBillingPortalSession = vi.fn().mockResolvedValue({
                url: "https://billing.stripe.com/portal/xxx"
            })

            const response = await endpoint.handler(ctx)

            expect(mockProvider.createBillingPortalSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: "cus_123",
                    returnUrl: expect.stringContaining("/settings"),
                })
            )
            expect((response as any).body.url).toContain("stripe.com")
        })

        it("should fail if no stripe customer", async () => {
            const endpoint = createBillingPortal(mockConfig)
            const ctx = createMockContext(
                { id: "user-1" }, // no stripeCustomerId
                { returnUrl: "/settings" }
            )

            mockDriver.findOne = vi.fn().mockResolvedValue(null)
            mockDriver.findMany = vi.fn().mockResolvedValue([])

            await expect(endpoint.handler(ctx)).rejects.toThrow("No Stripe customer")
        })
    })

    // =========================================================================
    // ERROR HANDLING
    // =========================================================================

    describe("Error Handling", () => {
        it("should handle unauthenticated requests", async () => {
            const endpoints = [
                upgradeSubscription(mockConfig),
                cancelSubscription(mockConfig),
                restoreSubscription(mockConfig),
                listActiveSubscriptions(mockConfig),
                createBillingPortal(mockConfig),
            ]

            for (const endpoint of endpoints) {
                const ctx = createMockContext(undefined, {})
                await expect(endpoint.handler(ctx)).rejects.toThrow("UNAUTHORIZED")
            }
        })

        // Note: Authorization of referenceId is tested at integration level
        // since it requires the full middleware stack to be wired up
    })
})

