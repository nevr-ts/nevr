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

    // Build schema with dynamic password length
    const schema = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        password: z.string()
            .min(passwordConfig.minLength, `Password must be at least ${passwordConfig.minLength} characters`)
            .max(passwordConfig.maxLength, `Password must be at most ${passwordConfig.maxLength} characters`),
        image: z.string().url().optional(),
        callbackURL: z.string().optional(),
        rememberMe: z.boolean().optional(),
    })

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

            // Check for existing user
            const existingUser = await adapter.findUserByEmail(body.email)
            if (existingUser) {
                throw new EndpointError("CONFLICT", {
                    code: AUTH_ERROR_CODES.USER_ALREADY_EXISTS,
                    message: "A user with this email already exists",
                })
            }

            // Hash password
            const hashedPassword = await passwordConfig.hash(body.password)

            // Create user
            let user: AuthUser
            try {
                user = await adapter.createUser({
                    email: body.email,
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

            const headers: Record<string, string> = {}
            let token: string | null = null

            // Auto sign-in if enabled
            const shouldAutoSignIn =
                options.emailAndPassword?.enabled &&
                options.emailAndPassword?.autoSignIn &&
                !options.emailAndPassword?.requireEmailVerification

            if (shouldAutoSignIn) {
                const session = await adapter.createSession(user.id, body.rememberMe === false)
                token = session.token
                setSessionCookie(headers, session.token, cookieConfig, body.rememberMe === false)
                await runHook("afterSignIn", user, session)
            }

            return { status: 200, body: { token, user }, headers }
        },
    })
}
