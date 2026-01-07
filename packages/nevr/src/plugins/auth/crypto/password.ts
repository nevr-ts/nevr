// =============================================================================
// CRYPTO - PASSWORD HASHING
// PBKDF2-based password hashing (secure alternative to bcrypt)
// =============================================================================

import { randomBytes, timingSafeEqual, pbkdf2 } from "crypto"

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const DEFAULT_COST = 10 // 2^10 * 1000 = 1,024,000 iterations
const HASH_LENGTH = 32
const SALT_LENGTH = 16
const DIGEST = "sha256"

// -----------------------------------------------------------------------------
// Password Hashing
// -----------------------------------------------------------------------------

/**
 * Hash a password using PBKDF2
 * Format: $pbkdf2$iterations$salt$hash
 * 
 * @param password - Plain text password
 * @param cost - Cost factor (default: 10)
 * @returns Hashed password string
 * 
 * @example
 * ```typescript
 * const hash = await hashPassword("mypassword123")
 * // "$pbkdf2$1024000$base64salt$base64hash"
 * ```
 */
export async function hashPassword(password: string, cost: number = DEFAULT_COST): Promise<string> {
    const iterations = Math.pow(2, cost) * 1000
    const salt = randomBytes(SALT_LENGTH).toString("base64")

    return new Promise((resolve, reject) => {
        pbkdf2(password, salt, iterations, HASH_LENGTH, DIGEST, (err, derivedKey) => {
            if (err) return reject(err)
            const hash = derivedKey.toString("base64")
            resolve(`$pbkdf2$${iterations}$${salt}$${hash}`)
        })
    })
}

/**
 * Verify a password against a stored hash
 * Uses timing-safe comparison to prevent timing attacks
 * 
 * @param password - Plain text password to verify
 * @param storedHash - Previously hashed password
 * @returns true if password matches
 * 
 * @example
 * ```typescript
 * const isValid = await verifyPassword("mypassword123", storedHash)
 * ```
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split("$")

    // Handle legacy bcrypt hashes (migration needed)
    if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$")) {
        return false
    }

    // Validate PBKDF2 format: $pbkdf2$iterations$salt$hash
    if (parts.length !== 5 || parts[1] !== "pbkdf2") {
        return false
    }

    const iterations = parseInt(parts[2], 10)
    const salt = parts[3]
    const storedHashValue = parts[4]

    return new Promise((resolve) => {
        pbkdf2(password, salt, iterations, HASH_LENGTH, DIGEST, (err, derivedKey) => {
            if (err) return resolve(false)

            const computedHash = derivedKey.toString("base64")

            try {
                const storedBuffer = Buffer.from(storedHashValue, "base64")
                const computedBuffer = Buffer.from(computedHash, "base64")

                if (storedBuffer.length !== computedBuffer.length) {
                    return resolve(false)
                }

                resolve(timingSafeEqual(storedBuffer, computedBuffer))
            } catch {
                resolve(false)
            }
        })
    })
}

/**
 * Check if a hash needs rehashing (cost increase)
 * 
 * @param hash - Stored hash
 * @param cost - Current cost setting
 * @returns true if hash should be regenerated
 */
export function needsRehash(hash: string, cost: number = DEFAULT_COST): boolean {
    const parts = hash.split("$")
    if (parts.length !== 5 || parts[1] !== "pbkdf2") {
        return true // Not our format
    }

    const storedIterations = parseInt(parts[2], 10)
    const currentIterations = Math.pow(2, cost) * 1000

    return storedIterations < currentIterations
}
