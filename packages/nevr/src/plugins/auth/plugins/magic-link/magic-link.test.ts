// =============================================================================
// MAGIC LINK PLUGIN TESTS
// Tests for magic link authentication
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { magicLink, MAGIC_LINK_ERROR_CODES } from "./index.js"
import { getInternalAdapter } from "../../index.js"
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

describe("Magic Link Plugin", () => {
    describe("Plugin Creation", () => {
        it("should create plugin with options", () => {
            const plugin = magicLink({
                sendMagicLink: async () => { },
            })

            expect(plugin.id).toBe("magic-link")
            expect(plugin.endpoints).toHaveProperty("sendMagicLink")
            expect(plugin.endpoints).toHaveProperty("verifyMagicLink")
        })
    })

    describe("sendMagicLink Endpoint", () => {
        let driver: ReturnType<typeof createMockDriver>
        let sendMagicLinkMock: ReturnType<typeof vi.fn>
        let plugin: ReturnType<typeof magicLink>

        beforeEach(() => {
            driver = createMockDriver()
            sendMagicLinkMock = vi.fn()
            plugin = magicLink({
                sendMagicLink: sendMagicLinkMock,
            })
        })

        it("should generate token, store it, and send email", async () => {
            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.sendMagicLink.handler

            const ctx = {
                driver,
                body: {
                    email: "test@example.com",
                    name: "Test User",
                },
                request: {
                    headers: {
                        origin: "http://localhost:3000",
                    },
                },
            }

            const result = await handler(ctx as any) as any

            expect(result.status).toBe(200)
            expect(result.body.success).toBe(true)

            // Check if token was stored
            const verifications = await driver.findMany("verification")
            expect(verifications).toHaveLength(1)
            const storedVerification = verifications[0] as any
            const storedValue = JSON.parse(storedVerification.value)
            expect(storedValue.email).toBe("test@example.com")
            expect(storedValue.name).toBe("Test User")

            // Check if email was sent
            expect(sendMagicLinkMock).toHaveBeenCalledTimes(1)
            const callArgs = sendMagicLinkMock.mock.calls[0][0]
            expect(callArgs.email).toBe("test@example.com")
            expect(callArgs.token).toBe(storedVerification.identifier)
            expect(callArgs.url).toContain("http://localhost:3000/auth/magic-link/verify")
            expect(callArgs.url).toContain(`token=${storedVerification.identifier}`)
        })
    })

    describe("verifyMagicLink Endpoint", () => {
        let driver: ReturnType<typeof createMockDriver>
        let sendMagicLinkMock: ReturnType<typeof vi.fn>
        let plugin: ReturnType<typeof magicLink>

        beforeEach(() => {
            driver = createMockDriver()
            sendMagicLinkMock = vi.fn()
            plugin = magicLink({
                sendMagicLink: sendMagicLinkMock,
            })
        })

        it("should verify token and create new user", async () => {
            // Seed verification token
            const token = "valid-token"
            await driver.create("verification", {
                id: "v1",
                identifier: token,
                value: JSON.stringify({ email: "new@example.com", name: "New User" }),
                expiresAt: new Date(Date.now() + 1000 * 60 * 5), // 5 mins future
                createdAt: new Date(),
            })

            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.verifyMagicLink.handler

            const ctx = {
                driver,
                query: { token },
            }

            const result = await handler(ctx as any) as any

            expect(result.status).toBe(200)
            expect(result.body.token).toBeDefined()
            expect(result.body.isNewUser).toBe(true)
            expect(result.body.user.email).toBe("new@example.com")
            expect(result.body.user.emailVerified).toBe(true)

            // Verify user in DB
            const user = await driver.findOne("user", { email: "new@example.com" }) as any
            expect(user).toBeDefined()
            expect(user.emailVerified).toBe(true)

            // Verify session in DB
            const sessions = await driver.findMany("session")
            expect(sessions).toHaveLength(1)

            // Verify token deleted
            const verification = await driver.findOne("verification", { identifier: token })
            expect(verification).toBeNull()
        })

        it("should verify token and login existing user", async () => {
            // Seed existing user
            await driver.create("user", {
                id: "u1",
                email: "existing@example.com",
                emailVerified: true,
                name: "Existing User",
                createdAt: new Date(),
                updatedAt: new Date(),
            })

            // Seed verification token
            const token = "valid-token-2"
            await driver.create("verification", {
                id: "v2",
                identifier: token,
                value: JSON.stringify({ email: "existing@example.com" }),
                expiresAt: new Date(Date.now() + 1000 * 60 * 5),
                createdAt: new Date(),
            })

            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.verifyMagicLink.handler

            const ctx = {
                driver,
                query: { token },
            }

            const result = await handler(ctx as any) as any

            expect(result.status).toBe(200)
            expect(result.body.isNewUser).toBe(false)
            expect(result.body.user.email).toBe("existing@example.com")

            // Verify token deleted
            const verification = await driver.findOne("verification", { identifier: token })
            expect(verification).toBeNull()
        })

        it("should reject invalid token", async () => {
            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.verifyMagicLink.handler

            const ctx = {
                driver,
                query: { token: "invalid" },
            }

            await expect(handler(ctx as any)).rejects.toThrow(MAGIC_LINK_ERROR_CODES.INVALID_TOKEN)
        })

        it("should reject expired token", async () => {
            // Seed expired verification token
            const token = "expired-token"
            await driver.create("verification", {
                id: "v3",
                identifier: token,
                value: JSON.stringify({ email: "expired@example.com" }),
                expiresAt: new Date(Date.now() - 1000), // Past
                createdAt: new Date(),
            })

            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.verifyMagicLink.handler

            const ctx = {
                driver,
                query: { token },
            }

            await expect(handler(ctx as any)).rejects.toThrow(MAGIC_LINK_ERROR_CODES.EXPIRED_TOKEN)

            // Verify token deleted on expiration check
            const verification = await driver.findOne("verification", { identifier: token })
            expect(verification).toBeNull()
        })
    })
})
