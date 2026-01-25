// =============================================================================
// TWO FACTOR - BACKUP CODES UTILITIES
// Backup codes generation, encryption, and verification
// =============================================================================

/**
 * Generate a single backup code
 */
export function generateBackupCode(length: number): string {
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ" // Excluding ambiguous chars
    let code = ""
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

/**
 * Generate multiple backup codes
 */
export function generateBackupCodes(count: number, length: number): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
        codes.push(generateBackupCode(length))
    }
    return codes
}

/**
 * Encrypt backup codes for storage
 */
export async function encryptBackupCodes(codes: string[], secret: string): Promise<string> {
    const crypto = await import("crypto")
    const key = crypto.createHash("sha256").update(secret).digest()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv)
    let encrypted = cipher.update(JSON.stringify(codes), "utf8", "base64")
    encrypted += cipher.final("base64")
    return iv.toString("base64") + ":" + encrypted
}

/**
 * Decrypt backup codes from storage
 */
export async function decryptBackupCodes(encrypted: string, secret: string): Promise<string[]> {
    const crypto = await import("crypto")
    const [ivStr, data] = encrypted.split(":")
    const key = crypto.createHash("sha256").update(secret).digest()
    const iv = Buffer.from(ivStr, "base64")
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)
    let decrypted = decipher.update(data, "base64", "utf8")
    decrypted += decipher.final("utf8")
    return JSON.parse(decrypted)
}
