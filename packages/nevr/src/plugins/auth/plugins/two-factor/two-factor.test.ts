// =============================================================================
// TWO FACTOR PLUGIN TESTS
// Tests for TOTP and Backup Codes
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { twoFactor, TWO_FACTOR_ERROR_CODES } from "./index.js"
import { getInternalAdapter } from "../../index.js"
import { hashPassword } from "../../crypto/index.js"
import type { Driver } from "../../../../types.js"
import crypto from "crypto"

// -----------------------------------------------------------------------------
// TOTP Helpers (Copied for testing)
// -----------------------------------------------------------------------------

function base32Decode(encoded: string): Uint8Array {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    encoded = encoded.replace(/[^A-Z2-7]/gi, "").toUpperCase()

    let bits = ""
    for (const char of encoded) {
        const val = chars.indexOf(char)
        bits += val.toString(2).padStart(5, "0")
    }

    const bytes = new Uint8Array(Math.floor(bits.length / 8))
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2)
    }
    return bytes
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const hmac = crypto.createHmac("sha1", Buffer.from(key))
    hmac.update(Buffer.from(message))
    return new Uint8Array(hmac.digest())
}

async function generateTOTP(secret: string, options: { digits?: number; period?: number; counter?: number } = {}): Promise<string> {
    const digits = options.digits ?? 6
    const period = options.period ?? 30
    const counter = options.counter ?? Math.floor(Date.now() / 1000 / period)

    const key = base32Decode(secret)
    const counterBytes = new Uint8Array(8)
    let temp = counter
    for (let i = 7; i >= 0; i--) {
        counterBytes[i] = temp & 0xff
        temp = Math.floor(temp / 256)
    }

    const hash = await hmacSha1(key, counterBytes)
    const offset = hash[hash.length - 1] & 0xf
    const binary =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff)

    const otp = binary % Math.pow(10, digits)
    return otp.toString().padStart(digits, "0")
}

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
            for (const [key, record] of entityStore) {
                // @ts-ignore
                if (Object.entries(where).every(([k, v]) => record[k] === v)) {
                    return record as T
                }
            }
            return null
        },

        async findMany<T>(entity: string, options?: { where?: Record<string, unknown> }): Promise<T[]> {
            const entityStore = getEntityStore(entity)
            const results: T[] = []
            for (const [key, record] of entityStore) {
                // @ts-ignore
                if (!options?.where || Object.entries(options.where).every(([k, v]) => record[k] === v)) {
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
                // @ts-ignore
                if (Object.entries(where).every(([k, v]) => record[k] === v)) {
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
                // @ts-ignore
                if (Object.entries(where).every(([k, v]) => record[k] === v)) {
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

describe("Two Factor Plugin", () => {
    let driver: ReturnType<typeof createMockDriver>
    let plugin: ReturnType<typeof twoFactor>
    let userId: string
    let sessionToken: string

    beforeEach(async () => {
        driver = createMockDriver()
        plugin = twoFactor()
        userId = "u1"
        sessionToken = "test-session-token-12345"

        // Seed user and password
        await driver.create("user", {
            id: userId,
            email: "test@example.com",
            twoFactorEnabled: false
        })
        await driver.create("account", {
            id: "a1",
            userId,
            providerId: "credential",
            password: await hashPassword("password123")
        })
        // Create session for authentication
        await driver.create("session", {
            id: "s1",
            token: sessionToken,
            userId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            createdAt: new Date(),
            updatedAt: new Date(),
        })
    })

    describe("enableTwoFactor", () => {
        it("should generate secret and backup codes", async () => {
            // @ts-ignore
            const handler = plugin.endpoints.enableTwoFactor.handler

            const ctx = {
                driver,
                context: { driver },
                headers: { cookie: `nevr.session_token=${sessionToken}` },
                body: { password: "password123" }
            }

            const result = await handler(ctx as any) as any
            expect(result.status).toBe(200)
            expect(result.body.secret).toBeDefined()
            expect(result.body.totpUri).toBeDefined()
            expect(result.body.backupCodes).toHaveLength(10)

            // Verify DB
            const twoFactorRecord = await driver.findOne<any>("twoFactor", { userId })
            expect(twoFactorRecord).toBeDefined()
            expect(twoFactorRecord.secret).toBe(result.body.secret)
        })
    })

    describe("verifyTwoFactorSetup", () => {
        it("should enable 2FA with valid code", async () => {
            // Enable first to get secret
            // @ts-ignore
            const enableHandler = plugin.endpoints.enableTwoFactor.handler
            const enableCtx = {
                driver,
                context: { driver },
                headers: { cookie: `nevr.session_token=${sessionToken}` },
                body: { password: "password123" }
            }
            const enableResult = await enableHandler(enableCtx as any) as any
            const secret = enableResult.body.secret

            // Generate valid code
            const code = await generateTOTP(secret)

            // Verify setup
            // @ts-ignore
            const verifyCtx = {
                driver,
                context: { driver },
                headers: { cookie: `nevr.session_token=${sessionToken}` },
                body: { code }
            }
            // @ts-ignore
            const result = await plugin.endpoints.verifyTwoFactorSetup.handler(verifyCtx as any) as any
            expect(result.status).toBe(200)
            expect(result.body.twoFactorEnabled).toBe(true)

            // Verify user updated
            const user = await driver.findOne<any>("user", { id: userId })
            expect(user.twoFactorEnabled).toBe(true)
        })
    })

    describe("verifyTOTP (during sign-in)", () => {
        it("should verify code and return session", async () => {
            // Setup 2FA
            await driver.create("twoFactor", {
                id: "tf1",
                userId,
                secret: "JBSWY3DPEHPK3PXP", // Base32 valid secret
                backupCodes: "enc:codes",
                createdAt: new Date(),
                updatedAt: new Date()
            })
            await driver.update("user", { id: userId }, { twoFactorEnabled: true })

            // Create verification request (simulate intermediate state)
            await driver.create("verification", {
                id: "v1",
                identifier: "nevr.two_factor_cookie_val",
                value: userId, // userId is stored in value
                expiresAt: new Date(Date.now() + 10000),
                createdAt: new Date()
            })

            const code = await generateTOTP("JBSWY3DPEHPK3PXP")

            // @ts-ignore
            const handler = plugin.endpoints.verifyTOTP.handler
            const ctx = {
                driver,
                cookies: { "nevr.two_factor": "nevr.two_factor_cookie_val" },
                body: { code }
            }

            const result = await handler(ctx as any) as any
            expect(result.status).toBe(200)
            expect(result.body.token).toBeDefined()
            expect(result.body.user.id).toBe(userId)
        })
    })
})
