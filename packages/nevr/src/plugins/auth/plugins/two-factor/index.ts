// =============================================================================
// TWO FACTOR PLUGIN
// TOTP, OTP, and Backup Codes for enhanced security
// =============================================================================

import { endpoint, z, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import { getInternalAdapter } from "../../index.js"
import { generateId, verifyPassword } from "../../crypto/index.js"
import { createCookieHeader } from "../../cookies/index.js"
import { TWO_FACTOR_ERROR_CODES } from "./error-codes.js"
import { getTwoFactorSchema } from "./schema.js"

// Re-exports
export * from "./error-codes.js"
export { getTwoFactorSchema } from "./schema.js"
export { twoFactorClient } from "./client.js"

// =============================================================================
// Types
// =============================================================================

export interface TwoFactorOptions {
    /**
     * Application name for TOTP issuer
     */
    issuer?: string

    /**
     * TOTP options
     */
    totp?: {
        /**
         * Number of digits for TOTP
         * @default 6
         */
        digits?: number
        /**
         * Period in seconds
         * @default 30
         */
        period?: number
        /**
         * Window for code validation (number of periods before/after)
         * @default 1
         */
        window?: number
    }

    /**
     * OTP options for email/sms based 2FA
     */
    otp?: {
        /**
         * OTP expiration in seconds
         * @default 300 (5 minutes)
         */
        expiresIn?: number
        /**
         * OTP length
         * @default 6
         */
        length?: number
        /**
         * Send OTP implementation
         */
        sendOTP?: (data: { email: string; code: string; userId: string }) => Promise<void>
    }

    /**
     * Backup codes options
     */
    backupCodes?: {
        /**
         * Number of backup codes to generate
         * @default 10
         */
        count?: number
        /**
         * Length of each backup code
         * @default 8
         */
        length?: number
    }

    /**
     * Skip TOTP verification on enable (useful for testing)
     * @default false
     */
    skipVerificationOnEnable?: boolean

    /**
     * Trust device duration in seconds
     * @default 2592000 (30 days)
     */
    trustDeviceDuration?: number

    /**
     * Session configuration
     */
    session?: {
        expiresIn?: number
        cookieName?: string
        cookie?: {
            secure?: boolean
            httpOnly?: boolean
            sameSite?: "strict" | "lax" | "none"
            path?: string
            domain?: string
        }
    }
}

// =============================================================================
// TOTP Utilities
// =============================================================================

function generateSecret(length: number = 32): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    let secret = ""
    for (let i = 0; i < length; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return secret
}

function generateOTP(length: number): string {
    let otp = ""
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10).toString()
    }
    return otp
}

function base32Decode(encoded: string): Uint8Array {
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

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const crypto = await import("crypto")
    const hmac = crypto.createHmac("sha1", Buffer.from(key))
    hmac.update(Buffer.from(message))
    return new Uint8Array(hmac.digest())
}

