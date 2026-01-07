// =============================================================================
// OAUTH - PKCE
// Proof Key for Code Exchange (RFC 7636)
// =============================================================================

import { randomBytes, createHash } from "crypto"

/**
 * Generate a cryptographically random code verifier
 * Length must be 43-128 characters (base64url)
 * 
 * @param length Number of random bytes (default: 32 = 43 chars after encoding)
 * @returns Base64URL encoded code verifier
 */
export function generateCodeVerifier(length: number = 32): string {
    const bytes = randomBytes(length)
    return bytes.toString("base64url")
}

/**
 * Generate code challenge from code verifier using SHA-256
 * 
 * @param codeVerifier The code verifier to hash
 * @returns Base64URL encoded SHA-256 hash (code challenge)
 */
export function generateCodeChallenge(codeVerifier: string): string {
    const hash = createHash("sha256")
        .update(codeVerifier, "ascii")
        .digest()
    return hash.toString("base64url")
}

/**
 * Generate both code verifier and challenge
 * 
 * @returns Object with codeVerifier and codeChallenge
 */
export function generatePKCEPair(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    return { codeVerifier, codeChallenge }
}

/**
 * Verify that a code verifier matches a code challenge
 * 
 * @param codeVerifier The code verifier to check
 * @param codeChallenge The expected code challenge
 * @returns True if valid
 */
export function verifyCodeChallenge(codeVerifier: string, codeChallenge: string): boolean {
    const computed = generateCodeChallenge(codeVerifier)
    return computed === codeChallenge
}
