// =============================================================================
// ANONYMOUS PLUGIN TESTS
// Tests for anonymous guest authentication
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { anonymous, ANONYMOUS_ERROR_CODES } from "./index.js"
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

describe("Anonymous Plugin", () => {
    describe("signInAnonymous Endpoint", () => {
        let driver: ReturnType<typeof createMockDriver>
        let plugin: ReturnType<typeof anonymous>

        beforeEach(() => {
            driver = createMockDriver()
            plugin = anonymous()
        })

        it("should create anonymous user and session", async () => {
            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.signInAnonymous.handler

            const ctx = {
                driver,
                context: {},
            }

            const result = await handler(ctx as any) as any

            expect(result.status).toBe(200)
            expect(result.body.token).toBeDefined()
            expect(result.body.user.isAnonymous).toBe(true)
            expect(result.body.user.email).toContain(".anonymous")

            // Verify DB
            const user = await driver.findOne("user", { id: result.body.user.id }) as any
            expect(user.isAnonymous).toBe(true)
        })

        it("should reject if already anonymous", async () => {
            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.signInAnonymous.handler

            const ctx = {
                driver,
                context: {
                    session: {
                        user: { isAnonymous: true }
                    }
                },
            }

            await expect(handler(ctx as any)).rejects.toThrow(ANONYMOUS_ERROR_CODES.ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY)
        })

        it("should use custom name generator", async () => {
            plugin = anonymous({
                generateName: () => "Custom Anon",
            })

            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.signInAnonymous.handler

            const ctx = {
                driver,
                context: {},
            }

            const result = await handler(ctx as any) as any
            expect(result.body.user.name).toBe("Custom Anon")
        })
    })

    describe("Account Linking Hook", () => {
        let driver: ReturnType<typeof createMockDriver>
        let onLinkAccountMock: ReturnType<typeof vi.fn>
        let plugin: ReturnType<typeof anonymous>

        beforeEach(() => {
            driver = createMockDriver()
            onLinkAccountMock = vi.fn()
            plugin = anonymous({
                onLinkAccount: onLinkAccountMock,
            })
        })

        it("should trigger onLinkAccount and delete anonymous user", async () => {
            // @ts-ignore - access internal handler
            const hookHandler = plugin.interceptors!.after![0].handler

            // Seed anonymous user
            await driver.create("user", {
                id: "anon-id",
                email: "temp@anon",
                isAnonymous: true
            })

            const ctx = {
                path: "/sign-in/email",
                driver,
                context: {
                    driver,
                    previousSession: {
                        user: { id: "anon-id", isAnonymous: true },
                        session: { id: "anon-sess" }
                    },
                    session: {
                        user: { id: "new-user-id", isAnonymous: false },
                        session: { id: "new-sess" }
                    }
                }
            }

            await hookHandler(ctx as any)

            expect(onLinkAccountMock).toHaveBeenCalled()
            const callArgs = onLinkAccountMock.mock.calls[0][0]
            expect(callArgs.anonymousUser.user.id).toBe("anon-id")
            expect(callArgs.newUser.user.id).toBe("new-user-id")

            // Verify anonymous user deleted
            const anonUser = await driver.findOne("user", { id: "anon-id" })
            expect(anonUser).toBeNull()
        })

        it("should not delete anonymous user if disabled", async () => {
            plugin = anonymous({
                onLinkAccount: onLinkAccountMock,
                disableDeleteAnonymousUser: true
            })
            // @ts-ignore - access internal handler
            const hookHandler = plugin.interceptors!.after![0].handler

            // Seed anonymous user
            await driver.create("user", {
                id: "anon-id",
                email: "temp@anon",
                isAnonymous: true
            })

            const ctx = {
                path: "/sign-in/email",
                driver,
                context: {
                    driver,
                    previousSession: {
                        user: { id: "anon-id", isAnonymous: true },
                        session: { id: "anon-sess" }
                    },
                    session: {
                        user: { id: "new-user-id", isAnonymous: false },
                        session: { id: "new-sess" }
                    }
                }
            }

            await hookHandler(ctx as any)

            // Verify anonymous user NOT deleted
            const anonUser = await driver.findOne("user", { id: "anon-id" })
            expect(anonUser).toBeDefined()
        })
    })
})
