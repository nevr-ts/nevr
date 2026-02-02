// =============================================================================
// MAGIC LINK PLUGIN
// Passwordless authentication via email magic links
// =============================================================================

import { endpoint, z, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import { getInternalAdapter } from "../../index.js"
import { generateId } from "../../crypto/index.js"
import { createCookieHeader } from "../../cookies/index.js"
import { MAGIC_LINK_ERROR_CODES } from "./error-codes.js"

// Re-exports
export * from "./error-codes.js"

// Client: import from "nevr/plugins/auth/magic-link/client" for frontend use

// =============================================================================
// Types
// =============================================================================

export interface MagicLinkOptions {
    /**
     * Time in seconds until the magic link expires
     * @default 300 (5 minutes)
     */
    expiresIn?: number

    /**
     * Send magic link email implementation (required)
     */
    sendMagicLink: (data: {
        email: string
        url: string
        token: string
    }) => Promise<void>

    /**
     * Disable sign up if user is not found
     * @default false
     */
    disableSignUp?: boolean

    /**
     * Custom token generator
     * @default generates 32-char random string
     */
    generateToken?: (email: string) => string | Promise<string>

    /**
     * Base URL for magic link verification
     * If not set, uses request origin
     */
    baseUrl?: string

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

    /**
     * Rate limiting configuration
     * Set to `false` to disable rate limiting
     * @default { window: 60000, max: 5 }
     */
    rateLimit?: false | {
        window?: number
        max?: number
    }
}

/**
 * Magic link user type
 */
export interface MagicLinkUser {
    id: string
    email: string
    emailVerified: boolean
    name?: string | null
    image?: string | null
    createdAt: Date
    updatedAt: Date
}

/**
 * Magic link session type
 */
export interface MagicLinkSession {
    id: string
    token: string
    userId: string
    expiresAt: Date
    createdAt: Date
}

// =============================================================================
// Zod Schemas
// =============================================================================

const sendMagicLinkSchema = z.object({
    email: z.string().email("Valid email is required"),
    name: z.string().optional(),
    callbackURL: z.string().optional(),
})

const verifyMagicLinkSchema = z.object({
    token: z.string().min(1, "Token is required"),
    callbackURL: z.string().optional(),
})

// =============================================================================
// Token Generator
// =============================================================================

function defaultGenerateToken(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let token = ""
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
}

// =============================================================================
// Magic Link Plugin
// =============================================================================

export const magicLink = (options: MagicLinkOptions) => {
    const expiresIn = options.expiresIn ?? 300 // 5 minutes
    const generateToken = options.generateToken ?? defaultGenerateToken

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
        id: "magic-link",

        endpoints: {
            // =================================================================
            // Send Magic Link
            // POST /sign-in/magic-link
            // =================================================================
            sendMagicLink: endpoint("/sign-in/magic-link", {
                method: "POST",
                body: sendMagicLinkSchema,
                meta: {
                    summary: "Send magic link email",
                    tags: ["Authentication", "Magic Link"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const rawBody = ctx.body || ctx.input || {}
                    const body = validateWithZod(sendMagicLinkSchema, rawBody)

                    const { email, name, callbackURL } = body

                    // Generate token
                    const token = await generateToken(email)
                    const expiresAt = new Date(Date.now() + expiresIn * 1000)

                    // Store verification token
                    await driver.create("verification", {
                        id: generateId(),
                        identifier: token,
                        value: JSON.stringify({ email, name }),
                        expiresAt,
                        createdAt: new Date(),
                    })

                    // Build verification URL
                    const baseUrl = options.baseUrl || ctx.request?.headers?.origin || ""
                    const verifyUrl = new URL(`${baseUrl}/auth/magic-link/verify`)
                    verifyUrl.searchParams.set("token", token)
                    if (callbackURL) {
                        verifyUrl.searchParams.set("callbackURL", callbackURL)
                    }

                    // Send email
                    try {
                        await options.sendMagicLink({
                            email,
                            url: verifyUrl.toString(),
                            token,
                        })
                    } catch (error) {
                        throw new EndpointError("INTERNAL_SERVER_ERROR", {
                            message: MAGIC_LINK_ERROR_CODES.SEND_FAILED,
                        })
                    }

                    return {
                        status: 200,
                        body: { success: true },
                    }
                },
            }),

            // =================================================================
            // Verify Magic Link
            // GET /magic-link/verify
            // =================================================================
            verifyMagicLink: endpoint("/magic-link/verify", {
                method: "GET",
                query: verifyMagicLinkSchema,
                meta: {
                    summary: "Verify magic link token",
                    tags: ["Authentication", "Magic Link"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const internalAdapter = getInternalAdapter(driver)
                    const query = ctx.query || {}

                    const { token, callbackURL } = query

                    if (!token) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: MAGIC_LINK_ERROR_CODES.INVALID_TOKEN,
                        })
                    }

                    // Find verification token
                    const verification = await driver.findOne("verification", {
                        identifier: token,
                    })

                    if (!verification) {
                        throw new EndpointError("BAD_REQUEST", {
                            message: MAGIC_LINK_ERROR_CODES.INVALID_TOKEN,
                        })
                    }

                    // Check expiration
                    if (new Date(verification.expiresAt) < new Date()) {
                        await driver.delete("verification", { id: verification.id })
                        throw new EndpointError("BAD_REQUEST", {
                            message: MAGIC_LINK_ERROR_CODES.EXPIRED_TOKEN,
                        })
                    }

                    // Delete token (one-time use)
                    await driver.delete("verification", { id: verification.id })

                    // Parse stored data
                    const { email, name } = JSON.parse(verification.value)

                    // Find or create user
                    let user = await driver.findOne("user", { email })
                    let isNewUser = false

                    if (!user) {
                        if (options.disableSignUp) {
                            throw new EndpointError("FORBIDDEN", {
                                message: MAGIC_LINK_ERROR_CODES.SIGNUP_DISABLED,
                            })
                        }

                        // Create new user
                        user = await driver.create("user", {
                            id: generateId(),
                            email,
                            emailVerified: true,
                            name: name || email.split("@")[0],
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        })
                        isNewUser = true
                    } else if (!user.emailVerified) {
                        // Verify email if not already
                        user = await driver.update("user", { id: user.id }, {
                            emailVerified: true,
                            updatedAt: new Date(),
                        })
                    }

                    // Create session
                    const session = await internalAdapter.createSession(user.id)

                    const headers: Record<string, string> = {}
                    setSessionCookie(headers, session.token)

                    // Redirect if callbackURL provided
                    if (callbackURL) {
                        headers["Location"] = callbackURL
                        return {
                            status: 302,
                            body: null,
                            headers,
                        }
                    }

                    return {
                        status: 200,
                        body: {
                            token: session.token,
                            user: {
                                id: user.id,
                                email: user.email,
                                emailVerified: user.emailVerified,
                                name: user.name,
                                image: user.image,
                                createdAt: user.createdAt,
                                updatedAt: user.updatedAt,
                            },
                            isNewUser,
                        },
                        headers,
                    }
                },
            }),
        },

        // Rate limiting for magic link endpoints (developer-configurable)
        rateLimit: options.rateLimit === false ? [] : [
            {
                pathMatcher: (path: string) => path.startsWith("/sign-in/magic-link") || path.startsWith("/magic-link/verify"),
                window: options.rateLimit?.window ?? 60 * 1000,
                max: options.rateLimit?.max ?? 5,
            },
        ],

        $ERROR_CODES: MAGIC_LINK_ERROR_CODES,
        $Infer: { User: {} as MagicLinkUser, Session: {} as MagicLinkSession },
    }
}

export default magicLink
