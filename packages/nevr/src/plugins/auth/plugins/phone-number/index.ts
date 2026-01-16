// =============================================================================
// PHONE NUMBER PLUGIN
// Phone number authentication with OTP verification
// =============================================================================

import { endpoint, z, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import { getInternalAdapter } from "../../index.js"
import { generateId, hashPassword, verifyPassword } from "../../crypto/index.js"
import { createCookieHeader } from "../../cookies/index.js"
import { PHONE_NUMBER_ERROR_CODES } from "./error-codes.js"
import { getPhoneNumberSchema } from "./schema.js"

// Re-exports
export * from "./error-codes.js"
export { getPhoneNumberSchema } from "./schema.js"
export { phoneNumberClient } from "./client.js"

// =============================================================================
// Types
// =============================================================================

export interface PhoneNumberOptions {
    /**
     * OTP expiration in seconds
     * @default 300 (5 minutes)
     */
    expiresIn?: number

    /**
     * OTP length
     * @default 6
     */
    otpLength?: number

    /**
     * Send OTP implementation (required)
     */
    sendOTP: (data: { phoneNumber: string; code: string }) => Promise<void>

    /**
     * Phone number validator
     */
    phoneNumberValidator?: (phoneNumber: string) => boolean | Promise<boolean>

    /**
     * Require phone verification for sign-in
     * @default false
     */
    requireVerification?: boolean

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
// OTP Generator
// =============================================================================

function generateOTP(length: number): string {
    let otp = ""
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10).toString()
    }
    return otp
}

// =============================================================================
// Zod Schemas
// =============================================================================

const signInPhoneSchema = z.object({
    phoneNumber: z.string().min(1, "Phone number is required"),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional(),
})

const sendOTPSchema = z.object({
    phoneNumber: z.string().min(1, "Phone number is required"),
})

const verifyPhoneSchema = z.object({
    phoneNumber: z.string().min(1, "Phone number is required"),
    code: z.string().min(1, "OTP code is required"),
})

// =============================================================================
// Phone Number Plugin
// =============================================================================

