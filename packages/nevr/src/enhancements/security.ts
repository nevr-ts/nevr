// =============================================================================
// SECURITY ENHANCEMENT
// Password hashing, field omission, and encryption 
//
// Uses Node.js built-in PBKDF2 for password hashing:
// - Zero dependencies (built into Node.js crypto)
// - Predictable memory usage (no memory-related errors)
// - Consistent with auth plugin implementation
//
// Encryption uses AES-256-GCM with key rotation support:
// - Multiple keys can be registered with unique IDs
// - Primary key for encryption, all keys for decryption
// - Supports seamless key rotation without data loss
// =============================================================================

import type { Entity } from "../types.js"
import { getLogger } from "../logger.js"
import { pbkdf2, randomBytes, timingSafeEqual } from "crypto"

// -----------------------------------------------------------------------------
// Password Hashing (using Node.js PBKDF2)
//
// PBKDF2 parameters:
// - iterations: Higher = more secure but slower
//   - Default: ~1 million iterations (2^10 * 1000)
// - keyLength: 32 bytes (256 bits)
// - digest: SHA-256
// - Format: $pbkdf2$iterations$salt$hash
// -----------------------------------------------------------------------------

const HASH_LENGTH = 32       // 256 bits
const SALT_LENGTH = 16       // 128 bits
const DIGEST = "sha256"
const DEFAULT_COST = 10      // 2^10 * 1000 = 1,024,000 iterations

/**
 * Hash a password using PBKDF2
 * 
 * @param password - The password to hash
 * @param cost - Cost factor (default: 10). Iterations = 2^cost * 1000
 * @returns PBKDF2 hash in format: `$pbkdf2$iterations$salt$hash`
 */
export async function hashPassword(
  password: string,
  cost: number = DEFAULT_COST
): Promise<string> {
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
 * Verify a password against a PBKDF2 hash
 * Uses timing-safe comparison to prevent timing attacks
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split("$")

  // Validate PBKDF2 format: $pbkdf2$iterations$salt$hash
  if (parts.length !== 5 || parts[1] !== "pbkdf2") {
    getLogger().warn("[Nevr] Invalid hash format. Only PBKDF2 hashes are supported.")
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
 * Check if a value is a valid PBKDF2 password hash
 */
export function isPasswordHash(value: string): boolean {
  const parts = value.split("$")
  // Format: $pbkdf2$iterations$salt$hash
  return parts.length === 5 && parts[1] === "pbkdf2" && !isNaN(parseInt(parts[2], 10))
}

// -----------------------------------------------------------------------------
// Field Encryption (using Web Crypto API with Key Rotation Support)
//
// Key Management Strategy:
// - Multiple keys can be registered with unique key IDs
// - Primary key (latest) is used for all new encryptions
// - All registered keys are available for decryption
// - Encrypted format: keyId:iv:ciphertext (base64 encoded)
// - Supports seamless key rotation without data re-encryption
// -----------------------------------------------------------------------------

const ALGORITHM = "AES-GCM"
const AES_KEY_BITS = 256      // AES-256 = 256-bit key
const AES_KEY_BYTES = 32      // 256 bits / 8 = 32 bytes
const IV_LENGTH = 12          // 96-bit IV (recommended for GCM)
const TAG_LENGTH = 128        // 128-bit auth tag
const DEFAULT_KEY_ID = "default"

// Key registry for rotation support
interface EncryptionKeyEntry {
  key: CryptoKey
  createdAt: Date
}

const encryptionKeys = new Map<string, EncryptionKeyEntry>()
let primaryKeyId: string | null = null

/**
 * Initialize encryption with a key (single key mode - backwards compatible)
 * @param key Base64-encoded key or raw key bytes
 * @param keyId Optional key identifier (defaults to "default")
 */
export async function initEncryption(
  key: string | Uint8Array,
  keyId: string = DEFAULT_KEY_ID
): Promise<void> {
  await registerEncryptionKey(key, keyId)
  primaryKeyId = keyId
}

/**
 * Register an encryption key for use in decryption
 * First registered key becomes the primary key for encryption
 * 
 * @param key Base64-encoded key or raw key bytes
 * @param keyId Unique identifier for this key
 */
export async function registerEncryptionKey(
  key: string | Uint8Array,
  keyId: string
): Promise<void> {
  const keyData = typeof key === "string"
    ? Uint8Array.from(atob(key), (c) => c.charCodeAt(0))
    : key

  if (keyData.length !== AES_KEY_BYTES) {
    throw new Error(`[Nevr] Encryption key must be ${AES_KEY_BYTES} bytes (${AES_KEY_BITS} bits)`)
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData.buffer.slice(keyData.byteOffset, keyData.byteOffset + keyData.byteLength) as ArrayBuffer,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  )

  encryptionKeys.set(keyId, {
    key: cryptoKey,
    createdAt: new Date()
  })

  // Set as primary if it's the first key
  if (primaryKeyId === null) {
    primaryKeyId = keyId
  }

  getLogger().debug(`Registered encryption key: ${keyId}`)
}

/**
 * Set the primary key for encryption
 * @param keyId The key ID to use for all new encryptions
 */
export function setPrimaryEncryptionKey(keyId: string): void {
  if (!encryptionKeys.has(keyId)) {
    throw new Error(`[Nevr] Encryption key "${keyId}" not registered`)
  }
  primaryKeyId = keyId
  getLogger().info(`Primary encryption key set to: ${keyId}`)
}

/**
 * Get all registered key IDs
 */
export function getRegisteredKeyIds(): string[] {
  return Array.from(encryptionKeys.keys())
}

/**
 * Remove an old key (after data has been re-encrypted)
 * Cannot remove the primary key
 */
export function removeEncryptionKey(keyId: string): boolean {
  if (keyId === primaryKeyId) {
    throw new Error("[Nevr] Cannot remove primary encryption key. Set a new primary key first.")
  }
  return encryptionKeys.delete(keyId)
}

/**
 * Clear all encryption keys (useful for testing)
 */
export function clearEncryptionKeys(): void {
  encryptionKeys.clear()
  primaryKeyId = null
}

/**
 * Generate a new encryption key
 * @returns Base64-encoded AES-256 key (32 bytes)
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = crypto.getRandomValues(new Uint8Array(AES_KEY_BYTES))
  return btoa(String.fromCharCode(...key))
}

/**
 * Encrypt a string value using the primary key
 * 
 * @param value - The plaintext value to encrypt
 * @returns Encrypted value in format: `keyId:base64(iv + ciphertext + authTag)`
 * @throws If encryption is not initialized
 */
export async function encryptValue(value: string): Promise<string> {
  if (!primaryKeyId || !encryptionKeys.has(primaryKeyId)) {
    throw new Error(
      "[Nevr] Encryption not initialized. Call initEncryption() first."
    )
  }

  const keyEntry = encryptionKeys.get(primaryKeyId)!
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(value)

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    keyEntry.key,
    encoded
  )

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)

  // Include key ID for key rotation support
  return `${primaryKeyId}:${btoa(String.fromCharCode(...combined))}`
}

