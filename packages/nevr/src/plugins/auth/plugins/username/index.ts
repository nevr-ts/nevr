// =============================================================================
// USERNAME PLUGIN
// Extends auth plugin with username-based authentication
// Extends auth plugin with username-based authentication
// =============================================================================

import { getLogger } from "../../../../logger.js"

// Use unified endpoint system
import {
    endpoint,
    z,
    EndpointError,
    validateWithZod,
} from "../../../unified/endpoint.js"

// Import auth plugin utilities and types
import {
    type AuthUser,
    type AuthSession,
    type AuthAccount,
    getInternalAdapter,
} from "../../index.js"

import {
    hashPassword,
    verifyPassword,
} from "../../crypto/index.js"

import { createCookieHeader } from "../../cookies/index.js"

import { USERNAME_ERROR_CODES } from "./error-codes.js"
import { getUsernameSchema } from "./schema.js"

// Re-exports
export * from "./error-codes.js"
export { getUsernameSchema } from "./schema.js"
export { usernameClient } from "./client.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UsernamePluginOptions {
    /**
     * Minimum username length
     * @default 3
     */
    minUsernameLength?: number

    /**
     * Maximum username length
     * @default 30
     */
    maxUsernameLength?: number

    /**
     * Custom username validator
     * By default, only alphanumeric characters and underscores are allowed
     */
    usernameValidator?: (username: string) => boolean | Promise<boolean>

    /**
     * Custom display username validator
     * By default, no validation is applied
     */
    displayUsernameValidator?: (displayUsername: string) => boolean | Promise<boolean>

    /**
     * Username normalization function
     * @default (username) => username.toLowerCase()
     */
    usernameNormalization?: ((username: string) => string) | false

    /**
     * Display username normalization function
     * @default false (no normalization)
     */
    displayUsernameNormalization?: ((displayUsername: string) => string) | false

    /**
     * Validation order
     * @default { username: "pre-normalization", displayUsername: "pre-normalization" }
     */
    validationOrder?: {
        username?: "pre-normalization" | "post-normalization"
        displayUsername?: "pre-normalization" | "post-normalization"
    }

    /**
     * Require email verification for sign-in
     */
    requireEmailVerification?: boolean

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
     * @default { window: 60000, max: 10 }
     */
    rateLimit?: false | {
        window?: number
        max?: number
    }
}

/**
 * Extended user type with username
 */
export interface UsernameUser extends AuthUser {
    username?: string | null
    displayUsername?: string | null
}

// -----------------------------------------------------------------------------
// Default Validators
// -----------------------------------------------------------------------------

function defaultUsernameValidator(username: string): boolean {
    return /^[a-zA-Z0-9_.]+$/.test(username)
}

// -----------------------------------------------------------------------------
// Zod Schemas
// -----------------------------------------------------------------------------

const signInUsernameSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
})

const isUsernameAvailableSchema = z.object({
    username: z.string().min(1, "Username is required"),
})

// -----------------------------------------------------------------------------
// Username Plugin
// -----------------------------------------------------------------------------

