// =============================================================================
// CRYPTO - JWT
// Simple JWT signing and verification for email verification tokens
// Using Node.js crypto module (no external dependencies like jose)
// =============================================================================

import { createHmac, timingSafeEqual } from "crypto"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface JWTPayload {
    [key: string]: unknown
    /** Issued at timestamp */
    iat?: number
    /** Expiration timestamp */
    exp?: number
}

export interface JWTHeader {
    alg: "HS256"
    typ: "JWT"
}

// -----------------------------------------------------------------------------
// Base64URL Encoding
// -----------------------------------------------------------------------------

function base64UrlEncode(data: string | Buffer): string {
    const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : data
    return buffer.toString("base64url")
}

function base64UrlDecode(data: string): string {
    return Buffer.from(data, "base64url").toString("utf8")
}

// -----------------------------------------------------------------------------
// JWT Functions
// -----------------------------------------------------------------------------

/**
 * Sign a JWT token with HMAC-SHA256
 * 
 * @param payload - Data to include in the token
 * @param secret - Secret key for signing
 * @param expiresInSeconds - Token expiration time in seconds (default: 1 hour)
 * @returns Signed JWT string
 */
export function signJWT(
    payload: JWTPayload,
    secret: string,
    expiresInSeconds: number = 3600
): string {
    const header: JWTHeader = { alg: "HS256", typ: "JWT" }
    const now = Math.floor(Date.now() / 1000)

    const fullPayload: JWTPayload = {
        ...payload,
        iat: now,
        exp: now + expiresInSeconds,
    }

    const headerString = base64UrlEncode(JSON.stringify(header))
    const payloadString = base64UrlEncode(JSON.stringify(fullPayload))
    const unsigned = `${headerString}.${payloadString}`

    const signature = createHmac("sha256", secret)
        .update(unsigned)
        .digest("base64url")

    return `${unsigned}.${signature}`
}

export interface VerifyJWTResult<T = JWTPayload> {
    valid: boolean
    payload: T | null
    error?: "invalid_format" | "invalid_signature" | "token_expired"
}

/**
 * Verify and decode a JWT token
 * 
 * @param token - JWT string to verify
 * @param secret - Secret key used for signing
 * @returns Verification result with payload if valid
 */
export function verifyJWT<T extends JWTPayload = JWTPayload>(
    token: string,
    secret: string
): VerifyJWTResult<T> {
    const parts = token.split(".")
    if (parts.length !== 3) {
        return { valid: false, payload: null, error: "invalid_format" }
    }

    const [headerString, payloadString, signature] = parts
    const unsigned = `${headerString}.${payloadString}`

    // Compute expected signature
    const expectedSignature = createHmac("sha256", secret)
        .update(unsigned)
        .digest("base64url")

    // Timing-safe comparison
    const signatureBuffer = Buffer.from(signature, "base64url")
    const expectedBuffer = Buffer.from(expectedSignature, "base64url")

    if (signatureBuffer.length !== expectedBuffer.length) {
        return { valid: false, payload: null, error: "invalid_signature" }
    }

    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return { valid: false, payload: null, error: "invalid_signature" }
    }

    // Decode and parse payload
    let payload: T
    try {
        payload = JSON.parse(base64UrlDecode(payloadString)) as T
    } catch {
        return { valid: false, payload: null, error: "invalid_format" }
    }

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, payload, error: "token_expired" }
    }

    return { valid: true, payload }
}

// -----------------------------------------------------------------------------
// Email Verification Token Helpers
// -----------------------------------------------------------------------------

export interface EmailVerificationPayload extends JWTPayload {
    email: string
    /** For email change flow - the new email to update to */
    updateTo?: string
    /** Request type for complex flows */
    requestType?: string
}

/**
 * Create an email verification token
 */
export function createEmailVerificationToken(
    secret: string,
    email: string,
    updateTo?: string,
    expiresInSeconds: number = 3600,
    extraPayload?: Record<string, unknown>
): string {
    const payload: EmailVerificationPayload = {
        email: email.toLowerCase(),
        ...(updateTo && { updateTo }),
        ...extraPayload,
    }
    return signJWT(payload, secret, expiresInSeconds)
}

/**
 * Verify an email verification token
 */
export function verifyEmailVerificationToken(
    token: string,
    secret: string
): VerifyJWTResult<EmailVerificationPayload> {
    return verifyJWT<EmailVerificationPayload>(token, secret)
}
