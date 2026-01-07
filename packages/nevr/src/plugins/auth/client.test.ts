// =============================================================================
// AUTH CLIENT TESTS
// Tests for the auth client plugin
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { authClient } from "./client.js"
import type { NevrFetch, NevrFetchResponse } from "../../client/types.js"

// Mock fetch function
function createMockFetch(responses: Record<string, any>): NevrFetch {
    return vi.fn(async (path: string, options?: any) => {
        const response = responses[path]
        if (typeof response === "function") {
            return response(options)
        }
        return response || { data: null, error: null }
    }) as unknown as NevrFetch
}

describe("Auth Client Plugin", () => {
    describe("Plugin Creation", () => {
        it("should create client plugin with default options", () => {
            const plugin = authClient()

            expect(plugin).toBeDefined()
            expect(plugin.id).toBe("auth-client")
            expect(plugin.pathMethods).toBeDefined()
            expect(plugin.getActions).toBeDefined()
            expect(plugin.getAtoms).toBeDefined()
        })

        it("should have correct path methods", () => {
            const plugin = authClient()

            expect(plugin.pathMethods).toEqual({
                "/auth/sign-up/email": "POST",
                "/auth/sign-in/email": "POST",
                "/auth/sign-out": "POST",
                "/auth/get-session": "GET",
                "/auth/list-sessions": "GET",
                "/auth/revoke-session": "POST",
                "/auth/revoke-sessions": "POST",
                "/auth/revoke-other-sessions": "POST",
                "/auth/update-user": "POST",
                "/auth/change-password": "POST",
                "/auth/change-email": "POST",
                "/auth/delete-user": "POST",
                "/auth/link-social": "POST",
            })
        })

        it("should use custom basePath", () => {
            const plugin = authClient({ basePath: "/api/auth" })

            expect(plugin.pathMethods).toEqual({
                "/api/auth/sign-up/email": "POST",
                "/api/auth/sign-in/email": "POST",
                "/api/auth/sign-out": "POST",
                "/api/auth/get-session": "GET",
                "/api/auth/list-sessions": "GET",
                "/api/auth/revoke-session": "POST",
                "/api/auth/revoke-sessions": "POST",
                "/api/auth/revoke-other-sessions": "POST",
                "/api/auth/update-user": "POST",
                "/api/auth/change-password": "POST",
                "/api/auth/change-email": "POST",
                "/api/auth/delete-user": "POST",
                "/api/auth/link-social": "POST",
            })
        })

        it("should export $InferTypes for type inference", () => {
            const plugin = authClient()

            expect(plugin.$InferTypes).toBeDefined()
            expect(plugin.$InferTypes.$ERROR_CODES).toBeDefined()
            expect(plugin.$InferTypes.Session).toBeDefined()
            expect(plugin.$InferTypes.User).toBeDefined()
        })
    })

    describe("Actions", () => {
        it("should create signUp.email action", async () => {
            const mockFetch = createMockFetch({
                "/auth/sign-up/email": {
                    data: {
                        token: "test-token",
                        user: { id: "1", email: "test@example.com", name: "Test" },
                    },
                    error: null,
                },
                "/auth/get-session": {
                    data: null,
                    error: null,
                },
            })

            const plugin = authClient()
            const actions = plugin.getActions!(mockFetch, {} as any, {} as any)

            const result = await actions.signUp.email({
                name: "Test User",
                email: "test@example.com",
                password: "password123",
            })

            expect(result.data?.user.email).toBe("test@example.com")
            expect(result.data?.token).toBe("test-token")
            expect(mockFetch).toHaveBeenCalledWith("/auth/sign-up/email", {
                method: "POST",
                body: {
                    name: "Test User",
                    email: "test@example.com",
                    password: "password123",
                },
            })
        })

        it("should create signIn.email action", async () => {
            const mockFetch = createMockFetch({
                "/auth/sign-in/email": {
                    data: {
                        token: "test-token",
                        user: { id: "1", email: "test@example.com", name: "Test" },
                    },
                    error: null,
                },
                "/auth/get-session": {
                    data: null,
                    error: null,
                },
            })

            const plugin = authClient()
            const actions = plugin.getActions!(mockFetch, {} as any, {} as any)

            const result = await actions.signIn.email({
                email: "test@example.com",
                password: "password123",
            })

            expect(result.data?.user.email).toBe("test@example.com")
            expect(mockFetch).toHaveBeenCalledWith("/auth/sign-in/email", {
                method: "POST",
                body: {
                    email: "test@example.com",
                    password: "password123",
                },
            })
        })

        it("should create signOut action", async () => {
            const mockFetch = createMockFetch({
                "/auth/sign-out": {
                    data: { success: true },
                    error: null,
                },
            })

            const plugin = authClient()
            const actions = plugin.getActions!(mockFetch, {} as any, {} as any)

            const result = await actions.signOut()

            expect(result.data?.success).toBe(true)
            expect(mockFetch).toHaveBeenCalledWith("/auth/sign-out", {
                method: "POST",
            })
        })

        it("should create getSession action", async () => {
            const mockFetch = createMockFetch({
                "/auth/get-session": {
                    data: {
                        session: { id: "s1", token: "token", userId: "1" },
                        user: { id: "1", email: "test@example.com" },
                    },
                    error: null,
                },
            })

            const plugin = authClient()
            const actions = plugin.getActions!(mockFetch, {} as any, {} as any)

            const result = await actions.getSession()

            expect(result.data?.session.id).toBe("s1")
            expect(result.data?.user.email).toBe("test@example.com")
        })

        it("should create listSessions action", async () => {
            const mockFetch = createMockFetch({
                "/auth/list-sessions": {
                    data: {
                        sessions: [
                            { id: "s1", token: "t1", userId: "1" },
                            { id: "s2", token: "t2", userId: "1" },
                        ],
                    },
                    error: null,
                },
            })

            const plugin = authClient()
            const actions = plugin.getActions!(mockFetch, {} as any, {} as any)

            const result = await actions.listSessions()

            expect(result.data?.sessions).toHaveLength(2)
        })

        it("should create revokeSession action", async () => {
            const mockFetch = createMockFetch({
                "/auth/revoke-session": {
                    data: { status: true },
                    error: null,
                },
            })

            const plugin = authClient()
            const actions = plugin.getActions!(mockFetch, {} as any, {} as any)

            const result = await actions.revokeSession({ token: "token-to-revoke" })

            expect(result.data?.status).toBe(true)
            expect(mockFetch).toHaveBeenCalledWith("/auth/revoke-session", {
                method: "POST",
                body: { token: "token-to-revoke" },
            })
        })

        it("should create revokeSessions action", async () => {
            const mockFetch = createMockFetch({
                "/auth/revoke-sessions": {
                    data: { status: true },
                    error: null,
                },
            })

            const plugin = authClient()
            const actions = plugin.getActions!(mockFetch, {} as any, {} as any)

            const result = await actions.revokeSessions()

            expect(result.data?.status).toBe(true)
        })

        it("should create revokeOtherSessions action", async () => {
            const mockFetch = createMockFetch({
                "/auth/revoke-other-sessions": {
                    data: { status: true },
                    error: null,
                },
            })

            const plugin = authClient()
            const actions = plugin.getActions!(mockFetch, {} as any, {} as any)

            const result = await actions.revokeOtherSessions()

            expect(result.data?.status).toBe(true)
        })
    })

    describe("Atoms", () => {
        it("should create session atom", () => {
            const mockFetch = createMockFetch({
                "/auth/get-session": {
                    data: null,
                    error: null,
                },
            })

            const plugin = authClient()
            const atoms = plugin.getAtoms!(mockFetch)

            expect(atoms.session).toBeDefined()
            expect(atoms.$sessionSignal).toBeDefined()
        })

        it("should initialize session atom with isPending true", () => {
            const mockFetch = createMockFetch({
                "/auth/get-session": new Promise(() => { }), // Never resolves
            })

            const plugin = authClient()
            const atoms = plugin.getAtoms!(mockFetch)

            const state = atoms.session.get()
            expect(state.isPending).toBe(true)
            expect(state.data).toBeNull()
        })
    })

    describe("Atom Listeners", () => {
        it("should have atom listeners for auth actions", () => {
            const plugin = authClient()

            expect(plugin.atomListeners).toHaveLength(1)

            const listener = plugin.atomListeners![0]
            expect(listener.signal).toBe("$sessionSignal")

            // Test matcher
            expect(listener.matcher("/auth/sign-in/email")).toBe(true)
            expect(listener.matcher("/auth/sign-up/email")).toBe(true)
            expect(listener.matcher("/auth/sign-out")).toBe(true)
            expect(listener.matcher("/auth/revoke-sessions")).toBe(true)
            expect(listener.matcher("/auth/get-session")).toBe(false)
        })
    })
})
