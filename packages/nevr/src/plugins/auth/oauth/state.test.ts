// =============================================================================
// OAUTH - STATE TESTS
// =============================================================================

import { describe, it, expect } from "vitest"
import {
    generateNonce,
    encryptState,
    decryptState,
    createState,
    generateState,
    parseState,
} from "./state.js"
import type { OAuthState } from "./types.js"

describe("OAuth - State", () => {
    const secret = "test-secret-key-for-oauth-state-encryption"

    describe("generateNonce", () => {
        it("should generate a hex string", () => {
            const nonce = generateNonce()
            expect(nonce).toMatch(/^[0-9a-f]+$/)
        })

        it("should generate unique nonces", () => {
            const nonce1 = generateNonce()
            const nonce2 = generateNonce()
            expect(nonce1).not.toBe(nonce2)
        })

        it("should be 32 characters (16 bytes hex)", () => {
            const nonce = generateNonce()
            expect(nonce.length).toBe(32)
        })
    })

    describe("encryptState / decryptState", () => {
        it("should encrypt and decrypt state", () => {
            const state: OAuthState = {
                nonce: "testnonce",
                provider: "google",
                callbackURL: "/dashboard",
                timestamp: Date.now(),
            }

            const encrypted = encryptState(state, secret)
            const decrypted = decryptState(encrypted, secret)

            expect(decrypted).toEqual(state)
        })

        it("should produce different ciphertexts for same plaintext", () => {
            const state: OAuthState = {
                nonce: "testnonce",
                provider: "google",
                callbackURL: "/",
                timestamp: Date.now(),
            }

            const encrypted1 = encryptState(state, secret)
            const encrypted2 = encryptState(state, secret)

            expect(encrypted1).not.toBe(encrypted2)
        })

        it("should fail decryption with wrong secret", () => {
            const state: OAuthState = {
                nonce: "testnonce",
                provider: "google",
                callbackURL: "/",
                timestamp: Date.now(),
            }

            const encrypted = encryptState(state, secret)
            const decrypted = decryptState(encrypted, "wrong-secret")

            expect(decrypted).toBeNull()
        })

        it("should fail decryption with invalid data", () => {
            expect(decryptState("invalid-data", secret)).toBeNull()
            expect(decryptState("", secret)).toBeNull()
        })

        it("should handle all state fields", () => {
            const state: OAuthState = {
                nonce: "testnonce",
                provider: "github",
                callbackURL: "/profile",
                userId: "user-123",
                email: "test@example.com",
                errorURL: "/error",
                codeVerifier: "pkce-verifier",
                timestamp: Date.now(),
                extra: { foo: "bar" },
            }

            const encrypted = encryptState(state, secret)
            const decrypted = decryptState(encrypted, secret)

            expect(decrypted).toEqual(state)
        })
    })

    describe("createState", () => {
        it("should create state with auto-generated nonce and timestamp", () => {
            const state = createState("google", "/callback")

            expect(state.nonce).toBeDefined()
            expect(state.nonce.length).toBe(32)
            expect(state.provider).toBe("google")
            expect(state.callbackURL).toBe("/callback")
            expect(state.timestamp).toBeDefined()
            expect(state.timestamp).toBeGreaterThan(0)
        })

        it("should include optional fields", () => {
            const state = createState("github", "/", {
                userId: "user-123",
                email: "test@example.com",
                codeVerifier: "verifier",
            })

            expect(state.userId).toBe("user-123")
            expect(state.email).toBe("test@example.com")
            expect(state.codeVerifier).toBe("verifier")
        })
    })

    describe("generateState", () => {
        it("should return encrypted state string", () => {
            const encrypted = generateState("google", "/callback", secret)

            expect(typeof encrypted).toBe("string")
            expect(encrypted.length).toBeGreaterThan(0)
        })

        it("should be decryptable", () => {
            const encrypted = generateState("google", "/callback", secret)
            const decrypted = decryptState(encrypted, secret)

            expect(decrypted).not.toBeNull()
            expect(decrypted?.provider).toBe("google")
            expect(decrypted?.callbackURL).toBe("/callback")
        })
    })

    describe("parseState", () => {
        it("should parse valid state", () => {
            const encrypted = generateState("google", "/callback", secret)
            const result = parseState(encrypted, secret)

            expect(result.valid).toBe(true)
            if (result.valid) {
                expect(result.state.provider).toBe("google")
            }
        })

        it("should reject invalid state", () => {
            const result = parseState("invalid-state", secret)

            expect(result.valid).toBe(false)
            if (!result.valid) {
                expect(result.error).toBe("Invalid state")
            }
        })

        it("should reject expired state", async () => {
            // Create state with old timestamp
            const state: OAuthState = {
                nonce: "testnonce",
                provider: "google",
                callbackURL: "/",
                timestamp: Date.now() - 15 * 60 * 1000, // 15 minutes ago
            }
            const encrypted = encryptState(state, secret)

            const result = parseState(encrypted, secret)

            expect(result.valid).toBe(false)
            if (!result.valid) {
                expect(result.error).toBe("State expired")
            }
        })
    })
})
