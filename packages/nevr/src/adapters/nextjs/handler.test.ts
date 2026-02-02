// =============================================================================
// NEXT.JS HANDLER TESTS
// Tests for the Next.js route handler adapter
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { toNextHandler, createNextHandler } from "./handler.js"
import type { NevrInstance, NevrRequest, NevrResponse } from "../../types.js"

// -----------------------------------------------------------------------------
// Mock Nevr Instance
// -----------------------------------------------------------------------------

function createMockNevr(): NevrInstance {
    return {
        handleRequest: vi.fn(async (req: NevrRequest): Promise<NevrResponse> => {
            // Return the request data for inspection
            return {
                status: 200,
                body: {
                    method: req.method,
                    path: req.path,
                    body: req.body,
                    rawBody: req.rawBody,
                    headers: req.headers,
                    user: req.user,
                },
            }
        }),
        getDriver: vi.fn(() => ({})),
        getEntities: vi.fn(() => ({})),
        getRoutes: vi.fn(() => []),
    } as unknown as NevrInstance
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("Next.js Handler", () => {
    let mockNevr: NevrInstance

    beforeEach(() => {
        mockNevr = createMockNevr()
    })

    describe("toNextHandler", () => {
        it("should create route handlers for all HTTP methods", () => {
            const handlers = toNextHandler(mockNevr)

            expect(handlers.GET).toBeDefined()
            expect(handlers.POST).toBeDefined()
            expect(handlers.PUT).toBeDefined()
            expect(handlers.PATCH).toBeDefined()
            expect(handlers.DELETE).toBeDefined()
            expect(handlers.OPTIONS).toBeDefined()
        })

        it("should handle GET requests", async () => {
            const handlers = toNextHandler(mockNevr)

            const request = new Request("http://localhost:3000/api/test?foo=bar", {
                method: "GET",
            })

            const response = await handlers.GET(request)
            const data = await response.json()

            expect(data.method).toBe("GET")
            expect(data.path).toBe("/test")
        })

        it("should handle POST requests and preserve rawBody", async () => {
            const handlers = toNextHandler(mockNevr)

            const jsonBody = JSON.stringify({ name: "test", value: 123 })
            const request = new Request("http://localhost:3000/api/webhook", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: jsonBody,
            })

            const response = await handlers.POST(request)
            const data = await response.json()

            expect(data.method).toBe("POST")
            expect(data.path).toBe("/webhook")
            expect(data.body).toEqual({ name: "test", value: 123 })
            // rawBody should be preserved for webhook signature verification
            expect(data.rawBody).toBe(jsonBody)
        })

        it("should parse headers correctly", async () => {
            const handlers = toNextHandler(mockNevr)

            const request = new Request("http://localhost:3000/api/test", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "X-Custom-Header": "custom-value",
                    "stripe-signature": "test-sig",
                },
            })

            const response = await handlers.GET(request)
            const data = await response.json()

            expect(data.headers["content-type"]).toBe("application/json")
            expect(data.headers["x-custom-header"]).toBe("custom-value")
            expect(data.headers["stripe-signature"]).toBe("test-sig")
        })

        it("should call getUser when provided", async () => {
            const mockUser = { id: "user-123", email: "test@example.com", role: "admin" }
            const handlers = toNextHandler(mockNevr, {
                getUser: async () => mockUser,
            })

            const request = new Request("http://localhost:3000/api/protected", {
                method: "GET",
            })

            const response = await handlers.GET(request)
            const data = await response.json()

            expect(data.user).toEqual(mockUser)
        })

        it("should strip basePath from URL", async () => {
            const handlers = toNextHandler(mockNevr, {
                basePath: "/api/v1",
            })

            const request = new Request("http://localhost:3000/api/v1/users", {
                method: "GET",
            })

            const response = await handlers.GET(request)
            const data = await response.json()

            expect(data.path).toBe("/users")
        })

        it("should handle OPTIONS preflight requests with CORS headers", async () => {
            const handlers = toNextHandler(mockNevr)

            const request = new Request("http://localhost:3000/api/test", {
                method: "OPTIONS",
                headers: {
                    "Origin": "http://localhost:3001",
                },
            })

            const response = await handlers.OPTIONS(request)

            // OPTIONS returns 204 No Content with CORS headers
            expect(response.status).toBe(204)
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001")
            expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET")
            expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST")
        })
    })

    describe("createNextHandler", () => {
        it("should return a single handler function", async () => {
            const handler = createNextHandler(mockNevr)

            // Should be a function
            expect(typeof handler).toBe("function")

            // Should work like the GET handler
            const request = new Request("http://localhost:3000/api/test", {
                method: "GET",
            })

            const response = await handler(request)
            const data = await response.json()

            expect(data.method).toBe("GET")
        })
    })
})