async function generateTOTP(secret: string, options: { digits?: number; period?: number; counter?: number } = {}): Promise<string> {
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

async function verifyTOTP(
    secret: string,
    code: string,
    options: { digits?: number; period?: number; window?: number } = {}
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

function generateTOTPUri(secret: string, email: string, issuer: string, options: { digits?: number; period?: number } = {}): string {
    const digits = options.digits ?? 6
    const period = options.period ?? 30
    const encodedIssuer = encodeURIComponent(issuer)
    const encodedEmail = encodeURIComponent(email)
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${digits}&period=${period}`
}

// =============================================================================
// Backup Codes Utilities
// =============================================================================

function generateBackupCode(length: number): string {
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ" // Excluding ambiguous chars
    let code = ""
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

function generateBackupCodes(count: number, length: number): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
        codes.push(generateBackupCode(length))
    }
    return codes
}

// Simple encryption for backup codes (in production, use proper encryption)
async function encryptBackupCodes(codes: string[], secret: string): Promise<string> {
    const crypto = await import("crypto")
    const key = crypto.createHash("sha256").update(secret).digest()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv)
    let encrypted = cipher.update(JSON.stringify(codes), "utf8", "base64")
    encrypted += cipher.final("base64")
    return iv.toString("base64") + ":" + encrypted
}

async function decryptBackupCodes(encrypted: string, secret: string): Promise<string[]> {
    const crypto = await import("crypto")
    const [ivStr, data] = encrypted.split(":")
    const key = crypto.createHash("sha256").update(secret).digest()
    const iv = Buffer.from(ivStr, "base64")
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)
    let decrypted = decipher.update(data, "base64", "utf8")
    decrypted += decipher.final("utf8")
    return JSON.parse(decrypted)
}

// =============================================================================
// Zod Schemas
// =============================================================================

const enableTwoFactorSchema = z.object({
    password: z.string().min(1, "Password is required"),
    issuer: z.string().optional(),
})

const disableTwoFactorSchema = z.object({
    password: z.string().min(1, "Password is required"),
})

const verifyTOTPSchema = z.object({
    code: z.string().min(1, "TOTP code is required"),
})

const verifyOTPSchema = z.object({
    code: z.string().min(1, "OTP code is required"),
})

const verifyBackupCodeSchema = z.object({
    code: z.string().min(1, "Backup code is required"),
})

// =============================================================================
// Two Factor Plugin
// =============================================================================

export const twoFactor = (options: TwoFactorOptions = {}) => {
    const totpConfig = {
        digits: options.totp?.digits ?? 6,
        period: options.totp?.period ?? 30,
        window: options.totp?.window ?? 1,
    }

    const otpConfig = {
        expiresIn: options.otp?.expiresIn ?? 300,
        length: options.otp?.length ?? 6,
    }

    const backupConfig = {
        count: options.backupCodes?.count ?? 10,
        length: options.backupCodes?.length ?? 8,
    }

    const issuer = options.issuer ?? "Nevr"
    const encryptionSecret = process.env.NEVR_SECRET || "nevr-default-secret"

    // Session config
    const sessionConfig = {
        expiresIn: options.session?.expiresIn ?? 60 * 60 * 24 * 7,
        cookieName: options.session?.cookieName ?? "nevr.session_token",
        twoFactorCookieName: "nevr.two_factor",
        trustDeviceCookieName: "nevr.trust_device",
        cookie: {
            httpOnly: options.session?.cookie?.httpOnly ?? true,
            secure: options.session?.cookie?.secure ?? process.env.NODE_ENV === "production",
            sameSite: options.session?.cookie?.sameSite ?? "lax" as const,
            path: options.session?.cookie?.path ?? "/",
            domain: options.session?.cookie?.domain,
        },
    }

    function setSessionCookie(headers: Record<string, string>, token: string): void {
        headers["Set-Cookie"] = createCookieHeader(sessionConfig.cookieName, token, {
            maxAge: sessionConfig.expiresIn,
            path: sessionConfig.cookie.path,
            domain: sessionConfig.cookie.domain,
            secure: sessionConfig.cookie.secure,
            httpOnly: sessionConfig.cookie.httpOnly,
            sameSite: sessionConfig.cookie.sameSite,
        })
    }

    return {
        id: "two-factor",

        schema: getTwoFactorSchema(),

        endpoints: {
            // =================================================================
            // Enable Two Factor
            // POST /two-factor/enable
            // =================================================================
            enableTwoFactor: endpoint("/two-factor/enable", {
                method: "POST",
                body: enableTwoFactorSchema,
                meta: {
                    summary: "Enable two factor authentication",
                    tags: ["Authentication", "Two Factor"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const internalAdapter = getInternalAdapter(driver)
                    const body = validateWithZod(enableTwoFactorSchema, ctx.body || ctx.input || {})
                    const session = ctx.session || ctx.context?.session

                    if (!session?.user) {
                        throw new EndpointError("UNAUTHORIZED", {
                            message: "Authentication required",
                        })
                    }

                    const user = session.user
                    const { password, issuer: customIssuer } = body

                    // Verify password
                    const account = await driver.findOne("account", {
                        userId: user.id,
                        providerId: "credential",
                    })

                    if (!account?.password) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_PASSWORD,
                        })
                    }

                    const validPassword = await verifyPassword(password, account.password)
                    if (!validPassword) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_PASSWORD,
                        })
                    }

                    // Generate TOTP secret
                    const secret = generateSecret()
                    const backupCodes = generateBackupCodes(backupConfig.count, backupConfig.length)
                    const encryptedBackupCodes = await encryptBackupCodes(backupCodes, encryptionSecret)

                    // Delete existing two factor record
                    try {
                        const existingTwoFactor = await driver.findOne("twoFactor", { userId: user.id })
                        if (existingTwoFactor) {
                            await driver.delete("twoFactor", { id: existingTwoFactor.id })
                        }
                    } catch {
                        // No existing record
                    }

                    // Create new two factor record
                    await driver.create("twoFactor", {
                        id: generateId(),
                        userId: user.id,
                        secret,
                        backupCodes: encryptedBackupCodes,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })

                    // Update user
                    if (options.skipVerificationOnEnable) {
                        await driver.update("user", { id: user.id }, {
                            twoFactorEnabled: true,
                            updatedAt: new Date(),
                        })
                    }

                    // Generate TOTP URI
                    const totpUri = generateTOTPUri(secret, user.email, customIssuer || issuer, {
                        digits: totpConfig.digits,
                        period: totpConfig.period,
                    })

                    return {
                        status: 200,
                        body: {
                            totpUri,
                            backupCodes,
                            secret, // Only returned on enable, client should display QR code
                        },
                    }
                },
            }),

            // =================================================================
            // Verify TOTP Setup
            // POST /two-factor/verify-setup
            // =================================================================
            verifyTwoFactorSetup: endpoint("/two-factor/verify-setup", {
                method: "POST",
                body: verifyTOTPSchema,
                meta: {
                    summary: "Verify TOTP setup with code",
                    tags: ["Authentication", "Two Factor"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const body = validateWithZod(verifyTOTPSchema, ctx.body || ctx.input || {})
                    const session = ctx.session || ctx.context?.session

                    if (!session?.user) {
                        throw new EndpointError("UNAUTHORIZED", {
                            message: "Authentication required",
                        })
                    }

                    const user = session.user
                    const { code } = body

                    // Get two factor record
                    const twoFactorRecord = await driver.findOne("twoFactor", { userId: user.id })
                    if (!twoFactorRecord) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.TWO_FACTOR_NOT_ENABLED,
                        })
                    }

                    // Verify TOTP code
                    const isValid = await verifyTOTP(twoFactorRecord.secret, code, totpConfig)
                    if (!isValid) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TOTP_CODE,
                        })
                    }

                    // Enable two factor
                    await driver.update("user", { id: user.id }, {
                        twoFactorEnabled: true,
                        updatedAt: new Date(),
                    })

                    return {
                        status: 200,
                        body: { success: true, twoFactorEnabled: true },
                    }
                },
            }),

            // =================================================================
            // Disable Two Factor
            // POST /two-factor/disable
            // =================================================================
            disableTwoFactor: endpoint("/two-factor/disable", {
                method: "POST",
                body: disableTwoFactorSchema,
                meta: {
                    summary: "Disable two factor authentication",
                    tags: ["Authentication", "Two Factor"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const body = validateWithZod(disableTwoFactorSchema, ctx.body || ctx.input || {})
                    const session = ctx.session || ctx.context?.session

                    if (!session?.user) {
                        throw new EndpointError("UNAUTHORIZED", {
                            message: "Authentication required",
                        })
                    }

                    const user = session.user
                    const { password } = body

                    // Verify password
                    const account = await driver.findOne("account", {
                        userId: user.id,
                        providerId: "credential",
                    })

                    if (!account?.password) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_PASSWORD,
                        })
                    }

                    const validPassword = await verifyPassword(password, account.password)
                    if (!validPassword) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_PASSWORD,
                        })
                    }

                    // Delete two factor record
                    const twoFactorRecord = await driver.findOne("twoFactor", { userId: user.id })
                    if (twoFactorRecord) {
                        await driver.delete("twoFactor", { id: twoFactorRecord.id })
                    }

                    // Update user
                    await driver.update("user", { id: user.id }, {
                        twoFactorEnabled: false,
                        updatedAt: new Date(),
                    })

                    return {
                        status: 200,
                        body: { success: true, twoFactorEnabled: false },
                    }
                },
            }),

            // =================================================================
            // Verify TOTP (during sign-in)
            // POST /two-factor/verify-totp
            // =================================================================
            verifyTOTP: endpoint("/two-factor/verify-totp", {
                method: "POST",
                body: verifyTOTPSchema,
                meta: {
                    summary: "Verify TOTP code during sign-in",
                    tags: ["Authentication", "Two Factor"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const internalAdapter = getInternalAdapter(driver)
                    const body = validateWithZod(verifyTOTPSchema, ctx.body || ctx.input || {})

                    // Get user ID from two-factor verification cookie
                    const cookies = ctx.cookies || {}
                    const twoFactorCookie = cookies[sessionConfig.twoFactorCookieName]

                    if (!twoFactorCookie) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE,
                        })
                    }

                    // Get pending verification
                    const verification = await driver.findOne("verification", {
                        identifier: twoFactorCookie,
                    })

                    if (!verification || new Date(verification.expiresAt) < new Date()) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE,
                        })
                    }

                    const userId = verification.value
                    const { code } = body

                    // Get two factor record
                    const twoFactorRecord = await driver.findOne("twoFactor", { userId })
                    if (!twoFactorRecord) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.TWO_FACTOR_NOT_ENABLED,
                        })
                    }

                    // Verify TOTP code
                    const isValid = await verifyTOTP(twoFactorRecord.secret, code, totpConfig)
                    if (!isValid) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TOTP_CODE,
                        })
                    }

                    // Delete verification
                    await driver.delete("verification", { id: verification.id })

                    // Get user and create session
                    const user = await driver.findOne("user", { id: userId })
                    const session = await internalAdapter.createSession(userId)

                    const headers: Record<string, string> = {}
                    setSessionCookie(headers, session.token)

                    // Clear two factor cookie
                    headers["Set-Cookie"] += `; ${sessionConfig.twoFactorCookieName}=; Max-Age=0; Path=/`

                    return {
                        status: 200,
                        body: {
                            token: session.token,
                            user: {
                                id: user.id,
                                email: user.email,
                                name: user.name,
                                twoFactorEnabled: user.twoFactorEnabled,
                            },
                        },
                        headers,
                    }
                },
            }),

            // =================================================================
            // Verify Backup Code (during sign-in)
            // POST /two-factor/verify-backup-code
            // =================================================================
            verifyBackupCode: endpoint("/two-factor/verify-backup-code", {
                method: "POST",
                body: verifyBackupCodeSchema,
                meta: {
                    summary: "Verify backup code during sign-in",
                    tags: ["Authentication", "Two Factor"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const internalAdapter = getInternalAdapter(driver)
                    const body = validateWithZod(verifyBackupCodeSchema, ctx.body || ctx.input || {})

                    // Get user ID from two-factor verification cookie
                    const cookies = ctx.cookies || {}
                    const twoFactorCookie = cookies[sessionConfig.twoFactorCookieName]

                    if (!twoFactorCookie) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE,
                        })
                    }

                    // Get pending verification
                    const verification = await driver.findOne("verification", {
                        identifier: twoFactorCookie,
                    })

                    if (!verification || new Date(verification.expiresAt) < new Date()) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE,
                        })
                    }

                    const userId = verification.value
                    const { code } = body

                    // Get two factor record
                    const twoFactorRecord = await driver.findOne("twoFactor", { userId })
                    if (!twoFactorRecord) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.TWO_FACTOR_NOT_ENABLED,
                        })
                    }

                    // Decrypt and verify backup code
                    const backupCodes = await decryptBackupCodes(twoFactorRecord.backupCodes, encryptionSecret)
                    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "")
                    const codeIndex = backupCodes.findIndex(c => c === normalizedCode)

                    if (codeIndex === -1) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_BACKUP_CODE,
                        })
                    }

                    // Remove used backup code
                    backupCodes.splice(codeIndex, 1)
                    const newEncryptedCodes = await encryptBackupCodes(backupCodes, encryptionSecret)

                    await driver.update("twoFactor", { id: twoFactorRecord.id }, {
                        backupCodes: newEncryptedCodes,
                        updatedAt: new Date(),
                    })

                    // Delete verification
                    await driver.delete("verification", { id: verification.id })

                    // Get user and create session
                    const user = await driver.findOne("user", { id: userId })
                    const session = await internalAdapter.createSession(userId)

                    const headers: Record<string, string> = {}
                    setSessionCookie(headers, session.token)

                    // Clear two factor cookie
                    headers["Set-Cookie"] += `; ${sessionConfig.twoFactorCookieName}=; Max-Age=0; Path=/`

                    return {
                        status: 200,
                        body: {
                            token: session.token,
                            user: {
                                id: user.id,
                                email: user.email,
                                name: user.name,
                                twoFactorEnabled: user.twoFactorEnabled,
                            },
                            remainingBackupCodes: backupCodes.length,
                        },
                        headers,
                    }
                },
            }),

            // =================================================================
            // Generate New Backup Codes
            // POST /two-factor/generate-backup-codes
            // =================================================================
            generateBackupCodes: endpoint("/two-factor/generate-backup-codes", {
                method: "POST",
                body: disableTwoFactorSchema, // Requires password
                meta: {
                    summary: "Generate new backup codes",
                    tags: ["Authentication", "Two Factor"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const body = validateWithZod(disableTwoFactorSchema, ctx.body || ctx.input || {})
                    const session = ctx.session || ctx.context?.session

                    if (!session?.user) {
                        throw new EndpointError("UNAUTHORIZED", {
                            message: "Authentication required",
                        })
                    }

                    const user = session.user
                    const { password } = body

                    // Verify password
                    const account = await driver.findOne("account", {
                        userId: user.id,
                        providerId: "credential",
                    })

                    if (!account?.password) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_PASSWORD,
                        })
                    }

                    const validPassword = await verifyPassword(password, account.password)
                    if (!validPassword) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_PASSWORD,
                        })
                    }

                    // Get two factor record
                    const twoFactorRecord = await driver.findOne("twoFactor", { userId: user.id })
                    if (!twoFactorRecord) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.TWO_FACTOR_NOT_ENABLED,
                        })
                    }

                    // Generate new backup codes
                    const backupCodes = generateBackupCodes(backupConfig.count, backupConfig.length)
                    const encryptedBackupCodes = await encryptBackupCodes(backupCodes, encryptionSecret)

                    // Update record
                    await driver.update("twoFactor", { id: twoFactorRecord.id }, {
                        backupCodes: encryptedBackupCodes,
                        updatedAt: new Date(),
                    })

                    return {
                        status: 200,
                        body: { backupCodes },
                    }
                },
            }),

            // =================================================================
            // Send OTP (email-based 2FA)
            // POST /two-factor/send-otp
            // =================================================================
            sendOTP: endpoint("/two-factor/send-otp", {
                method: "POST",
                meta: {
                    summary: "Send OTP code via email",
                    tags: ["Authentication", "Two Factor"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver

                    if (!options.otp?.sendOTP) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.OTP_NOT_ENABLED,
                        })
                    }

                    // Get user ID from two-factor verification cookie
                    const cookies = ctx.cookies || {}
                    const twoFactorCookie = cookies[sessionConfig.twoFactorCookieName]

                    if (!twoFactorCookie) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE,
                        })
                    }

                    // Get pending verification
                    const verification = await driver.findOne("verification", {
                        identifier: twoFactorCookie,
                    })

                    if (!verification || new Date(verification.expiresAt) < new Date()) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE,
                        })
                    }

                    const userId = verification.value
                    const user = await driver.findOne("user", { id: userId })

                    // Generate and store OTP
                    const otp = generateOTP(otpConfig.length)
                    const expiresAt = new Date(Date.now() + otpConfig.expiresIn * 1000)

                    await driver.create("verification", {
                        id: generateId(),
                        identifier: `2fa-otp:${userId}`,
                        value: otp,
                        expiresAt,
                        createdAt: new Date(),
                    })

                    // Send OTP
                    try {
                        await options.otp.sendOTP({
                            email: user.email,
                            code: otp,
                            userId,
                        })
                    } catch {
                        throw new EndpointError("INTERNAL_SERVER_ERROR", {
                            message: "Failed to send OTP",
                        })
                    }

                    return {
                        status: 200,
                        body: { success: true },
                    }
                },
            }),

            // =================================================================
            // Verify OTP (email-based 2FA)
            // POST /two-factor/verify-otp
            // =================================================================
            verifyOTP: endpoint("/two-factor/verify-otp", {
                method: "POST",
                body: verifyOTPSchema,
                meta: {
                    summary: "Verify OTP code during sign-in",
                    tags: ["Authentication", "Two Factor"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const internalAdapter = getInternalAdapter(driver)
                    const body = validateWithZod(verifyOTPSchema, ctx.body || ctx.input || {})

                    // Get user ID from two-factor verification cookie
                    const cookies = ctx.cookies || {}
                    const twoFactorCookie = cookies[sessionConfig.twoFactorCookieName]

                    if (!twoFactorCookie) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE,
                        })
                    }

                    // Get pending verification
                    const verification = await driver.findOne("verification", {
                        identifier: twoFactorCookie,
                    })

                    if (!verification || new Date(verification.expiresAt) < new Date()) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE,
                        })
                    }

                    const userId = verification.value
                    const { code } = body

                    // Get OTP verification
                    const otpVerification = await driver.findOne("verification", {
                        identifier: `2fa-otp:${userId}`,
                    })

                    if (!otpVerification) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_CODE,
                        })
                    }

                    if (new Date(otpVerification.expiresAt) < new Date()) {
                        await driver.delete("verification", { id: otpVerification.id })
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.OTP_EXPIRED,
                        })
                    }

                    if (otpVerification.value !== code) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: TWO_FACTOR_ERROR_CODES.INVALID_CODE,
                        })
                    }

                    // Delete verifications
                    await driver.delete("verification", { id: verification.id })
                    await driver.delete("verification", { id: otpVerification.id })

                    // Get user and create session
                    const user = await driver.findOne("user", { id: userId })
                    const session = await internalAdapter.createSession(userId)

                    const headers: Record<string, string> = {}
                    setSessionCookie(headers, session.token)

                    // Clear two factor cookie
                    headers["Set-Cookie"] += `; ${sessionConfig.twoFactorCookieName}=; Max-Age=0; Path=/`

                    return {
                        status: 200,
                        body: {
                            token: session.token,
                            user: {
                                id: user.id,
                                email: user.email,
                                name: user.name,
                                twoFactorEnabled: user.twoFactorEnabled,
                            },
                        },
                        headers,
                    }
                },
            }),
        },

        // Hook to intercept sign-in and require 2FA
        hooks: {
            after: [
                {
                    matcher: (ctx: any) =>
                        ctx.path === "/sign-in/email" ||
                        ctx.path === "/sign-in/username" ||
                        ctx.path === "/sign-in/phone-number",
                    handler: async (ctx: any, response: any) => {
                        const driver = ctx.context?.driver || ctx.driver

                        if (!response?.body?.user?.twoFactorEnabled) {
                            return response
                        }

                        const user = response.body.user

                        // Delete the session that was just created
                        if (response.body.token) {
                            try {
                                await driver.delete("session", { token: response.body.token })
                            } catch {
                                // Ignore if session doesn't exist
                            }
                        }

                        // Create 2FA verification
                        const identifier = `2fa-${generateId()}`
                        const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

                        await driver.create("verification", {
                            id: generateId(),
                            identifier,
                            value: user.id,
                            expiresAt,
                            createdAt: new Date(),
                        })

                        // Set two factor cookie
                        const headers: Record<string, string> = {}
                        headers["Set-Cookie"] = createCookieHeader(sessionConfig.twoFactorCookieName, identifier, {
                            maxAge: 300,
                            path: sessionConfig.cookie.path,
                            domain: sessionConfig.cookie.domain,
                            secure: sessionConfig.cookie.secure,
                            httpOnly: sessionConfig.cookie.httpOnly,
                            sameSite: sessionConfig.cookie.sameSite,
                        })

                        return {
                            status: 200,
                            body: {
                                twoFactorRedirect: true,
                                message: TWO_FACTOR_ERROR_CODES.TWO_FACTOR_REQUIRED,
                            },
                            headers,
                        }
                    },
                },
            ],
        },

        $ERROR_CODES: TWO_FACTOR_ERROR_CODES,
    }
}

export default twoFactor
