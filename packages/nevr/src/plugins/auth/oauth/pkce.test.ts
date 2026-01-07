// =============================================================================
// OAUTH - PKCE TESTS
// =============================================================================

import { describe, it, expect } from "vitest"
import {
    generateCodeVerifier,
    generateCodeChallenge,
    generatePKCEPair,
    verifyCodeChallenge,
} from "./pkce.js"

describe("OAuth - PKCE", () => {
    describe("generateCodeVerifier", () => {
        it("should generate a code verifier of correct length", () => {
            const verifier = generateCodeVerifier()
            // 32 bytes = 43 characters in base64url
            expect(verifier.length).toBe(43)
        })

        it("should generate unique verifiers", () => {
            const verifier1 = generateCodeVerifier()
            const verifier2 = generateCodeVerifier()
            expect(verifier1).not.toBe(verifier2)
        })

        it("should only contain base64url characters", () => {
            const verifier = generateCodeVerifier()
            expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
        })

        it("should respect custom length", () => {
            const verifier = generateCodeVerifier(64)
            // 64 bytes = 86 characters in base64url
            expect(verifier.length).toBe(86)
        })
    })

    describe("generateCodeChallenge", () => {
        it("should generate a code challenge from verifier", () => {
            const verifier = "test-code-verifier-12345"
            const challenge = generateCodeChallenge(verifier)

            expect(challenge).toBeDefined()
            expect(challenge.length).toBeGreaterThan(0)
        })

        it("should be deterministic", () => {
            const verifier = "test-code-verifier-12345"
            const challenge1 = generateCodeChallenge(verifier)
            const challenge2 = generateCodeChallenge(verifier)

            expect(challenge1).toBe(challenge2)
        })

        it("should produce different challenges for different verifiers", () => {
            const challenge1 = generateCodeChallenge("verifier1")
            const challenge2 = generateCodeChallenge("verifier2")

            expect(challenge1).not.toBe(challenge2)
        })
    })

    describe("generatePKCEPair", () => {
        it("should generate both verifier and challenge", () => {
            const { codeVerifier, codeChallenge } = generatePKCEPair()

            expect(codeVerifier).toBeDefined()
            expect(codeChallenge).toBeDefined()
            expect(codeVerifier.length).toBe(43)
        })

        it("should generate matching pair", () => {
            const { codeVerifier, codeChallenge } = generatePKCEPair()
            const computedChallenge = generateCodeChallenge(codeVerifier)

            expect(codeChallenge).toBe(computedChallenge)
        })
    })

    describe("verifyCodeChallenge", () => {
        it("should return true for valid pair", () => {
            const { codeVerifier, codeChallenge } = generatePKCEPair()

            expect(verifyCodeChallenge(codeVerifier, codeChallenge)).toBe(true)
        })

        it("should return false for invalid pair", () => {
            const { codeChallenge } = generatePKCEPair()

            expect(verifyCodeChallenge("wrong-verifier", codeChallenge)).toBe(false)
        })
    })
})
