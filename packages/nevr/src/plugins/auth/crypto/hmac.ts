// =============================================================================
// CRYPTO - HMAC SIGNATURES
// HMAC-based message signing for secure cookies
// =============================================================================

import { createHmac, timingSafeEqual } from "crypto"

// -----------------------------------------------------------------------------
// HMAC Signing
// -----------------------------------------------------------------------------

/**
 * Sign a value with HMAC-SHA256
 * 
 * @param value - Value to sign
 * @param secret - Secret key
 * @returns "value.signature" format
 * 
 * @example
 * ```typescript
 * const signed = signValue("user123", "my-secret")
 * // "user123.base64urlSignature"
 * ```
 */
export function signValue(value: string, secret: string): string {
    const signature = createHmac("sha256", secret)
        .update(value)
        .digest("base64url")
    return `${value}.${signature}`
}

/**
 * Verify and extract value from signed string
 * Uses timing-safe comparison to prevent timing attacks
 * 
 * @param signedValue - Signed value to verify
 * @param secret - Secret key used for signing
 * @returns Original value if valid, null if invalid
 * 
 * @example
 * ```typescript
 * const value = verifySignedValue(signedCookie, "my-secret")
 * if (value) {
 *     console.log("Valid:", value)
 * }
 * ```
 */
export function verifySignedValue(signedValue: string, secret: string): string | null {
    const lastDotIndex = signedValue.lastIndexOf(".")
    if (lastDotIndex === -1) return null

    const value = signedValue.slice(0, lastDotIndex)
    const signature = signedValue.slice(lastDotIndex + 1)

    const expectedSignature = createHmac("sha256", secret)
        .update(value)
        .digest("base64url")

    try {
        const sigBuffer = Buffer.from(signature, "base64url")
        const expectedBuffer = Buffer.from(expectedSignature, "base64url")

        if (sigBuffer.length !== expectedBuffer.length) {
            return null
        }

        if (timingSafeEqual(sigBuffer, expectedBuffer)) {
            return value
        }
    } catch {
        return null
    }

    return null
}

/**
 * Create a signed cookie value with timestamp
 * 
 * @param value - Value to sign
 * @param secret - Secret key
 * @returns Signed value with embedded timestamp
 */
export function signWithTimestamp(value: string, secret: string): string {
    const timestamp = Date.now().toString(36)
    const payload = `${value}|${timestamp}`
    return signValue(payload, secret)
}

/**
 * Verify signed value with timestamp and check expiry
 * 
 * @param signedValue - Signed value to verify
 * @param secret - Secret key
 * @param maxAgeMs - Maximum age in milliseconds
 * @returns Original value if valid and not expired, null otherwise
 */
export function verifyWithTimestamp(
    signedValue: string,
    secret: string,
    maxAgeMs: number
): string | null {
    const payload = verifySignedValue(signedValue, secret)
    if (!payload) return null

    const pipeIndex = payload.lastIndexOf("|")
    if (pipeIndex === -1) return null

    const value = payload.slice(0, pipeIndex)
    const timestamp = parseInt(payload.slice(pipeIndex + 1), 36)

    if (isNaN(timestamp)) return null
    if (Date.now() - timestamp > maxAgeMs) return null

    return value
}
