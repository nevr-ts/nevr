// =============================================================================
// USERNAME PLUGIN TESTS
// Tests for username-based authentication plugin
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { username, USERNAME_ERROR_CODES } from "./index.js"
import { auth } from "../../index.js"
import { usernameClient } from "./client.js"
import type { Driver } from "../../../../types.js"

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

describe("Username Plugin", () => {
    describe("Plugin Creation", () => {
        it("should create plugin with default options", () => {
            const plugin = username()

            expect(plugin).toBeDefined()
            expect(plugin.id).toBe("username")
        })

        it("should have required endpoints", () => {
            const plugin = username()

            expect(plugin.endpoints).toBeDefined()
            expect(plugin.endpoints.signInUsername).toBeDefined()
            expect(plugin.endpoints.isUsernameAvailable).toBeDefined()
        })

        it("should export error codes", () => {
            const plugin = username()

            expect(plugin.$ERROR_CODES).toBeDefined()
            expect(USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD).toBeDefined()
            expect(USERNAME_ERROR_CODES.USERNAME_IS_ALREADY_TAKEN).toBeDefined()
        })

        it("should have schema that extends user entity", () => {
            const plugin = username()

            expect(plugin.schema).toBeDefined()
            // Username plugin extends the existing 'user' entity, it doesn't define a new one
            expect(plugin.schema?.extend?.user).toBeDefined()
            expect(plugin.schema?.extend?.user?.username).toBeDefined()
            expect(plugin.schema?.extend?.user?.displayUsername).toBeDefined()
        })

        it("should have entityHooks for username normalization (unified pattern)", () => {
            const plugin = username()

            expect(plugin.entityHooks).toBeDefined()
            expect(plugin.entityHooks.user).toBeDefined()
            expect(plugin.entityHooks.user.create).toBeDefined()
            expect(plugin.entityHooks.user.create?.before).toBeDefined()
            expect(plugin.entityHooks.user.update).toBeDefined()
            expect(plugin.entityHooks.user.update?.before).toBeDefined()
        })
    })

    describe("isUsernameAvailable Endpoint", () => {
        let driver: ReturnType<typeof createMockDriver>

        beforeEach(() => {
            driver = createMockDriver()
        })

        it("should return available: true for new username", async () => {
            const plugin = username()
            const handler = plugin.endpoints.isUsernameAvailable.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { username: "newuser" },
            }

            const result = await handler(ctx as any) as any

            expect(result.status).toBe(200)
            expect(result.body.available).toBe(true)
        })

        it("should return available: false for existing username", async () => {
            await driver.create("user", {
                id: "1",
                email: "existing@example.com",
                username: "existinguser",
                name: "Existing User",
            })

            const plugin = username()
            const handler = plugin.endpoints.isUsernameAvailable.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { username: "existinguser" },
            }

            const result = await handler(ctx as any) as any

            expect(result.status).toBe(200)
            expect(result.body.available).toBe(false)
        })

        it("should reject too short username", async () => {
            const plugin = username({ minUsernameLength: 3 })
            const handler = plugin.endpoints.isUsernameAvailable.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { username: "ab" },
            }

            await expect(handler(ctx as any)).rejects.toThrow()
        })

        it("should reject too long username", async () => {
            const plugin = username({ maxUsernameLength: 10 })
            const handler = plugin.endpoints.isUsernameAvailable.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { username: "verylongusername" },
            }

            await expect(handler(ctx as any)).rejects.toThrow()
        })

        it("should reject invalid username format", async () => {
            const plugin = username()
            const handler = plugin.endpoints.isUsernameAvailable.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { username: "user@name" },
            }

            await expect(handler(ctx as any)).rejects.toThrow()
        })
    })

    describe("signInUsername Endpoint", () => {
        let driver: ReturnType<typeof createMockDriver>

        beforeEach(async () => {
            process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long"
            driver = createMockDriver()

            const authPlugin = auth({})
            const signUpHandler = authPlugin.endpoints?.signUpEmail?.handler

            if (signUpHandler) {
                await signUpHandler({
                    context: { driver },
                    body: { name: "Test User", email: "test@example.com", password: "password123" },
                    headers: {},
                } as any)
            }

            const users = await driver.findMany("user", {})
            if (users.length > 0) {
                const user = users[0] as any
                await driver.update("user", { id: user.id }, { username: "testuser", displayUsername: "TestUser" })
            }
        }, 15000)

        it("should reject non-existent username", async () => {
            const plugin = username()
            const handler = plugin.endpoints.signInUsername.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { username: "nonexistent", password: "password123" },
                headers: {},
            }

            await expect(handler(ctx as any)).rejects.toThrow()
        }, 15000)

        it("should reject wrong password", async () => {
            const plugin = username()
            const handler = plugin.endpoints.signInUsername.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { username: "testuser", password: "wrongpassword" },
                headers: {},
            }

            await expect(handler(ctx as any)).rejects.toThrow()
        }, 15000)

        it("should sign in with correct credentials", async () => {
            const plugin = username()
            const handler = plugin.endpoints.signInUsername.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { username: "testuser", password: "password123" },
                headers: {},
            }

            const result = await handler(ctx as any) as any

            expect(result.status).toBe(200)
            expect(result.body.token).toBeDefined()
            expect(result.body.user).toBeDefined()
            expect(result.body.user.username).toBe("testuser")
            expect(result.headers?.["Set-Cookie"]).toBeDefined()
        }, 15000)

        it("should be case-insensitive for username lookup", async () => {
            const plugin = username()
            const handler = plugin.endpoints.signInUsername.handler
            if (!handler) throw new Error("Handler not found")

            const ctx = {
                context: { driver },
                body: { username: "TESTUSER", password: "password123" },
                headers: {},
            }

            const result = await handler(ctx as any) as any

            expect(result.status).toBe(200)
            expect(result.body.user.username).toBe("testuser")
        }, 15000)
    })

    describe("Custom Validators", () => {
        it("should use custom username validator", async () => {
            const customValidator = vi.fn().mockReturnValue(false)

            const plugin = username({
                usernameValidator: customValidator,
            })

            const handler = plugin.endpoints.isUsernameAvailable.handler
            if (!handler) throw new Error("Handler not found")

            const driver = createMockDriver()
            const ctx = {
                context: { driver },
                body: { username: "validuser" },
            }

            await expect(handler(ctx as any)).rejects.toThrow()
            expect(customValidator).toHaveBeenCalledWith("validuser")
        })

        it("should use custom normalization", async () => {
            const plugin = username({
                usernameNormalization: (u) => u.toUpperCase(),
            })

            const handler = plugin.endpoints.isUsernameAvailable.handler
            if (!handler) throw new Error("Handler not found")

            const driver = createMockDriver()

            await driver.create("user", {
                id: "1",
                email: "test@example.com",
                username: "TESTUSER",
                name: "Test",
            })

            const ctx = {
                context: { driver },
                body: { username: "testuser" },
            }

            const result = await handler(ctx as any) as any

            expect(result.body.available).toBe(false)
        })
    })

    describe("Username Client", () => {
        it("should create client plugin with correct id", () => {
            const client = usernameClient()

            expect(client.id).toBe("username-client")
        })

        it("should have correct path methods", () => {
            const client = usernameClient()

            expect(client.pathMethods).toEqual({
                "/auth/sign-in/username": "POST",
                "/auth/is-username-available": "POST",
            })
        })

        it("should have atom listeners for session refresh", () => {
            const client = usernameClient()

            expect(client.atomListeners).toBeDefined()
            expect(client.atomListeners?.length).toBeGreaterThan(0)
        })

        it("should use custom basePath", () => {
            const client = usernameClient({ basePath: "/api/auth" })

            expect(client.pathMethods).toEqual({
                "/api/auth/sign-in/username": "POST",
                "/api/auth/is-username-available": "POST",
            })
        })
    })
})