export const phoneNumber = (options: PhoneNumberOptions) => {
    const expiresIn = options.expiresIn ?? 300
    const otpLength = options.otpLength ?? 6

    // Session config
    const sessionConfig = {
        expiresIn: options.session?.expiresIn ?? 60 * 60 * 24 * 7,
        cookieName: options.session?.cookieName ?? "nevr.session_token",
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
        id: "phone-number",

        schema: getPhoneNumberSchema(),

        endpoints: {
            // =================================================================
            // Sign In with Phone Number
            // POST /sign-in/phone-number
            // =================================================================
            signInPhoneNumber: endpoint("/sign-in/phone-number", {
                method: "POST",
                body: signInPhoneSchema,
                meta: {
                    summary: "Sign in with phone number",
                    tags: ["Authentication", "Phone Number"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const internalAdapter = getInternalAdapter(driver)
                    const body = validateWithZod(signInPhoneSchema, ctx.body || ctx.input || {})

                    const { phoneNumber: phone, password } = body

                    // Validate phone number
                    if (options.phoneNumberValidator) {
                        const isValid = await options.phoneNumberValidator(phone)
                        if (!isValid) {
                            throw new EndpointError("BAD_REQUEST", {
                                message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER,
                            })
                        }
                    }

                    // Find user by phone
                    const user = await driver.findOne("user", { phoneNumber: phone })
                    if (!user) {
                        await hashPassword(password) // Timing attack prevention
                        throw new EndpointError("UNAUTHORIZED", {
                            message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER_OR_PASSWORD,
                        })
                    }

                    // Check verification requirement
                    if (options.requireVerification && !user.phoneNumberVerified) {
                        throw new EndpointError("UNAUTHORIZED", {
                            message: PHONE_NUMBER_ERROR_CODES.PHONE_NUMBER_NOT_VERIFIED,
                        })
                    }

                    // Find credential account
                    const account = await driver.findOne("account", {
                        userId: user.id,
                        providerId: "credential",
                    })

                    if (!account?.password) {
                        throw new EndpointError("UNAUTHORIZED", {
                            message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER_OR_PASSWORD,
                        })
                    }

                    // Verify password
                    const validPassword = await verifyPassword(password, account.password)
                    if (!validPassword) {
                        throw new EndpointError("UNAUTHORIZED", {
                            message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER_OR_PASSWORD,
                        })
                    }

                    // Create session
                    const session = await internalAdapter.createSession(user.id)

                    const headers: Record<string, string> = {}
                    setSessionCookie(headers, session.token)

                    return {
                        status: 200,
                        body: {
                            token: session.token,
                            user: {
                                id: user.id,
                                email: user.email,
                                emailVerified: user.emailVerified,
                                name: user.name,
                                phoneNumber: user.phoneNumber,
                                phoneNumberVerified: user.phoneNumberVerified,
                                createdAt: user.createdAt,
                                updatedAt: user.updatedAt,
                            },
                        },
                        headers,
                    }
                },
            }),

            // =================================================================
            // Send OTP
            // POST /phone-number/send-otp
            // =================================================================
            sendPhoneOTP: endpoint("/phone-number/send-otp", {
                method: "POST",
                body: sendOTPSchema,
                meta: {
                    summary: "Send OTP to phone number",
                    tags: ["Authentication", "Phone Number"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const body = validateWithZod(sendOTPSchema, ctx.body || ctx.input || {})

                    const { phoneNumber: phone } = body

                    // Validate phone number
                    if (options.phoneNumberValidator) {
                        const isValid = await options.phoneNumberValidator(phone)
                        if (!isValid) {
                            throw new EndpointError("BAD_REQUEST", {
                                message: PHONE_NUMBER_ERROR_CODES.INVALID_PHONE_NUMBER,
                            })
                        }
                    }

                    // Generate OTP
                    const otp = generateOTP(otpLength)
                    const expiresAt = new Date(Date.now() + expiresIn * 1000)

                    // Store OTP
                    await driver.create("verification", {
                        id: generateId(),
                        identifier: `phone:${phone}`,
                        value: otp,
                        expiresAt,
                        createdAt: new Date(),
                    })

                    // Send OTP
                    try {
                        await options.sendOTP({ phoneNumber: phone, code: otp })
                    } catch (error) {
                        throw new EndpointError("INTERNAL_SERVER_ERROR", {
                            message: PHONE_NUMBER_ERROR_CODES.SEND_OTP_FAILED,
                        })
                    }

                    return {
                        status: 200,
                        body: { success: true },
                    }
                },
            }),

            // =================================================================
            // Verify Phone Number
            // POST /phone-number/verify
            // =================================================================
            verifyPhoneNumber: endpoint("/phone-number/verify", {
                method: "POST",
                body: verifyPhoneSchema,
                meta: {
                    summary: "Verify phone number with OTP",
                    tags: ["Authentication", "Phone Number"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const body = validateWithZod(verifyPhoneSchema, ctx.body || ctx.input || {})

                    const { phoneNumber: phone, code } = body

                    // Find verification
                    const verification = await driver.findOne("verification", {
                        identifier: `phone:${phone}`,
                    })

                    if (!verification) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: PHONE_NUMBER_ERROR_CODES.INVALID_OTP,
                        })
                    }

                    // Check expiration
                    if (new Date(verification.expiresAt) < new Date()) {
                        await driver.delete("verification", { id: verification.id })
                        throw new EndpointError("BAD_REQUEST", {
                            message: PHONE_NUMBER_ERROR_CODES.OTP_EXPIRED,
                        })
                    }

                    // Verify code
                    if (verification.value !== code) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: PHONE_NUMBER_ERROR_CODES.INVALID_OTP,
                        })
                    }

                    // Delete verification
                    await driver.delete("verification", { id: verification.id })

                    // Update user if exists
                    const user = await driver.findOne("user", { phoneNumber: phone })
                    if (user) {
                        await driver.update("user", { id: user.id }, {
                            phoneNumberVerified: true,
                            updatedAt: new Date(),
                        })
                    }

                    return {
                        status: 200,
                        body: { success: true, verified: true },
                    }
                },
            }),
        },

        // Block direct phone number updates
        hooks: {
            before: [
                {
                    matcher: (ctx: any) => ctx.path === "/update-user" && ctx.body?.phoneNumber,
                    handler: async () => {
                        throw new EndpointError("BAD_REQUEST", {
                            message: PHONE_NUMBER_ERROR_CODES.PHONE_NUMBER_CANNOT_BE_UPDATED,
                        })
                    },
                },
            ],
        },

        $ERROR_CODES: PHONE_NUMBER_ERROR_CODES,
    }
}

export default phoneNumber
