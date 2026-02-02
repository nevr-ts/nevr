// =============================================================================
// ROUTE - SIGN UP
// Email/password sign up endpoint
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import type { AuthPluginOptions, AuthUser, InternalAdapter } from "../../types.js"
import { AUTH_ERROR_CODES } from "../../error-codes.js"
import { hashPassword } from "../../crypto/index.js"
import { setSessionCookie, type SessionCookieConfig } from "../../cookies/session-cookie.js"
import { createEmailVerificationToken } from "../../crypto/jwt.js"
import { runHook } from "../hooks.js"
import { getLogger } from "../../../../logger.js"
import { createInternalAdapter } from "../internal-adapter.js"

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

export const signUpEmailSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    image: z.string().url().optional(),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
})

export type SignUpEmailInput = z.infer<typeof signUpEmailSchema>

// -----------------------------------------------------------------------------
// Route Factory
// -----------------------------------------------------------------------------

export interface SignUpRouteConfig {
    options: AuthPluginOptions
    cookieConfig: SessionCookieConfig
    passwordConfig: {
        hash: (password: string) => Promise<string>
        minLength: number
        maxLength: number
    }
}

/**
 * Create sign up email endpoint
 */
export function signUpEmail(config: SignUpRouteConfig) {
    const { options, cookieConfig, passwordConfig } = config
    const secret = options.secret || process.env.AUTH_SECRET || process.env.NEVR_AUTH_SECRET || ""

    // Build schema with dynamic password length
    // Use passthrough() to allow additional fields from sub-plugins (username, displayUsername, etc.)
    const schema = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        password: z.string()
            .min(passwordConfig.minLength, `Password must be at least ${passwordConfig.minLength} characters`)
            .max(passwordConfig.maxLength, `Password must be at most ${passwordConfig.maxLength} characters`),
        image: z.string().url().optional(),
        callbackURL: z.string().optional(),
        rememberMe: z.boolean().optional(),
        // Additional fields from sub-plugins (username, displayUsername, etc.)
        username: z.string().optional(),
        displayUsername: z.string().optional(),
    }).passthrough()

    return endpoint("/sign-up/email", {
        method: "POST",
        body: schema,
        meta: {
            summary: "Sign up with email and password",
            description: "Create a new user account with email and password",
            tags: ["Authentication"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(schema, rawBody)

            // Get adapter from context at runtime
            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    code: AUTH_ERROR_CODES.FAILED_TO_CREATE_USER,
                    message: "Database driver not available",
                })
            }
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: options.session?.expiresIn ?? 60 * 60 * 24 * 7,
            })

            // Check if email/password enabled
            if (!options.emailAndPassword?.enabled) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.EMAIL_AND_PASSWORD_NOT_ENABLED,
                    message: "Email and password authentication is not enabled",
                })
            }

            // Check if sign-up is disabled
            if (options.emailAndPassword?.disableSignUp) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.SIGN_UP_DISABLED,
                    message: "Sign up is disabled",
                })
            }

            // Check for existing user FIRST - before any other operations
            const existingUser = await adapter.findUserByEmail(body.email)
            if (existingUser) {
                // Important: Just throw the error - no session creation, no cookie setting
                getLogger().info(`[auth] Sign-up attempt for existing email: ${body.email}`)
                throw new EndpointError("CONFLICT", {
                    code: AUTH_ERROR_CODES.USER_ALREADY_EXISTS,
                    message: "A user with this email already exists",
                })
            }

            // Hash password BEFORE creating user (so if hashing fails, user isn't created)
            const hashedPassword = await passwordConfig.hash(body.password)

            // Create user with additional fields from sub-plugins (username, displayUsername, etc.)
            // Extract known non-user fields from body
            const { password, callbackURL, rememberMe, ...userFields } = body

            // Set displayUsername from username if not provided (username plugin convention)
            if (userFields.username && !userFields.displayUsername) {
                userFields.displayUsername = userFields.username
            }

            let user: AuthUser
            try {
                user = await adapter.createUser({
                    ...userFields, // Include username, displayUsername, and any other sub-plugin fields
                    email: body.email.toLowerCase(),
                    name: body.name,
                    image: body.image || null,
                    emailVerified: false,
                })
            } catch (e) {
                getLogger().error("[auth] Failed to create user", e)
                throw new EndpointError("INTERNAL_ERROR", {
                    code: AUTH_ERROR_CODES.FAILED_TO_CREATE_USER,
                    message: "Failed to create user",
                })
            }

            // Link credential account
            await adapter.linkAccount({
                userId: user.id,
                providerId: "credential",
                accountId: user.id,
                password: hashedPassword,
            })

            // Send verification email if configured
            // This happens when either sendOnSignUp is true OR requireEmailVerification is true
            const shouldSendVerificationEmail =
                options.emailVerification?.sendOnSignUp === true ||
                options.emailAndPassword?.requireEmailVerification === true

            if (shouldSendVerificationEmail && options.emailVerification?.sendVerificationEmail) {
                try {
                    const expiresIn = options.emailVerification?.expiresIn ?? 3600
                    const token = createEmailVerificationToken(
                        secret,
                        user.email,
                        undefined,
                        expiresIn
                    )

                    const baseURL = options.baseURL || ""
                    const callbackURL = body.callbackURL
                        ? encodeURIComponent(body.callbackURL)
                        : encodeURIComponent("/")
                    const url = `${baseURL}/auth/verify-email?token=${token}&callbackURL=${callbackURL}`

                    await options.emailVerification.sendVerificationEmail(
                        { user, url, token },
                        ctx.request
                    )

                    getLogger().debug(`[auth] Verification email sent to ${user.email}`)
                } catch (e) {
                    getLogger().error("[auth] Failed to send verification email", e)
                    // Don't throw - user was created successfully, just email failed
                    // They can request a new verification email later
                }
            }

            const headers: Record<string, string> = {}
            let token: string | null = null

            // Determine if we should auto sign-in
            // Auto sign-in is DISABLED if:
            // 1. autoSignIn is explicitly set to false
            // 2. requireEmailVerification is true
            const autoSignInDisabled =
                options.emailAndPassword?.autoSignIn === false ||
                options.emailAndPassword?.requireEmailVerification === true

            if (!autoSignInDisabled) {
                // Auto sign-in enabled - create session and set cookie
                const session = await adapter.createSession(user.id, body.rememberMe === false)
                token = session.token
                setSessionCookie(headers, session.token, cookieConfig, body.rememberMe === false)
                await runHook("afterSignIn", user, session)
            }

            return { status: 200, body: { token, user }, headers }
        },
    })
}
