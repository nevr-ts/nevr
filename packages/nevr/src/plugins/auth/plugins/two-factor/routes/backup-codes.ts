// =============================================================================
// TWO FACTOR - BACKUP CODES ROUTES
// Backup codes verification and generation endpoints
// =============================================================================

import { endpoint, z, EndpointError, validateWithZod } from "../../../../unified/endpoint.js"
import { getInternalAdapter } from "../../../index.js"
import { generateId, verifyPassword } from "../../../crypto/index.js"
import { createCookieHeader } from "../../../cookies/index.js"
import { TWO_FACTOR_ERROR_CODES } from "../error-codes.js"
import { generateBackupCodes, encryptBackupCodes, decryptBackupCodes } from "../utils/backup-codes.js"
import { getSessionFromCtx } from "../../../api/routes/session.js"
import type { BackupCodesConfig, SessionConfig } from "../types.js"

// Zod Schemas
const verifyBackupCodeSchema = z.object({
    code: z.string().min(1, "Backup code is required"),
})

const generateBackupCodesSchema = z.object({
    password: z.string().min(1, "Password is required"),
})

/**
 * Create backup codes endpoints
 */
export function createBackupCodesRoutes(
    backupConfig: BackupCodesConfig,
    sessionConfig: SessionConfig,
    encryptionSecret: string,
    setSessionCookie: (headers: Record<string, string>, token: string) => void
) {
    // Full cookie config for session helpers
    const fullCookieConfig = {
        name: sessionConfig.cookieName,
        expiresIn: sessionConfig.expiresIn,
        options: {
            path: sessionConfig.cookie.path,
            domain: sessionConfig.cookie.domain,
            httpOnly: sessionConfig.cookie.httpOnly,
            secure: sessionConfig.cookie.secure,
            sameSite: sessionConfig.cookie.sameSite,
        },
    }

    return {
        /**
         * Verify backup code during sign-in
         * POST /two-factor/verify-backup-code
         */
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

        /**
         * Generate new backup codes
         * POST /two-factor/generate-backup-codes
         */
        generateBackupCodes: endpoint("/two-factor/generate-backup-codes", {
            method: "POST",
            body: generateBackupCodesSchema,
            meta: {
                summary: "Generate new backup codes",
                tags: ["Authentication", "Two Factor"],
            },
            handler: async (ctx: any) => {
                const driver = ctx.context?.driver || ctx.driver
                const body = validateWithZod(generateBackupCodesSchema, ctx.body || ctx.input || {})

                // Get session using the auth helper
                const sessionCtx = await getSessionFromCtx(ctx, {
                    cookieConfig: fullCookieConfig,
                    sessionExpiresIn: sessionConfig.expiresIn,
                })

                if (!sessionCtx?.user) {
                    throw new EndpointError("UNAUTHORIZED", {
                        message: "Authentication required",
                    })
                }

                const user = sessionCtx.user
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
    }
}
