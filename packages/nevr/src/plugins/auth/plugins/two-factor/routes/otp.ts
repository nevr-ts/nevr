// =============================================================================
// TWO FACTOR - OTP ROUTES
// Email/SMS based OTP verification endpoints
// =============================================================================

import { endpoint, z, EndpointError, validateWithZod } from "../../../../unified/endpoint.js"
import { getInternalAdapter } from "../../../index.js"
import { generateId } from "../../../crypto/index.js"
import { createCookieHeader } from "../../../cookies/index.js"
import { TWO_FACTOR_ERROR_CODES } from "../error-codes.js"
import { generateOTP } from "../utils/totp.js"
import type { OTPConfig, SessionConfig, TwoFactorOptions } from "../types.js"

// Zod Schemas
const verifyOTPSchema = z.object({
    code: z.string().min(1, "OTP code is required"),
})

/**
 * Create OTP verification endpoints
 */
export function createOTPRoutes(
    otpConfig: OTPConfig,
    sessionConfig: SessionConfig,
    options: TwoFactorOptions,
    setSessionCookie: (headers: Record<string, string>, token: string) => void
) {
    return {
        /**
         * Send OTP code via email
         * POST /two-factor/send-otp
         */
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

        /**
         * Verify OTP code during sign-in
         * POST /two-factor/verify-otp
         */
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
    }
}
