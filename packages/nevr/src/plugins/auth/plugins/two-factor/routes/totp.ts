// =============================================================================
// TWO FACTOR - TOTP ROUTES
// TOTP verification endpoints
// =============================================================================

import { endpoint, z, EndpointError, validateWithZod } from "../../../../unified/endpoint.js"
import { getInternalAdapter } from "../../../index.js"
import { generateId } from "../../../crypto/index.js"
import { createCookieHeader } from "../../../cookies/index.js"
import { TWO_FACTOR_ERROR_CODES } from "../error-codes.js"
import { verifyTOTP, generateTOTP as generateTOTPCode, generateTOTPUri } from "../utils/totp.js"
import type { TOTPConfig, SessionConfig } from "../types.js"

// Zod Schemas
const verifyTOTPSchema = z.object({
    code: z.string().min(1, "TOTP code is required"),
})

const getTOTPURISchema = z.object({
    password: z.string().min(1, "Password is required"),
})

const generateTOTPRequestSchema = z.object({
    secret: z.string().min(1, "Secret is required"),
})

/**
 * Create TOTP verification endpoints
 */
export function createTOTPRoutes(
    totpConfig: TOTPConfig,
    sessionConfig: SessionConfig,
    setSessionCookie: (headers: Record<string, string>, token: string) => void
) {
    return {
        /**
         * Verify TOTP code during sign-in
         * POST /two-factor/verify-totp
         */
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

        /**
         * Get TOTP URI for authenticated user
         * POST /two-factor/get-totp-uri
         */
        getTOTPURI: endpoint("/two-factor/get-totp-uri", {
            method: "POST",
            body: getTOTPURISchema,
            meta: {
                summary: "Get TOTP URI for authenticated user",
                tags: ["Authentication", "Two Factor"],
            },
            handler: async (ctx: any) => {
                const driver = ctx.context?.driver || ctx.driver
                const body = validateWithZod(getTOTPURISchema, ctx.body || ctx.input || {})
                const session = ctx.session || ctx.context?.session

                if (!session?.user) {
                    throw new EndpointError("UNAUTHORIZED", {
                        message: "Authentication required",
                    })
                }

                const user = session.user

                // Get two factor record
                const twoFactorRecord = await driver.findOne("twoFactor", { userId: user.id })
                if (!twoFactorRecord) {
                    throw new EndpointError("BAD_REQUEST", {
                        message: TWO_FACTOR_ERROR_CODES.TOTP_NOT_ENABLED,
                    })
                }

                // Generate TOTP URI
                const totpUri = generateTOTPUri(
                    twoFactorRecord.secret,
                    user.email,
                    "Nevr",
                    { digits: totpConfig.digits, period: totpConfig.period }
                )

                return {
                    status: 200,
                    body: { totpUri },
                }
            },
        }),

        /**
         * Generate TOTP code (for testing)
         * POST /two-factor/generate-totp
         */
        generateTOTP: endpoint("/two-factor/generate-totp", {
            method: "POST",
            body: generateTOTPRequestSchema,
            meta: {
                summary: "Generate TOTP code from secret",
                tags: ["Authentication", "Two Factor"],
            },
            handler: async (ctx: any) => {
                const body = validateWithZod(generateTOTPRequestSchema, ctx.body || ctx.input || {})

                const code = await generateTOTPCode(body.secret, {
                    digits: totpConfig.digits,
                    period: totpConfig.period,
                })

                return {
                    status: 200,
                    body: { code },
                }
            },
        }),
    }
}
