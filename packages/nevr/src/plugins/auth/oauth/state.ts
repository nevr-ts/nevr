// =============================================================================
// OAUTH - STATE
// State management for OAuth flows (CSRF protection, linking, etc.)
// =============================================================================

import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto"
import type { OAuthState } from "./types.js"

const ALGORITHM = "aes-256-gcm"
const STATE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Derive a 32-byte key from secret using SHA-256
 */
function deriveKey(secret: string): Buffer {
    return createHash("sha256").update(secret).digest()
}

/**
 * Generate a random nonce for state
 */
export function generateNonce(): string {
    return randomBytes(16).toString("hex")
}

/**
 * Encrypt and encode OAuth state
 * 
 * @param state State payload to encrypt
 * @param secret Secret key for encryption
 * @returns Base64URL encoded encrypted state
 */
export function encryptState(state: OAuthState, secret: string): string {
    const key = deriveKey(secret)
    const iv = randomBytes(12)

    const cipher = createCipheriv(ALGORITHM, key, iv)
    const json = JSON.stringify(state)

    const encrypted = Buffer.concat([
        cipher.update(json, "utf8"),
        cipher.final(),
    ])

    const authTag = cipher.getAuthTag()

    // Format: iv (12 bytes) + authTag (16 bytes) + encrypted data
    const combined = Buffer.concat([iv, authTag, encrypted])
    return combined.toString("base64url")
}

/**
 * Decrypt and parse OAuth state
 * 
 * @param encryptedState Base64URL encoded encrypted state
 * @param secret Secret key for decryption
 * @returns Parsed state or null if invalid
 */
export function decryptState(encryptedState: string, secret: string): OAuthState | null {
    try {
        const key = deriveKey(secret)
        const combined = Buffer.from(encryptedState, "base64url")

        if (combined.length < 28) {
            return null // Too short (12 + 16 minimum)
        }

        const iv = combined.subarray(0, 12)
        const authTag = combined.subarray(12, 28)
        const encrypted = combined.subarray(28)

        const decipher = createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ])

        return JSON.parse(decrypted.toString("utf8")) as OAuthState
    } catch {
        return null
    }
}

/**
 * Create a new OAuth state with auto-generated nonce and timestamp
 */
export function createState(
    provider: string,
    callbackURL: string,
    options?: {
        userId?: string
        email?: string
        errorURL?: string
        codeVerifier?: string
        extra?: Record<string, any>
    }
): OAuthState {
    return {
        nonce: generateNonce(),
        provider,
        callbackURL,
        timestamp: Date.now(),
        ...options,
    }
}

/**
 * Generate encrypted state string for OAuth flow
 */
export function generateState(
    provider: string,
    callbackURL: string,
    secret: string,
    options?: {
        userId?: string
        email?: string
        errorURL?: string
        codeVerifier?: string
        extra?: Record<string, any>
    }
): string {
    const state = createState(provider, callbackURL, options)
    return encryptState(state, secret)
}

/**
 * Parse and validate state from OAuth callback
 */
export function parseState(
    encryptedState: string,
    secret: string
): { valid: true; state: OAuthState } | { valid: false; error: string } {
    const state = decryptState(encryptedState, secret)

    if (!state) {
        return { valid: false, error: "Invalid state" }
    }

    // Check expiry
    if (Date.now() - state.timestamp > STATE_EXPIRY_MS) {
        return { valid: false, error: "State expired" }
    }

    return { valid: true, state }
}
