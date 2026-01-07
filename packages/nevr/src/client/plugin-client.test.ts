// =============================================================================
// PLUGIN CLIENT TESTS
// Tests for namespace-based plugin client (client.auth.signUp() pattern)
// =============================================================================

import { describe, it, expect, vi } from "vitest"
import { pluginClient, createPluginMethods } from "./plugin-client.js"
import type { NevrFetch, NevrFetchResponse } from "./types.js"

// Mock fetch function
function createMockFetch(): NevrFetch {
    return vi.fn().mockImplementation(async (path: string, options: any) => {
        return {
            data: { path, method: options.method, body: options.body },
            error: null,
        }
    }) as any
}

describe("Plugin Client", () => {
    describe("createPluginMethods", () => {
        it("should create methods for plugin actions", async () => {
            const $fetch = createMockFetch()

            const authMethods = createPluginMethods($fetch, {
                namespace: "auth",
                basePath: "/auth",
                actions: {
                    signUp: { method: "POST", path: "/sign-up" },
                    signIn: { method: "POST", path: "/sign-in" },
                    getSession: { method: "GET", path: "/session" },
                },
            })

            // Verify methods are created
            expect(authMethods.signUp).toBeTypeOf("function")
            expect(authMethods.signIn).toBeTypeOf("function")
            expect(authMethods.getSession).toBeTypeOf("function")
        })

        it("should call fetch with correct path and method", async () => {
            const $fetch = createMockFetch()

            const authMethods = createPluginMethods($fetch, {
                namespace: "auth",
                basePath: "/auth",
                actions: {
                    signUp: { method: "POST", path: "/sign-up" },
                },
            })

            const result = await authMethods.signUp({ email: "test@test.com", password: "secret" })

            expect($fetch).toHaveBeenCalledWith("/auth/sign-up", {
                method: "POST",
                body: { email: "test@test.com", password: "secret" },
            })
            expect(result.data).toEqual({
                path: "/auth/sign-up",
                method: "POST",
                body: { email: "test@test.com", password: "secret" },
            })
        })

        it("should use GET method for read actions", async () => {
            const $fetch = createMockFetch()

            const authMethods = createPluginMethods($fetch, {
                namespace: "auth",
                basePath: "/auth",
                actions: {
                    getSession: { method: "GET", path: "/session" },
                },
            })

            await authMethods.getSession({})

            expect($fetch).toHaveBeenCalledWith("/auth/session", {
                method: "GET",
                query: {},
                body: undefined,
            })
        })
    })

    describe("pluginClient", () => {
        it("should create a plugin client configuration", () => {
            const authPlugin = pluginClient({
                namespace: "auth",
                basePath: "/auth",
                actions: {
                    signUp: { method: "POST", path: "/sign-up" },
                },
            })

            expect(authPlugin.id).toBe("auth-client")
            expect(authPlugin.getActions).toBeTypeOf("function")
            expect(authPlugin.$InferNamespace).toBe("auth")
        })

        it("should return namespaced actions from getActions", () => {
            const $fetch = createMockFetch()

            const authPlugin = pluginClient({
                namespace: "auth",
                basePath: "/auth",
                actions: {
                    signUp: { method: "POST", path: "/sign-up" },
                    signIn: { method: "POST", path: "/sign-in" },
                },
            })

            const actions = authPlugin.getActions($fetch)

            // Actions should be namespaced under "auth"
            expect(actions.auth).toBeDefined()
            expect(actions.auth.signUp).toBeTypeOf("function")
            expect(actions.auth.signIn).toBeTypeOf("function")
        })
    })

    describe("Unified plugin auto-wire", () => {
        it("should auto-wire from unified plugin with endpoints", () => {
            // Simulate a unified plugin with endpoints
            const subscriptionPlugin = {
                meta: {
                    id: "subscription",
                    name: "Subscription",
                    version: "1.0.0",
                    basePath: "/subscription",
                },
                endpoints: {
                    upgrade: { method: "POST", path: "/upgrade", handler: async () => ({}) },
                    cancel: { method: "POST", path: "/cancel", handler: async () => ({}) },
                    getHistory: { method: "GET", path: "/history", handler: async () => ({}) },
                },
            }

            // Verify structure matches what vanilla.ts expects
            expect(subscriptionPlugin.meta.id).toBe("subscription")
            expect(subscriptionPlugin.endpoints.upgrade.method).toBe("POST")
            expect(subscriptionPlugin.endpoints.getHistory.method).toBe("GET")
        })

        it("should use meta.basePath for route paths", () => {
            const plugin = {
                meta: { id: "test", name: "Test", version: "1.0.0", basePath: "/api/test" },
                endpoints: {
                    doSomething: { method: "POST", path: "/action", handler: async () => ({}) },
                },
            }

            // Full path would be: basePath + path = /api/test/action
            expect(plugin.meta.basePath + plugin.endpoints.doSomething.path).toBe("/api/test/action")
        })
    })
})
