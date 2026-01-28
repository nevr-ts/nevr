// =============================================================================
// AUTH PLUGIN TESTS
// Tests for the email/password authentication plugin
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { auth, AUTH_ERROR_CODES, AuthError } from "./index.js"
import type { Driver } from "../../types.js"

// -----------------------------------------------------------------------------
// Mock Driver
// -----------------------------------------------------------------------------

function createMockDriver(): Driver & { store: Map<string, Map<string, any>> } {
    const store = new Map<string, Map<string, any>>()

    const getEntityStore = (entity: string) => {
        if (!store.has(entity)) {
            store.set(entity, new Map())
        }
        return store.get(entity)!
    }

    return {
        name: "mock",
        store,

        async findOne<T>(entity: string, where: Record<string, unknown>): Promise<T | null> {
            const entityStore = getEntityStore(entity)
            for (const [_, record] of entityStore) {
                if (Object.entries(where).every(([key, value]) => record[key] === value)) {
                    return record as T
                }
            }
            return null
        },

        async findMany<T>(entity: string, options?: { where?: Record<string, unknown> }): Promise<T[]> {
            const entityStore = getEntityStore(entity)
            const results: T[] = []
            for (const [_, record] of entityStore) {
                if (!options?.where || Object.entries(options.where).every(([key, value]) => record[key] === value)) {
                    results.push(record as T)
                }
            }
            return results
        },

        async create<T>(entity: string, data: Record<string, unknown>): Promise<T> {
            const entityStore = getEntityStore(entity)
            const id = data.id as string
            entityStore.set(id, data)
            return data as T
        },

        async update<T>(entity: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<T> {
            const entityStore = getEntityStore(entity)
            for (const [id, record] of entityStore) {
                if (Object.entries(where).every(([key, value]) => record[key] === value)) {
                    const updated = { ...record, ...data }
                    entityStore.set(id, updated)
                    return updated as T
                }
            }
            throw new Error("Record not found")
        },

        async delete(entity: string, where: Record<string, unknown>): Promise<void> {
            const entityStore = getEntityStore(entity)
            for (const [id, record] of entityStore) {
                if (Object.entries(where).every(([key, value]) => record[key] === value)) {
                    entityStore.delete(id)
                    return
                }
            }
        },

        async count(entity: string, where?: Record<string, unknown>): Promise<number> {
            const entityStore = getEntityStore(entity)
            if (!where) return entityStore.size
            let count = 0
            for (const [_, record] of entityStore) {
                if (Object.entries(where).every(([key, value]) => record[key] === value)) {
                    count++
                }
            }
            return count
        },
    }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("Auth Plugin", () => {
    describe("Plugin Creation", () => {
        it("should create plugin with default options", () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            const plugin = auth({})

            expect(plugin).toBeDefined()
            expect(plugin.meta.id).toBe("auth")
            expect(plugin.meta.name).toBe("Authentication")
            expect(plugin.meta.version).toBe("1.0.0")
        })

        it("should have all required endpoints", () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            const plugin = auth({})

            expect(plugin.endpoints).toBeDefined()
            expect(plugin.endpoints?.signUpEmail).toBeDefined()
            expect(plugin.endpoints?.signInEmail).toBeDefined()
            expect(plugin.endpoints?.signOut).toBeDefined()
            expect(plugin.endpoints?.getSession).toBeDefined()
            expect(plugin.endpoints?.listSessions).toBeDefined()
            expect(plugin.endpoints?.revokeSession).toBeDefined()
            expect(plugin.endpoints?.revokeSessions).toBeDefined()
        })

        it("should export error codes", () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            const plugin = auth({})

            expect(plugin.$ERROR_CODES).toBeDefined()
            expect(AUTH_ERROR_CODES.USER_ALREADY_EXISTS).toBeDefined()
            expect(AUTH_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD).toBeDefined()
        })

        it("should have schema defined", () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            const plugin = auth({})

            expect(plugin.schema).toBeDefined()
            expect(plugin.schema?.entities).toBeDefined()
        })
    })

    describe("Sign Up Endpoint", () => {
        let driver: ReturnType<typeof createMockDriver>

        beforeEach(() => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            driver = createMockDriver()
        })

        it("should reject invalid email with VALIDATION_ERROR", async () => {
            const plugin = auth({})
            const handler = plugin.endpoints?.signUpEmail?.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { name: "Test User", email: "invalid-email", password: "password123" },
                headers: {},
            }

            // Now throws AuthError instead of returning error response
            await expect(handler(ctx as any)).rejects.toThrow(AuthError)

            try {
                await handler(ctx as any)
            } catch (e) {
                expect((e as AuthError).code).toBe("VALIDATION_ERROR")
                expect((e as AuthError).status).toBe(400)
                expect((e as AuthError).data?.errors).toBeDefined()
            }
        })

        it("should reject short password with VALIDATION_ERROR", async () => {
            const plugin = auth({})
            const handler = plugin.endpoints?.signUpEmail?.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { name: "Test User", email: "test@example.com", password: "short" },
                headers: {},
            }

            await expect(handler(ctx as any)).rejects.toThrow(AuthError)

            try {
                await handler(ctx as any)
            } catch (e) {
                expect((e as AuthError).code).toBe("VALIDATION_ERROR")
                expect((e as AuthError).data?.errors).toHaveProperty("password")
            }
        })

        it("should create user and session on valid sign up", async () => {
            const plugin = auth({})
            const handler = plugin.endpoints?.signUpEmail?.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { name: "Test User", email: "test@example.com", password: "password123" },
                headers: {},
            }

            const result = await handler(ctx as any)

            expect(result.status).toBe(200)
            expect(result.body.user).toBeDefined()
            expect(result.body.user.email).toBe("test@example.com")
            expect(result.body.user.name).toBe("Test User")
            expect(result.body.token).toBeDefined()
        })

        it("should reject duplicate email", async () => {
            const plugin = auth({})
            const handler = plugin.endpoints?.signUpEmail?.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { name: "Test User", email: "test@example.com", password: "password123" },
                headers: {},
            }

            // First sign up succeeds
            await handler(ctx as any)

            // Second sign up with same email throws
            await expect(handler(ctx as any)).rejects.toThrow(AuthError)

            try {
                await handler(ctx as any)
            } catch (e) {
                expect((e as AuthError).code).toBe(AUTH_ERROR_CODES.USER_ALREADY_EXISTS)
            }
        }, 15000)
    })

    describe("Sign In Endpoint", () => {
        let driver: ReturnType<typeof createMockDriver>

        beforeEach(async () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            driver = createMockDriver()

            // Create a test user
            const plugin = auth({})
            const signUpHandler = plugin.endpoints?.signUpEmail?.handler

            if (signUpHandler) {
                await signUpHandler({
                    context: { driver },
                    body: { name: "Test User", email: "test@example.com", password: "password123" },
                    headers: {},
                } as any)
            }
        }, 15000)

        it("should reject invalid email with VALIDATION_ERROR", async () => {
            const plugin = auth({})
            const handler = plugin.endpoints?.signInEmail?.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { email: "invalid-email", password: "password123" },
                headers: {},
            }

            await expect(handler(ctx as any)).rejects.toThrow(AuthError)

            try {
                await handler(ctx as any)
            } catch (e) {
                expect((e as AuthError).code).toBe("VALIDATION_ERROR")
            }
        })

        it("should reject non-existent user", async () => {
            const plugin = auth({})
            const handler = plugin.endpoints?.signInEmail?.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { email: "nonexistent@example.com", password: "password123" },
                headers: {},
            }

            await expect(handler(ctx as any)).rejects.toThrow(AuthError)

            try {
                await handler(ctx as any)
            } catch (e) {
                expect((e as AuthError).code).toBe(AUTH_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD)
            }
        }, 15000)

        it("should reject wrong password", async () => {
            const plugin = auth({})
            const handler = plugin.endpoints?.signInEmail?.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { email: "test@example.com", password: "wrongpassword" },
                headers: {},
            }

            await expect(handler(ctx as any)).rejects.toThrow(AuthError)

            try {
                await handler(ctx as any)
            } catch (e) {
                expect((e as AuthError).code).toBe(AUTH_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD)
            }
        }, 15000)

        it("should sign in with correct credentials", async () => {
            const plugin = auth({})
            const handler = plugin.endpoints?.signInEmail?.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { email: "test@example.com", password: "password123" },
                headers: {},
            }

            const result = await handler(ctx as any)

            expect(result.status).toBe(200)
            expect(result.body.user).toBeDefined()
            expect(result.body.token).toBeDefined()
            expect(result.headers?.["Set-Cookie"]).toBeDefined()
        })
    })

    describe("Sign Out Endpoint", () => {
        it("should sign out and clear cookie", async () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            const driver = createMockDriver()
            const plugin = auth({})

            // Sign up first
            const signUpHandler = plugin.endpoints?.signUpEmail?.handler
            const signUpResult = await signUpHandler!({
                context: { driver },
                body: { name: "Test User", email: "test@example.com", password: "password123" },
                headers: {},
            } as any)

            const token = signUpResult.body.token

            // Sign out
            const signOutHandler = plugin.endpoints?.signOut?.handler
            const result = await signOutHandler!({
                context: { driver },
                body: {},
                headers: { cookie: `nevr.session_token=${token}` },
            } as any)

            expect(result.status).toBe(200)
            expect(result.body.success).toBe(true)
            expect(result.headers?.["Set-Cookie"]).toContain("Max-Age=0")
        })
    })

    describe("Get Session Endpoint", () => {
        it("should return null when no session", async () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            const driver = createMockDriver()
            const plugin = auth({})

            const handler = plugin.endpoints?.getSession?.handler
            const result = await handler!({
                context: { driver },
                headers: {},
            } as any)

            expect(result.status).toBe(200)
            expect(result.body).toBeNull()
        })

        it("should return session when valid token", async () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            const driver = createMockDriver()
            const plugin = auth({})

            // Sign up first
            const signUpHandler = plugin.endpoints?.signUpEmail?.handler
            const signUpResult = await signUpHandler!({
                context: { driver },
                body: { name: "Test User", email: "test@example.com", password: "password123" },
                headers: {},
            } as any)

            const token = signUpResult.body.token

            // Get session
            const getSessionHandler = plugin.endpoints?.getSession?.handler
            const result = await getSessionHandler!({
                context: { driver },
                headers: { cookie: `nevr.session_token=${token}` },
            } as any)

            expect(result.status).toBe(200)
            expect(result.body.session).toBeDefined()
            expect(result.body.user).toBeDefined()
            expect(result.body.user.email).toBe("test@example.com")
        })
    })

    describe("List Sessions Endpoint", () => {
        it("should reject when not authenticated", async () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            const driver = createMockDriver()
            const plugin = auth({})

            const handler = plugin.endpoints?.listSessions?.handler

            await expect(handler!({
                context: { driver },
                headers: {},
            } as any)).rejects.toThrow(AuthError)
        })

        it("should list all sessions for user", async () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            const driver = createMockDriver()
            const plugin = auth({})

            // Sign up
            const signUpHandler = plugin.endpoints?.signUpEmail?.handler
            const signUpResult = await signUpHandler!({
                context: { driver },
                body: { name: "Test User", email: "test@example.com", password: "password123" },
                headers: {},
            } as any)

            const token = signUpResult.body.token

            // Sign in again to create second session
            const signInHandler = plugin.endpoints?.signInEmail?.handler
            await signInHandler!({
                context: { driver },
                body: { email: "test@example.com", password: "password123" },
                headers: {},
            } as any)

            // List sessions
            const listHandler = plugin.endpoints?.listSessions?.handler
            const result = await listHandler!({
                context: { driver },
                headers: { cookie: `nevr.session_token=${token}` },
            } as any)

            expect(result.status).toBe(200)
            expect(result.body.sessions).toHaveLength(2)
        }, 15000)
    })
})
