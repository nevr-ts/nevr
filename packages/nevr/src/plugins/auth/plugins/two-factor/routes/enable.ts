// =============================================================================
// TWO FACTOR - ENABLE/DISABLE ROUTES
// Enable and disable two-factor authentication
// =============================================================================

import { endpoint, z, EndpointError, validateWithZod } from "../../../../unified/endpoint.js"
import { getInternalAdapter } from "../../../index.js"
import { generateId, verifyPassword } from "../../../crypto/index.js"
import { TWO_FACTOR_ERROR_CODES } from "../error-codes.js"
import { generateSecret, generateTOTPUri } from "../utils/totp.js"
import { generateBackupCodes, encryptBackupCodes } from "../utils/backup-codes.js"
import { getSessionFromCtx } from "../../../api/routes/session.js"
import type { TOTPConfig, BackupCodesConfig } from "../types.js"

// Zod Schemas
const enableTwoFactorSchema = z.object({
    password: z.string().min(1, "Password is required"),
    issuer: z.string().optional(),
})

const disableTwoFactorSchema = z.object({
    password: z.string().min(1, "Password is required"),
})

const verifySetupSchema = z.object({
    code: z.string().min(1, "TOTP code is required"),
})

/**
 * Create enable/disable two-factor endpoints
 */
export function createEnableRoutes(
    totpConfig: TOTPConfig,
    backupConfig: BackupCodesConfig,
    issuer: string,
    encryptionSecret: string,
    skipVerificationOnEnable?: boolean,
    sessionConfig?: { cookieName: string; sessionExpiresIn: number }
) {
    // Default session config if not provided
    const cookieName = sessionConfig?.cookieName ?? "nevr.session_token"
    const sessionExpiresIn = sessionConfig?.sessionExpiresIn ?? 60 * 60 * 24 * 7

    // Full cookie config for session helpers
    const fullCookieConfig = {
        name: cookieName,
        expiresIn: sessionExpiresIn,
        options: {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
        },
    }

    return {
        /**
         * Enable two-factor authentication
         * POST /two-factor/enable
         */
        enableTwoFactor: endpoint("/two-factor/enable", {
            method: "POST",
            body: enableTwoFactorSchema,
            meta: {
                summary: "Enable two factor authentication",
                tags: ["Authentication", "Two Factor"],
            },
            handler: async (ctx: any) => {
                const driver = ctx.context?.driver || ctx.driver
                const body = validateWithZod(enableTwoFactorSchema, ctx.body || ctx.input || {})

                // Get session using the auth helper
                const sessionCtx = await getSessionFromCtx(ctx, {
                    cookieConfig: fullCookieConfig,
                    sessionExpiresIn,
                })

                if (!sessionCtx?.user) {
                    throw new EndpointError("UNAUTHORIZED", {
                        message: "Authentication required",
                    })
                }

                const user = sessionCtx.user
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

                // Update user if skip verification
                if (skipVerificationOnEnable) {
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
                        secret,
                    },
                }
            },
        }),

        /**
         * Verify TOTP setup with code
         * POST /two-factor/verify-setup
         */
        verifyTwoFactorSetup: endpoint("/two-factor/verify-setup", {
            method: "POST",
            body: verifySetupSchema,
            meta: {
                summary: "Verify TOTP setup with code",
                tags: ["Authentication", "Two Factor"],
            },
            handler: async (ctx: any) => {
                const driver = ctx.context?.driver || ctx.driver
                const body = validateWithZod(verifySetupSchema, ctx.body || ctx.input || {})

                // Get session using the auth helper
                const sessionCtx = await getSessionFromCtx(ctx, {
                    cookieConfig: fullCookieConfig,
                    sessionExpiresIn,
                })

                if (!sessionCtx?.user) {
                    throw new EndpointError("UNAUTHORIZED", {
                        message: "Authentication required",
                    })
                }

                const user = sessionCtx.user
                const { code } = body

                // Get two factor record
                const twoFactorRecord = await driver.findOne("twoFactor", { userId: user.id })
                if (!twoFactorRecord) {
                    throw new EndpointError("BAD_REQUEST", {
                        message: TWO_FACTOR_ERROR_CODES.TWO_FACTOR_NOT_ENABLED,
                    })
                }

                // Import verifyTOTP dynamically to avoid circular deps
                const { verifyTOTP } = await import("../utils/totp.js")

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

        /**
         * Disable two-factor authentication
         * POST /two-factor/disable
         */
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

                // Get session using the auth helper
                const sessionCtx = await getSessionFromCtx(ctx, {
                    cookieConfig: fullCookieConfig,
                    sessionExpiresIn,
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
    }
}