export const username = (options?: UsernamePluginOptions) => {
    const minLength = options?.minUsernameLength ?? 3
    const maxLength = options?.maxUsernameLength ?? 30

    // Normalizers
    const normalizer = (value: string): string => {
        if (options?.usernameNormalization === false) return value
        if (typeof options?.usernameNormalization === "function") {
            return options.usernameNormalization(value)
        }
        return value.toLowerCase()
    }

    const displayUsernameNormalizer = (value: string): string => {
        if (typeof options?.displayUsernameNormalization === "function") {
            return options.displayUsernameNormalization(value)
        }
        return value
    }

    // Validator
    const validator = options?.usernameValidator ?? defaultUsernameValidator

    // Session config
    const sessionConfig = {
        expiresIn: options?.session?.expiresIn ?? 60 * 60 * 24 * 7,
        cookieName: options?.session?.cookieName ?? "nevr.session_token",
        cookie: {
            httpOnly: options?.session?.cookie?.httpOnly ?? true,
            secure: options?.session?.cookie?.secure ?? process.env.NODE_ENV === "production",
            sameSite: options?.session?.cookie?.sameSite ?? "lax" as const,
            path: options?.session?.cookie?.path ?? "/",
            domain: options?.session?.cookie?.domain,
        },
    }

    // Cookie helper
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
        id: "username",

        // Entity hooks for username normalization (unified pattern)
        entityHooks: {
            user: {
                create: {
                    before: async (ctx: any) => {
                        const user = ctx.data
                        const username = "username" in user ? user.username : null
                        const displayUsername = "displayUsername" in user ? user.displayUsername : null

                        return {
                            data: {
                                ...user,
                                ...(username ? { username: normalizer(username) } : {}),
                                ...(displayUsername ? { displayUsername: displayUsernameNormalizer(displayUsername) } : {}),
                            },
                        }
                    },
                },
                update: {
                    before: async (ctx: any) => {
                        const user = ctx.data
                        const username = "username" in user ? user.username : null
                        const displayUsername = "displayUsername" in user ? user.displayUsername : null

                        return {
                            data: {
                                ...user,
                                ...(username ? { username: normalizer(username) } : {}),
                                ...(displayUsername ? { displayUsername: displayUsernameNormalizer(displayUsername) } : {}),
                            },
                        }
                    },
                },
            },
        },

        endpoints: {
            signInUsername: endpoint("/sign-in/username", {
                method: "POST",
                body: signInUsernameSchema,
                meta: {
                    summary: "Sign in with username",
                    tags: ["Authentication", "Username"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const internalAdapter = getInternalAdapter(driver)
                    const rawBody = ctx.body || ctx.input || {}
                    const body = validateWithZod(signInUsernameSchema, rawBody)

                    if (!body.username || !body.password) {
                        throw new EndpointError("UNAUTHORIZED", {
                            message: USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD,
                        })
                    }

                    // Apply normalization based on validation order
                    const usernameToValidate = options?.validationOrder?.username === "post-normalization"
                        ? normalizer(body.username)
                        : body.username

                    // Validate length
                    if (usernameToValidate.length < minLength) {
                        throw new EndpointError("UNPROCESSABLE_ENTITY", {
                            message: USERNAME_ERROR_CODES.USERNAME_TOO_SHORT,
                            code: "USERNAME_TOO_SHORT",
                        })
                    }
                    if (usernameToValidate.length > maxLength) {
                        throw new EndpointError("UNPROCESSABLE_ENTITY", {
                            message: USERNAME_ERROR_CODES.USERNAME_TOO_LONG,
                            code: "USERNAME_TOO_LONG",
                        })
                    }

                    // Validate format
                    const isValid = await validator(usernameToValidate)
                    if (!isValid) {
                        throw new EndpointError("UNPROCESSABLE_ENTITY", {
                            message: USERNAME_ERROR_CODES.INVALID_USERNAME,
                        })
                    }

                    // Find user by normalized username
                    const user = await driver.findOne("user", {
                        username: normalizer(usernameToValidate),
                    }) as UsernameUser | null

                    if (!user) {
                        // Hash to prevent timing attacks
                        await hashPassword(body.password)
                        throw new EndpointError("UNAUTHORIZED", {
                            message: USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD,
                        })
                    }

                    // Find credential account
                    const account = await driver.findOne("account", {
                        userId: user.id,
                        providerId: "credential",
                    }) as AuthAccount | null

                    if (!account?.password) {
                        await hashPassword(body.password)
                        throw new EndpointError("UNAUTHORIZED", {
                            message: USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD,
                        })
                    }

                    // Verify password
                    const validPassword = await verifyPassword(body.password, account.password)
                    if (!validPassword) {
                        throw new EndpointError("UNAUTHORIZED", {
                            message: USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD,
                        })
                    }

                    // Check email verification if required
                    if (options?.requireEmailVerification && !user.emailVerified) {
                        throw new EndpointError("FORBIDDEN", {
                            message: USERNAME_ERROR_CODES.EMAIL_NOT_VERIFIED,
                            code: "EMAIL_NOT_VERIFIED",
                        })
                    }

                    // Create session using internal adapter
                    const session = await internalAdapter.createSession(user.id, body.rememberMe === false)

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
                                image: user.image,
                                username: user.username,
                                displayUsername: user.displayUsername,
                                createdAt: user.createdAt,
                                updatedAt: user.updatedAt,
                            },
                        },
                        headers,
                    }
                },
            }),

            isUsernameAvailable: endpoint("/is-username-available", {
                method: "POST",
                body: isUsernameAvailableSchema,
                meta: {
                    summary: "Check username availability",
                    tags: ["Authentication", "Username"],
                },
                handler: async (ctx: any) => {
                    const driver = ctx.context?.driver || ctx.driver
                    const rawBody = ctx.body || ctx.input || {}
                    const body = validateWithZod(isUsernameAvailableSchema, rawBody)

                    const usernameToCheck = body.username

                    // Validate length
                    if (usernameToCheck.length < minLength) {
                        throw new EndpointError("UNPROCESSABLE_ENTITY", {
                            message: USERNAME_ERROR_CODES.USERNAME_TOO_SHORT,
                            code: "USERNAME_TOO_SHORT",
                        })
                    }
                    if (usernameToCheck.length > maxLength) {
                        throw new EndpointError("UNPROCESSABLE_ENTITY", {
                            message: USERNAME_ERROR_CODES.USERNAME_TOO_LONG,
                            code: "USERNAME_TOO_LONG",
                        })
                    }

                    // Validate format
                    const isValid = await validator(usernameToCheck)
                    if (!isValid) {
                        throw new EndpointError("UNPROCESSABLE_ENTITY", {
                            message: USERNAME_ERROR_CODES.INVALID_USERNAME,
                        })
                    }

                    // Check availability
                    const existingUser = await driver.findOne("user", {
                        username: normalizer(usernameToCheck),
                    })

                    return {
                        status: 200,
                        body: { available: !existingUser },
                    }
                },
            }),
        },

        // Schema extension for user entity
        schema: getUsernameSchema({
            username: normalizer,
            displayUsername: displayUsernameNormalizer,
        }),

        // Request interceptors for validation (unified pattern)
        interceptors: {
            before: [
                {
                    matcher: (ctx: any) => ctx.path === "/sign-up/email" || ctx.path === "/update-user",
                    handler: async (ctx: any) => {
                        const body = ctx.body || {}

                        // Handle username validation
                        const usernameRaw = body.username
                        if (usernameRaw !== undefined && typeof usernameRaw === "string") {
                            const usernameToValidate = options?.validationOrder?.username === "post-normalization"
                                ? normalizer(usernameRaw)
                                : usernameRaw

                            if (usernameToValidate.length < minLength) {
                                throw new EndpointError("BAD_REQUEST", {
                                    message: USERNAME_ERROR_CODES.USERNAME_TOO_SHORT,
                                    code: "USERNAME_TOO_SHORT",
                                })
                            }
                            if (usernameToValidate.length > maxLength) {
                                throw new EndpointError("BAD_REQUEST", {
                                    message: USERNAME_ERROR_CODES.USERNAME_TOO_LONG,
                                    code: "USERNAME_TOO_LONG",
                                })
                            }

                            const isValid = await validator(usernameToValidate)
                            if (!isValid) {
                                throw new EndpointError("BAD_REQUEST", {
                                    message: USERNAME_ERROR_CODES.INVALID_USERNAME,
                                })
                            }

                            // Check uniqueness
                            const driver = ctx.context?.driver || ctx.driver
                            if (driver) {
                                const existingUser = await driver.findOne("user", {
                                    username: normalizer(usernameToValidate),
                                }) as UsernameUser | null

                                const isSignUp = ctx.path === "/sign-up/email"
                                const isDifferentUser = ctx.context?.session &&
                                    existingUser &&
                                    existingUser.id !== ctx.context.session.session.userId

                                if ((isSignUp && existingUser) || isDifferentUser) {
                                    throw new EndpointError("BAD_REQUEST", {
                                        message: USERNAME_ERROR_CODES.USERNAME_IS_ALREADY_TAKEN,
                                    })
                                }
                            }
                        }

                        // Handle display username validation
                        const displayUsernameRaw = body.displayUsername
                        if (displayUsernameRaw !== undefined && typeof displayUsernameRaw === "string") {
                            const displayUsernameToValidate = options?.validationOrder?.displayUsername === "post-normalization"
                                ? displayUsernameNormalizer(displayUsernameRaw)
                                : displayUsernameRaw

                            if (options?.displayUsernameValidator) {
                                const isValid = await options.displayUsernameValidator(displayUsernameToValidate)
                                if (!isValid) {
                                    throw new EndpointError("BAD_REQUEST", {
                                        message: USERNAME_ERROR_CODES.INVALID_DISPLAY_USERNAME,
                                    })
                                }
                            }
                        }
                    },
                },
                // Second interceptor: Set defaults for username/displayUsername
                {
                    matcher: (ctx: any) => ctx.path === "/sign-up/email" || ctx.path === "/update-user",
                    handler: async (ctx: any) => {
                        if (ctx.body.username && !ctx.body.displayUsername) {
                            ctx.body.displayUsername = ctx.body.username
                        }
                        if (ctx.body.displayUsername && !ctx.body.username) {
                            ctx.body.username = ctx.body.displayUsername
                        }
                    },
                },
            ],
        },

        $ERROR_CODES: USERNAME_ERROR_CODES,
        $Infer: { User: {} as UsernameUser, Session: {} as AuthSession },

        // Rate limiting for username endpoints (developer-configurable)
        rateLimit: options?.rateLimit === false ? [] : [
            {
                pathMatcher: (path: string) => path.startsWith("/sign-in/username") || path.startsWith("/is-username-available"),
                window: options?.rateLimit?.window ?? 60 * 1000,
                max: options?.rateLimit?.max ?? 10,
            },
        ],
    }
}

export default username
