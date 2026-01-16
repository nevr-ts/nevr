// =============================================================================
// PHONE NUMBER PLUGIN TESTS
// Tests for phone number authentication
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { phoneNumber, PHONE_NUMBER_ERROR_CODES } from "./index.js"
import { getInternalAdapter } from "../../index.js"
import { hashPassword } from "../../crypto/index.js"
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

describe("Phone Number Plugin", () => {
    describe("sendPhoneOTP", () => {
        let driver: ReturnType<typeof createMockDriver>
        let sendOTPMock: ReturnType<typeof vi.fn>
        let plugin: ReturnType<typeof phoneNumber>

        beforeEach(() => {
            driver = createMockDriver()
            sendOTPMock = vi.fn()
            plugin = phoneNumber({
                sendOTP: sendOTPMock,
            })
        })

        it("should generate and send OTP", async () => {
            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.sendPhoneOTP.handler

            const ctx = {
                driver,
                body: { phoneNumber: "+1234567890" },
            }

            const result = await handler(ctx as any) as any
            expect(result.status).toBe(200)

            // Verify DB
            const verifications = await driver.findMany<any>("verification")
            expect(verifications).toHaveLength(1)
            expect(verifications[0].identifier).toBe("phone:+1234567890")
            expect(verifications[0].value).toHaveLength(6)

            // Verify email sent
            expect(sendOTPMock).toHaveBeenCalledWith({
                phoneNumber: "+1234567890",
                code: verifications[0].value
            })
        })
    })

    describe("verifyPhoneNumber", () => {
        let driver: ReturnType<typeof createMockDriver>
        let plugin: ReturnType<typeof phoneNumber>

        beforeEach(() => {
            driver = createMockDriver()
            plugin = phoneNumber({
                sendOTP: async () => { },
            })
        })

        it("should verify OTP and update user", async () => {
            // Seed user
            await driver.create("user", {
                id: "u1",
                phoneNumber: "+1234567890",
                phoneNumberVerified: false
            })

            // Seed verification
            await driver.create("verification", {
                id: "v1",
                identifier: "phone:+1234567890",
                value: "123456",
                expiresAt: new Date(Date.now() + 10000),
                createdAt: new Date()
            })

            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.verifyPhoneNumber.handler

            const ctx = {
                driver,
                body: { phoneNumber: "+1234567890", code: "123456" },
            }

            const result = await handler(ctx as any) as any
            expect(result.status).toBe(200)
            expect(result.body.verified).toBe(true)

            // Verify user updated
            const user = await driver.findOne<any>("user", { id: "u1" })
            expect(user.phoneNumberVerified).toBe(true)

            // Verify token deleted
            const verification = await driver.findOne("verification", { id: "v1" })
            expect(verification).toBeNull()
        })

        it("should reject invalid code", async () => {
            // Seed verification
            await driver.create("verification", {
                id: "v1",
                identifier: "phone:+1234567890",
                value: "123456",
                expiresAt: new Date(Date.now() + 10000),
                createdAt: new Date()
            })

            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.verifyPhoneNumber.handler

            const ctx = {
                driver,
                body: { phoneNumber: "+1234567890", code: "wrong" },
            }

            await expect(handler(ctx as any)).rejects.toThrow(PHONE_NUMBER_ERROR_CODES.INVALID_OTP)
        })
    })

    describe("signInPhoneNumber", () => {
        let driver: ReturnType<typeof createMockDriver>
        let plugin: ReturnType<typeof phoneNumber>

        beforeEach(() => {
            driver = createMockDriver()
            plugin = phoneNumber({
                sendOTP: async () => { },
                requireVerification: true
            })
        })

        it("should sign in with valid credentials", async () => {
            // Seed user & account
            const userId = "u1"
            await driver.create("user", {
                id: userId,
                phoneNumber: "+1234567890",
                phoneNumberVerified: true,
                email: "test@example.com"
            })
            await driver.create("account", {
                id: "a1",
                userId,
                providerId: "credential",
                password: await hashPassword("password123")
            })

            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.signInPhoneNumber.handler

            const ctx = {
                driver,
                body: { phoneNumber: "+1234567890", password: "password123" },
            }

            const result = await handler(ctx as any) as any
            expect(result.status).toBe(200)
            expect(result.body.token).toBeDefined()
            expect(result.body.user.id).toBe(userId)
        }, 15000)

        it("should reject unverified user if required", async () => {
            // Seed user & account
            const userId = "u1"
            await driver.create("user", {
                id: userId,
                phoneNumber: "+1234567890",
                phoneNumberVerified: false, // Unverified
            })
            await driver.create("account", {
                id: "a1",
                userId,
                providerId: "credential",
                password: await hashPassword("password123")
            })

            // @ts-ignore - access internal handler
            const handler = plugin.endpoints.signInPhoneNumber.handler

            const ctx = {
                driver,
                body: { phoneNumber: "+1234567890", password: "password123" },
            }

            await expect(handler(ctx as any)).rejects.toThrow(PHONE_NUMBER_ERROR_CODES.PHONE_NUMBER_NOT_VERIFIED)
        })
    })
})
