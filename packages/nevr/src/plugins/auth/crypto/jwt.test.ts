// =============================================================================
// JWT MODULE TESTS
// Tests for JWT signing, verification, and email verification tokens
// =============================================================================

import { describe, it, expect } from "vitest"
import {
    signJWT,
    verifyJWT,
    createEmailVerificationToken,
    verifyEmailVerificationToken,
} from "./jwt.js"

describe("JWT - Sign and Verify", () => {
    const secret = "test-secret-key-for-jwt"

    it("should sign a JWT with payload", () => {
        const token = signJWT({ email: "test@example.com" }, secret)

        expect(token).toBeDefined()
        expect(token.split(".")).toHaveLength(3)
    })

    it("should verify a valid JWT", () => {
        const payload = { email: "test@example.com", name: "Test User" }
        const token = signJWT(payload, secret)

        const result = verifyJWT(token, secret)

        expect(result.valid).toBe(true)
        expect(result.payload).not.toBeNull()
        expect(result.payload?.email).toBe("test@example.com")
        expect(result.payload?.name).toBe("Test User")
    })

    it("should include iat and exp in payload", () => {
        const token = signJWT({ foo: "bar" }, secret, 3600)
        const result = verifyJWT(token, secret)

        expect(result.valid).toBe(true)
        expect(result.payload?.iat).toBeDefined()
        expect(result.payload?.exp).toBeDefined()
        expect(result.payload?.exp).toBeGreaterThan(result.payload?.iat as number)
    })

    it("should reject invalid format", () => {
        const result = verifyJWT("not-a-valid-jwt", secret)

        expect(result.valid).toBe(false)
        expect(result.error).toBe("invalid_format")
    })

    it("should reject tampered signature", () => {
        const token = signJWT({ email: "test@example.com" }, secret)
        const parts = token.split(".")
        const tampered = `${parts[0]}.${parts[1]}.tampered-signature`

        const result = verifyJWT(tampered, secret)

        expect(result.valid).toBe(false)
        expect(result.error).toBe("invalid_signature")
    })

    it("should reject wrong secret", () => {
        const token = signJWT({ email: "test@example.com" }, secret)

        const result = verifyJWT(token, "wrong-secret")

        expect(result.valid).toBe(false)
        expect(result.error).toBe("invalid_signature")
    })

    it("should reject expired token", async () => {
        // Create token that expires in 1 second
        const token = signJWT({ email: "test@example.com" }, secret, 1)

        // Wait for expiration (2s to ensure we're past the expiry second boundary)
        await new Promise(resolve => setTimeout(resolve, 2100))

        const result = verifyJWT(token, secret)

        expect(result.valid).toBe(false)
        expect(result.error).toBe("token_expired")
        // Payload should still be returned for expired tokens
        expect(result.payload?.email).toBe("test@example.com")
    }, 10000)
})

describe("JWT - Email Verification Token", () => {
    const secret = "email-verification-secret"

    it("should create email verification token", () => {
        const token = createEmailVerificationToken(secret, "user@example.com")

        expect(token).toBeDefined()
        expect(token.split(".")).toHaveLength(3)
    })

    it("should verify email verification token", () => {
        const token = createEmailVerificationToken(secret, "user@example.com")

        const result = verifyEmailVerificationToken(token, secret)

        expect(result.valid).toBe(true)
        expect(result.payload?.email).toBe("user@example.com")
    })

    it("should lowercase email", () => {
        const token = createEmailVerificationToken(secret, "USER@EXAMPLE.COM")

        const result = verifyEmailVerificationToken(token, secret)

        expect(result.payload?.email).toBe("user@example.com")
    })

    it("should include updateTo when provided", () => {
        const token = createEmailVerificationToken(
            secret,
            "old@example.com",
            "new@example.com"
        )

        const result = verifyEmailVerificationToken(token, secret)

        expect(result.payload?.email).toBe("old@example.com")
        expect(result.payload?.updateTo).toBe("new@example.com")
    })

    it("should include extra payload", () => {
        const token = createEmailVerificationToken(
            secret,
            "user@example.com",
            undefined,
            3600,
            { requestType: "change-email-confirmation" }
        )

        const result = verifyEmailVerificationToken(token, secret)

        expect(result.payload?.requestType).toBe("change-email-confirmation")
    })

    it("should use custom expiration", () => {
        const token = createEmailVerificationToken(secret, "user@example.com", undefined, 7200)

        const result = verifyEmailVerificationToken(token, secret)

        expect(result.valid).toBe(true)
        // Check expiration is 2 hours from now (7200 seconds)
        const exp = result.payload?.exp!
        const iat = result.payload?.iat!
        expect(exp - iat).toBe(7200)
    })
})
