// =============================================================================
// CRYPTO - TOKEN GENERATION
// Secure random token generation for sessions and verification
// =============================================================================

import { randomBytes, randomUUID } from "crypto"

// -----------------------------------------------------------------------------
// Token Generation
// -----------------------------------------------------------------------------

/**
 * Generate a secure random session token
 * Uses 32 bytes (256 bits) of cryptographic randomness
 * 
 * @returns URL-safe base64 encoded token
 * 
 * @example
 * ```typescript
 * const token = generateSessionToken()
 * // "dGhpcyBpcyBhIHNlY3VyZSB0b2tlbg"
 * ```
 */
export function generateSessionToken(): string {
    return randomBytes(32).toString("base64url")
}

/**
 * Generate a unique ID (32 hex characters)
 * Uses 16 bytes (128 bits) of cryptographic randomness
 * 
 * @returns Hex encoded unique ID
 * 
 * @example
 * ```typescript
 * const id = generateId()
 * // "a1b2c3d4e5f6789012345678abcdef12"
 * ```
 */
export function generateId(): string {
    return randomBytes(16).toString("hex")
}

/**
 * Generate a UUID v4
 * 
 * @returns UUID string
 * 
 * @example
 * ```typescript
 * const uuid = generateUUID()
 * // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function generateUUID(): string {
    return randomUUID()
}

/**
 * Generate an email verification token
 * Uses 32 bytes (256 bits) of cryptographic randomness
 * 
 * @returns URL-safe base64 encoded verification token
 */
export function generateVerificationToken(): string {
    return randomBytes(32).toString("base64url")
}

/**
 * Generate a password reset token
 * Uses 32 bytes (256 bits) of cryptographic randomness
 * 
 * @returns URL-safe base64 encoded reset token
 */
export function generateResetToken(): string {
    return randomBytes(32).toString("base64url")
}

/**
 * Generate a TOTP secret for two-factor authentication
 * Uses 20 bytes (160 bits) as per TOTP standard
 * 
 * @returns Base32 encoded secret
 */
export function generateTOTPSecret(): string {
    const bytes = randomBytes(20)
    return base32Encode(bytes)
}

// -----------------------------------------------------------------------------
// Base32 Encoding (for TOTP)
// -----------------------------------------------------------------------------

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Encode(buffer: Buffer): string {
    let result = ""
    let bits = 0
    let value = 0

    for (const byte of buffer) {
        value = (value << 8) | byte
        bits += 8

        while (bits >= 5) {
            bits -= 5
            result += BASE32_CHARS[(value >> bits) & 0x1f]
        }
    }

    if (bits > 0) {
        result += BASE32_CHARS[(value << (5 - bits)) & 0x1f]
    }

    return result
}
