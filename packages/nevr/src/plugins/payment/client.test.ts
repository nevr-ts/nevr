// =============================================================================
// PAYMENT CLIENT PLUGIN TEST
// Tests for payment client plugin pattern and type inference
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { paymentClient, type PaymentClientPlugin } from "./client.js"

describe("Payment Client Plugin", () => {
    describe("Plugin Structure", () => {
        it("should have required plugin properties", () => {
            const client = paymentClient()

            expect(client.id).toBe("payment-client")
            expect(client.pathMethods).toBeDefined()
            expect(client.getAtoms).toBeDefined()
            expect(client.getActions).toBeDefined()
            expect(client.atomListeners).toBeDefined()
            expect(client.$InferTypes).toBeDefined()
        })

        it("should have correct $InferTypes structure", () => {
            const client = paymentClient()
            const infer = client.$InferTypes

            expect(infer).toHaveProperty("endpoints")
            expect(infer).toHaveProperty("$ERROR_CODES")
            expect(infer).toHaveProperty("Subscription")
            expect(infer).toHaveProperty("PaymentPlan")
        })

        it("should have pathMethods for all endpoints", () => {
            const client = paymentClient()
            const methods = client.pathMethods

            // Subscription endpoints
            expect(methods["/payment/subscription/upgrade"]).toBe("POST")
            expect(methods["/payment/subscription/cancel"]).toBe("POST")
            expect(methods["/payment/subscription/restore"]).toBe("POST")
            expect(methods["/payment/subscription/list"]).toBe("GET")
            expect(methods["/payment/subscription/billing-portal"]).toBe("POST")

            // Webhook
            expect(methods["/payment/webhook/stripe"]).toBe("POST")
        })

        it("should support custom basePath", () => {
            const client = paymentClient({ basePath: "/api/billing" })

            expect(client.pathMethods["/api/billing/subscription/upgrade"]).toBe("POST")
            expect(client.pathMethods["/api/billing/subscription/list"]).toBe("GET")
        })
    })

    describe("getAtoms", () => {
        it("should create reactive atoms", () => {
            const client = paymentClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: [], error: null })

            const atoms = client.getAtoms!(mockFetch as any)

            expect(atoms).toHaveProperty("subscriptions")
            expect(atoms).toHaveProperty("$subSignal")
        })

        it("should initialize with correct state", () => {
            const client = paymentClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: [], error: null })

            const atoms = client.getAtoms!(mockFetch as any)
            const subs = atoms.subscriptions.get()

            expect(subs.subscriptions).toEqual([])
            expect(subs.isPending).toBe(true)
        })

        it("should fetch subscriptions on init", async () => {
            const client = paymentClient()
            const mockFetch = vi.fn().mockResolvedValue({
                data: [{ id: "sub_1", plan: "pro", status: "active" }],
                error: null
            })

            client.getAtoms!(mockFetch as any)

            // Wait for async fetch
            await new Promise(resolve => setTimeout(resolve, 10))

            expect(mockFetch).toHaveBeenCalledWith(
                "/payment/subscription/list",
                expect.objectContaining({ method: "GET" })
            )
        })
    })

    describe("getActions", () => {
        let mockFetch: ReturnType<typeof vi.fn>
        let mockStore: any
        let client: PaymentClientPlugin
        let actions: ReturnType<NonNullable<PaymentClientPlugin["getActions"]>>

        beforeEach(() => {
            mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })
            mockStore = { atoms: {} }
            client = paymentClient()

            // Initialize atoms first
            client.getAtoms!(mockFetch as any)

            // Get actions
            actions = client.getActions!(mockFetch as any, mockStore)
        })

        it("should have payment.subscription methods", () => {
            expect(actions.payment).toBeDefined()
            expect(actions.payment.subscription).toBeDefined()
            expect(actions.payment.subscription.upgrade).toBeDefined()
            expect(actions.payment.subscription.cancel).toBeDefined()
            expect(actions.payment.subscription.restore).toBeDefined()
            expect(actions.payment.subscription.list).toBeDefined()
            expect(actions.payment.subscription.billingPortal).toBeDefined()
        })

        it("upgrade should call POST with correct body", async () => {
            mockFetch.mockResolvedValueOnce({
                data: { url: "https://checkout.stripe.com/...", redirect: true },
                error: null
            })

            await actions.payment.subscription.upgrade({
                plan: "pro",
                successUrl: "/success",
                cancelUrl: "/cancel"
            })

            expect(mockFetch).toHaveBeenCalledWith(
                "/payment/subscription/upgrade",
                expect.objectContaining({
                    method: "POST",
                    body: expect.objectContaining({
                        plan: "pro",
                        successUrl: "/success"
                    })
                })
            )
        })

        it("list should call GET", async () => {
            mockFetch.mockResolvedValueOnce({
                data: [{ id: "sub_1", plan: "pro" }],
                error: null
            })

            await actions.payment.subscription.list()

            expect(mockFetch).toHaveBeenCalledWith(
                "/payment/subscription/list",
                expect.objectContaining({ method: "GET" })
            )
        })

        it("cancel should call POST with returnUrl", async () => {
            mockFetch.mockResolvedValueOnce({
                data: { url: "https://billing.stripe.com/...", redirect: true },
                error: null
            })

            await actions.payment.subscription.cancel({ returnUrl: "/account" })

            expect(mockFetch).toHaveBeenCalledWith(
                "/payment/subscription/cancel",
                expect.objectContaining({
                    method: "POST",
                    body: expect.objectContaining({ returnUrl: "/account" })
                })
            )
        })

        it("restore should call POST", async () => {
            mockFetch.mockResolvedValueOnce({
                data: { id: "sub_1", status: "active" },
                error: null
            })

            await actions.payment.subscription.restore()

            expect(mockFetch).toHaveBeenCalledWith(
                "/payment/subscription/restore",
                expect.objectContaining({
                    method: "POST",
                    body: {}
                })
            )
        })

        it("billingPortal should call POST", async () => {
            mockFetch.mockResolvedValueOnce({
                data: { url: "https://billing.stripe.com/portal/...", redirect: true },
                error: null
            })

            await actions.payment.subscription.billingPortal({ returnUrl: "/settings" })

            expect(mockFetch).toHaveBeenCalledWith(
                "/payment/subscription/billing-portal",
                expect.objectContaining({
                    method: "POST",
                    body: expect.objectContaining({ returnUrl: "/settings" })
                })
            )
        })
    })

    describe("atomListeners", () => {
        it("should trigger on subscription-changing actions", () => {
            const client = paymentClient()
            const listeners = client.atomListeners!

            expect(listeners.length).toBeGreaterThan(0)

            const matcher = listeners[0].matcher

            // Should trigger on these paths
            expect(matcher("/payment/subscription/upgrade")).toBe(true)
            expect(matcher("/payment/subscription/cancel")).toBe(true)
            expect(matcher("/payment/subscription/restore")).toBe(true)

            // Should not trigger on these paths
            expect(matcher("/payment/subscription/list")).toBe(false)
            expect(matcher("/payment/subscription/billing-portal")).toBe(false)
        })
    })
})
