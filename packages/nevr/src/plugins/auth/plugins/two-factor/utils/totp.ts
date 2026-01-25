// =============================================================================
// TWO FACTOR - TOTP UTILITIES
// TOTP generation, verification, and URI generation
// =============================================================================

/**
 * Generate a random base32 secret
 */
export function generateSecret(length: number = 32): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    let secret = ""
    for (let i = 0; i < length; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return secret
}

/**
 * Generate a random OTP code
 */
export function generateOTP(length: number): string {
    let otp = ""
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10).toString()
    }
    return otp
}

/**
 * Decode base32 encoded string to bytes
 */
export function base32Decode(encoded: string): Uint8Array {
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

/**
 * Compute HMAC-SHA1
 */
export async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const crypto = await import("crypto")
    const hmac = crypto.createHmac("sha1", Buffer.from(key))
    hmac.update(Buffer.from(message))
    return new Uint8Array(hmac.digest())
}

/**
 * TOTP generation options
 */
export interface TOTPOptions {
    digits?: number
    period?: number
    counter?: number
}

/**
 * Generate a TOTP code
 */
export async function generateTOTP(secret: string, options: TOTPOptions = {}): Promise<string> {
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

/**
 * TOTP verification options
 */
export interface VerifyTOTPOptions {
    digits?: number
    period?: number
    window?: number
}

/**
 * Verify a TOTP code
 */
export async function verifyTOTP(
    secret: string,
    code: string,
    options: VerifyTOTPOptions = {}
): Promise<boolean> {
    const period = options.period ?? 30
    const window = options.window ?? 1
    const currentCounter = Math.floor(Date.now() / 1000 / period)

    for (let i = -window; i <= window; i++) {
        const expectedCode = await generateTOTP(secret, {
            ...options,
            counter: currentCounter + i
        })
        if (expectedCode === code) {
            return true
        }
    }
    return false
}

/**
 * Generate TOTP URI for authenticator apps
 */
export function generateTOTPUri(
    secret: string,
    email: string,
    issuer: string,
    options: { digits?: number; period?: number } = {}
): string {
    const digits = options.digits ?? 6
    const period = options.period ?? 30
    const encodedIssuer = encodeURIComponent(issuer)
    const encodedEmail = encodeURIComponent(email)
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${digits}&period=${period}`
}
