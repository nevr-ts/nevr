// =============================================================================
// CRYPTO MODULE TESTS
// Tests for password hashing, token generation, and HMAC signing
// =============================================================================

import { describe, it, expect } from "vitest"
import {
    hashPassword,
    verifyPassword,
    needsRehash,
    generateSessionToken,
    generateId,
    generateUUID,
    generateVerificationToken,
    signValue,
    verifySignedValue,
    signWithTimestamp,
    verifyWithTimestamp,
} from "./index.js"

// -----------------------------------------------------------------------------
// Password Hashing Tests
// -----------------------------------------------------------------------------

describe("Crypto - Password", () => {
    it("should hash a password", async () => {
        const password = "testpassword123"
        const hash = await hashPassword(password)

        expect(hash).toBeDefined()
        expect(hash.startsWith("$pbkdf2$")).toBe(true)
        expect(hash.split("$")).toHaveLength(5)
    })

    it("should verify correct password", async () => {
        const password = "testpassword123"
        const hash = await hashPassword(password)

        const isValid = await verifyPassword(password, hash)
        expect(isValid).toBe(true)
    }, 15000)

    it("should reject incorrect password", async () => {
        const password = "testpassword123"
        const hash = await hashPassword(password)

        const isValid = await verifyPassword("wrongpassword", hash)
        expect(isValid).toBe(false)
    }, 15000)

    it("should reject malformed hash", async () => {
        const isValid = await verifyPassword("test", "not-a-valid-hash")
        expect(isValid).toBe(false)
    })

    it("should detect when rehash is needed", async () => {
        // Low cost hash
        const hash = await hashPassword("test", 5) // 2^5 * 1000 = 32000 iterations

        // Should need rehash with higher cost
        expect(needsRehash(hash, 10)).toBe(true)

        // Should not need rehash with same or lower cost
        expect(needsRehash(hash, 5)).toBe(false)
        expect(needsRehash(hash, 4)).toBe(false)
    })

    it("should produce different hashes for same password", async () => {
        const password = "testpassword123"
        const hash1 = await hashPassword(password)
        const hash2 = await hashPassword(password)

        expect(hash1).not.toBe(hash2) // Different salts
    }, 15000)
})

// -----------------------------------------------------------------------------
// Token Generation Tests
// -----------------------------------------------------------------------------

describe("Crypto - Token", () => {
    it("should generate session token", () => {
        const token = generateSessionToken()

        expect(token).toBeDefined()
        expect(typeof token).toBe("string")
        expect(token.length).toBeGreaterThan(20)
    })

    it("should generate unique session tokens", () => {
        const tokens = new Set([...Array(100)].map(() => generateSessionToken()))
        expect(tokens.size).toBe(100)
    })

    it("should generate ID (32 hex chars)", () => {
        const id = generateId()

        expect(id).toBeDefined()
        expect(id.length).toBe(32)
        expect(/^[0-9a-f]+$/.test(id)).toBe(true)
    })

    it("should generate unique IDs", () => {
        const ids = new Set([...Array(100)].map(() => generateId()))
        expect(ids.size).toBe(100)
    })

    it("should generate UUID v4", () => {
        const uuid = generateUUID()

        expect(uuid).toBeDefined()
        expect(uuid.length).toBe(36)
        expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)).toBe(true)
    })

    it("should generate verification token", () => {
        const token = generateVerificationToken()

        expect(token).toBeDefined()
        expect(typeof token).toBe("string")
        expect(token.length).toBeGreaterThan(20)
    })
})

// -----------------------------------------------------------------------------
// HMAC Signing Tests
// -----------------------------------------------------------------------------

describe("Crypto - HMAC", () => {
    const secret = "test-secret-key"

    it("should sign a value", () => {
        const signed = signValue("test", secret)

        expect(signed).toBeDefined()
        expect(signed.startsWith("test.")).toBe(true)
        expect(signed.split(".")).toHaveLength(2)
    })

    it("should verify valid signed value", () => {
        const signed = signValue("test", secret)
        const value = verifySignedValue(signed, secret)

        expect(value).toBe("test")
    })

    it("should reject tampered value", () => {
        const signed = signValue("test", secret)
        const tampered = signed.replace("test", "tampered")
        const value = verifySignedValue(tampered, secret)

        expect(value).toBeNull()
    })

    it("should reject tampered signature", () => {
        const signed = signValue("test", secret)
        const parts = signed.split(".")
        const tampered = `${parts[0]}.tampered-signature`
        const value = verifySignedValue(tampered, secret)

        expect(value).toBeNull()
    })

    it("should reject wrong secret", () => {
        const signed = signValue("test", secret)
        const value = verifySignedValue(signed, "wrong-secret")

        expect(value).toBeNull()
    })

    it("should sign with timestamp", () => {
        const signed = signWithTimestamp("test", secret)

        expect(signed).toBeDefined()
        expect(signed.includes("|")).toBe(true)
    })

    it("should verify timestamped value within age", () => {
        const signed = signWithTimestamp("test", secret)
        const value = verifyWithTimestamp(signed, secret, 60000) // 1 minute

        expect(value).toBe("test")
    })

    it("should reject expired timestamped value", async () => {
        const signed = signWithTimestamp("test", secret)

        // Wait a tiny bit then check with very short maxAge
        await new Promise(resolve => setTimeout(resolve, 10))
        const value = verifyWithTimestamp(signed, secret, 1) // 1ms max age

        expect(value).toBeNull()
    })
})