/**
 * Decrypt a string value, supporting key rotation
 * 
 * Tries to determine key from encrypted format, falls back to trying all keys
 * for backwards compatibility with legacy encrypted data.
 * 
 * @param encrypted - The encrypted value (keyId:base64 or legacy base64)
 * @returns Decrypted plaintext value
 * @throws If no registered key can decrypt the value
 */
export async function decryptValue(encrypted: string): Promise<string> {
  if (encryptionKeys.size === 0) {
    throw new Error(
      "[Nevr] Encryption not initialized. Call initEncryption() first."
    )
  }

  // Check for new format with key ID prefix
  const colonIndex = encrypted.indexOf(":")
  if (colonIndex > 0 && colonIndex < 32) {
    const potentialKeyId = encrypted.substring(0, colonIndex)
    const encryptedData = encrypted.substring(colonIndex + 1)

    if (encryptionKeys.has(potentialKeyId)) {
      return decryptWithKey(encryptedData, potentialKeyId)
    }
  }

  // Legacy format without key ID - try all keys
  return decryptLegacyValue(encrypted)
}

/**
 * Decrypt with a specific key
 */
async function decryptWithKey(encrypted: string, keyId: string): Promise<string> {
  const keyEntry = encryptionKeys.get(keyId)
  if (!keyEntry) {
    throw new Error(`[Nevr] Encryption key "${keyId}" not found`)
  }

  try {
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, IV_LENGTH)
    const ciphertext = combined.slice(IV_LENGTH)

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      keyEntry.key,
      ciphertext
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    throw new Error(`[Nevr] Failed to decrypt with key "${keyId}" - invalid key or corrupted data`)
  }
}

/**
 * Decrypt legacy format (no key ID) by trying all registered keys
 */
async function decryptLegacyValue(encrypted: string): Promise<string> {
  const errors: string[] = []

  // Try each registered key
  for (const [keyId, keyEntry] of encryptionKeys) {
    try {
      const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
      const iv = combined.slice(0, IV_LENGTH)
      const ciphertext = combined.slice(IV_LENGTH)

      const decrypted = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
        keyEntry.key,
        ciphertext
      )

      return new TextDecoder().decode(decrypted)
    } catch (e) {
      errors.push(`${keyId}: ${e instanceof Error ? e.message : "unknown error"}`)
    }
  }

  throw new Error(`[Nevr] Failed to decrypt value with any registered key. Tried: ${errors.join(", ")}`)
}

/**
 * Re-encrypt a value with the current primary key
 * Useful for key rotation - decrypt with old key, encrypt with new key
 */
export async function reEncryptValue(encrypted: string): Promise<string> {
  const decrypted = await decryptValue(encrypted)
  return encryptValue(decrypted)
}

/**
 * Re-encrypt all encrypted fields in a record with the current primary key
 * Returns the updated record and count of re-encrypted fields
 */
