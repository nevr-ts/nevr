// =============================================================================
// ROUTE - SIGN IN
// Email/password sign in endpoint
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import type { AuthPluginOptions, InternalAdapter } from "../../types.js"
import { AUTH_ERROR_CODES } from "../../error-codes.js"
import { setSessionCookie, type SessionCookieConfig } from "../../cookies/session-cookie.js"
import { runHook } from "../hooks.js"
import { createInternalAdapter } from "../internal-adapter.js"

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

export const signInEmailSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
})

export type SignInEmailInput = z.infer<typeof signInEmailSchema>

// -----------------------------------------------------------------------------
// Route Factory
// -----------------------------------------------------------------------------

export interface SignInRouteConfig {
    options: AuthPluginOptions
    cookieConfig: SessionCookieConfig
    passwordConfig: {
        hash: (password: string) => Promise<string>
        verify: (password: string, hash: string) => Promise<boolean>
    }
}

/**
 * Create sign in email endpoint
 */
export function signInEmail(config: SignInRouteConfig) {
    const { options, cookieConfig, passwordConfig } = config

    return endpoint("/sign-in/email", {
        method: "POST",
        body: signInEmailSchema,
        meta: {
            summary: "Sign in with email and password",
            description: "Authenticate with email and password to create a session",
            tags: ["Authentication"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(signInEmailSchema, rawBody)

            // Get adapter from context at runtime
            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    code: AUTH_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
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

            // Run beforeSignIn hook
            await runHook("beforeSignIn", body.email)

            // Find user
            const result = await adapter.findUserByEmail(body.email, { includeAccounts: true })

            if (!result) {
                // Timing attack prevention: hash password anyway
                await passwordConfig.hash(body.password)
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
                    message: "Invalid email or password",
                })
            }

            const { user, accounts } = result

            // Find credential account
            const credentialAccount = accounts.find(a => a.providerId === "credential")
            if (!credentialAccount?.password) {
                // Timing attack prevention
                await passwordConfig.hash(body.password)
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.CREDENTIAL_ACCOUNT_NOT_FOUND,
                    message: "Invalid email or password",
                })
            }

            // Verify password
            const validPassword = await passwordConfig.verify(body.password, credentialAccount.password)
            if (!validPassword) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
                    message: "Invalid email or password",
                })
            }

            // Check email verification if required
            if (options.emailAndPassword?.requireEmailVerification && !user.emailVerified) {
                throw new EndpointError("FORBIDDEN", {
                    code: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
                    message: "Email not verified",
                })
            }

            // Create session
            const session = await adapter.createSession(user.id, body.rememberMe === false)

            const headers: Record<string, string> = {}
            setSessionCookie(headers, session.token, cookieConfig, body.rememberMe === false)

            // Run afterSignIn hook
            await runHook("afterSignIn", user, session)

            return {
                status: 200,
                body: {
                    token: session.token,
                    user,
                    redirect: !!body.callbackURL,
                    url: body.callbackURL,
                },
                headers,
            }
        },
    })
}