export async function reEncryptRecord(
  data: Record<string, unknown>,
  entity: Entity
): Promise<{ data: Record<string, unknown>; reEncryptedCount: number }> {
  const result: Record<string, unknown> = { ...data }
  let reEncryptedCount = 0

  for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
    if (!fieldDef.security?.encrypted) continue

    const value = data[fieldName]
    if (typeof value !== "string" || !isEncrypted(value)) continue

    // Check if already encrypted with primary key
    const colonIndex = value.indexOf(":")
    if (colonIndex > 0 && colonIndex < 32) {
      const keyId = value.substring(0, colonIndex)
      if (keyId === primaryKeyId) continue // Already using primary key
    }

    // Re-encrypt with primary key
    result[fieldName] = await reEncryptValue(value)
    reEncryptedCount++
  }

  return { data: result, reEncryptedCount }
}

/**
 * Check if a value appears to be encrypted
 * Supports both new format (keyId:base64) and legacy format (base64 only)
 */
export function isEncrypted(value: string): boolean {
  try {
    // New format: keyId:base64data
    const colonIndex = value.indexOf(":")
    if (colonIndex > 0 && colonIndex < 32) {
      const base64Part = value.substring(colonIndex + 1)
      const decoded = atob(base64Part)
      // IV (12) + at least 1 byte ciphertext + tag (16) = minimum 29 bytes
      return decoded.length >= 29
    }

    // Legacy format: just base64 data
    const decoded = atob(value)
    return decoded.length >= 29
  } catch {
    return false
  }
}

/**
 * Get the key ID used to encrypt a value (if available)
 * Returns null for legacy format without key ID
 */
export function getEncryptionKeyId(encrypted: string): string | null {
  const colonIndex = encrypted.indexOf(":")
  if (colonIndex > 0 && colonIndex < 32) {
    const potentialKeyId = encrypted.substring(0, colonIndex)
    // Validate it looks like a key ID (no special chars that would be in base64)
    if (!/[+/=]/.test(potentialKeyId)) {
      return potentialKeyId
    }
  }
  return null
}

// -----------------------------------------------------------------------------
// Security Processing
// -----------------------------------------------------------------------------

/**
 * Process data before writing to database
 * - Hash password fields
 * - Encrypt encrypted fields
 */
export async function processWriteData(
  data: Record<string, unknown>,
  entity: Entity
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...data }

  for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
    if (!(fieldName in data)) continue

    const value = data[fieldName]
    if (typeof value !== "string" || !value) continue

    const security = fieldDef.security

    // Hash password fields (only if not already hashed)
    if (security?.password && !isPasswordHash(value)) {
      const cost = security.password.cost ?? 1
      result[fieldName] = await hashPassword(value, cost)
    }

    // Encrypt fields (only if not already encrypted)
    if (security?.encrypted && !isEncrypted(value)) {
      result[fieldName] = await encryptValue(value)
    }
  }

  return result
}

/**
 * Process data after reading from database
 * - Omit fields marked with omit
 * - Decrypt encrypted fields
 */
export async function processReadData(
  data: Record<string, unknown>,
  entity: Entity
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...data }

  for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
    const security = fieldDef.security

    // Omit fields
    if (security?.omit) {
      delete result[fieldName]
      continue
    }

    // Decrypt fields
    if (security?.encrypted && fieldName in result) {
      const value = result[fieldName]
      if (typeof value === "string" && isEncrypted(value)) {
        try {
          result[fieldName] = await decryptValue(value)
        } catch {
          // Keep encrypted value if decryption fails
          getLogger().warn(`[Nevr] Failed to decrypt field "${fieldName}"`)
        }
      }
    }
  }

  return result
}

/**
 * Process array of records
 */
export async function processReadDataArray(
  data: Record<string, unknown>[],
  entity: Entity
): Promise<Record<string, unknown>[]> {
  return Promise.all(data.map((item) => processReadData(item, entity)))
}

// -----------------------------------------------------------------------------
// Security Metadata
// -----------------------------------------------------------------------------

/**
 * Get list of password fields
 */
export function getPasswordFields(entity: Entity): string[] {
  return Object.entries(entity.config.fields)
    .filter(([_, field]) => field.security?.password)
    .map(([name]) => name)
}

/**
 * Get list of omit fields
 */
export function getOmitFields(entity: Entity): string[] {
  return Object.entries(entity.config.fields)
    .filter(([_, field]) => field.security?.omit)
    .map(([name]) => name)
}

/**
 * Get list of encrypted fields
 */
export function getEncryptedFields(entity: Entity): string[] {
  return Object.entries(entity.config.fields)
    .filter(([_, field]) => field.security?.encrypted)
    .map(([name]) => name)
}

/**
 * Check if entity has any security fields
 */
export function hasSecurityFields(entity: Entity): boolean {
  return Object.values(entity.config.fields).some(
    (field) => field.security && Object.keys(field.security).length > 0
  )
}
