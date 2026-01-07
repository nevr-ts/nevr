// =============================================================================
// ROUTE - EMAIL VERIFICATION
// Send verification email and verify email via token
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import type { AuthPluginOptions, AuthUser, InternalAdapter } from "../../types.js"
import { AUTH_ERROR_CODES } from "../../error-codes.js"
import {
    createEmailVerificationToken,
    verifyEmailVerificationToken,
} from "../../crypto/jwt.js"
import { setSessionCookie, type SessionCookieConfig } from "../../cookies/session-cookie.js"
import { createInternalAdapter } from "../internal-adapter.js"
import { getSessionFromCtx, type SessionMiddlewareConfig } from "./session.js"
import { runHook } from "../hooks.js"
import { getLogger } from "../../../../logger.js"

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const sendVerificationEmailSchema = z.object({
    email: z.string().email("Invalid email address"),
    callbackURL: z.string().optional(),
})

export const verifyEmailQuerySchema = z.object({
    token: z.string().min(1, "Token is required"),
    callbackURL: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Route Configuration
// -----------------------------------------------------------------------------

export interface EmailVerificationRouteConfig {
    options: AuthPluginOptions
    cookieConfig: SessionCookieConfig
    sessionConfig: {
        expiresIn: number
    }
}

// -----------------------------------------------------------------------------
// Send Verification Email
// -----------------------------------------------------------------------------

/**
 * Create send verification email endpoint
 */
export function sendVerificationEmail(config: EmailVerificationRouteConfig) {
    const { options, cookieConfig, sessionConfig } = config
    const secret = options.secret || process.env.AUTH_SECRET || process.env.NEVR_AUTH_SECRET || ""
    const expiresIn = options.emailVerification?.expiresIn ?? 3600 // 1 hour default

    return endpoint("/send-verification-email", {
        method: "POST",
        body: sendVerificationEmailSchema,
        meta: {
            summary: "Send verification email",
            description: "Send a verification email to the user's email address",
            tags: ["Email Verification"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(sendVerificationEmailSchema, rawBody)

            // Check if email verification is enabled
            if (!options.emailVerification?.sendVerificationEmail) {
                getLogger().error("Verification email isn't enabled")
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.VERIFICATION_EMAIL_NOT_ENABLED,
                    message: "Verification email isn't enabled",
                })
            }

            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    code: AUTH_ERROR_CODES.INTERNAL_ERROR,
                    message: "Database driver not available",
                })
            }
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            // Check for current session
            const sessionMwConfig: SessionMiddlewareConfig = {
                cookieConfig,
                sessionExpiresIn: sessionConfig.expiresIn,
            }
            const sessionCtx = await getSessionFromCtx(ctx, sessionMwConfig)

            if (!sessionCtx) {
                // No session - find user by email
                const userResult = await adapter.findUserByEmail(body.email)
                if (!userResult) {
                    // Return success anyway to prevent email enumeration
                    return { status: 200, body: { status: true } }
                }
                await sendVerificationEmailInternal(
                    adapter,
                    userResult.user,
                    secret,
                    expiresIn,
                    options,
                    body.callbackURL,
                    ctx.request
                )
                return { status: 200, body: { status: true } }
            }

            // Has session - verify it's the user's own email
            if (sessionCtx.user.emailVerified) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.EMAIL_ALREADY_VERIFIED,
                    message: "Email is already verified",
                })
            }

            if (sessionCtx.user.email !== body.email) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.FORBIDDEN,
                    message: "You can only send a verification email to your own email",
                })
            }

            await sendVerificationEmailInternal(
                adapter,
                sessionCtx.user,
                secret,
                expiresIn,
                options,
                body.callbackURL,
                ctx.request
            )

            return { status: 200, body: { status: true } }
        },
    })
}

/**
 * Internal helper to send verification email
 */
async function sendVerificationEmailInternal(
    _adapter: InternalAdapter,
    user: AuthUser,
    secret: string,
    expiresIn: number,
    options: AuthPluginOptions,
    callbackURL?: string,
    request?: Request
): Promise<void> {
    const token = createEmailVerificationToken(
        secret,
        user.email,
        undefined,
        expiresIn
    )

    const baseURL = options.baseURL || ""
    const callback = callbackURL ? encodeURIComponent(callbackURL) : encodeURIComponent("/")
    const url = `${baseURL}/auth/verify-email?token=${token}&callbackURL=${callback}`

    await options.emailVerification!.sendVerificationEmail!(
        { user, url, token },
        request
    )
}

// -----------------------------------------------------------------------------
// Verify Email
// -----------------------------------------------------------------------------

/**
 * Create verify email endpoint
 */
export function verifyEmail(config: EmailVerificationRouteConfig) {
    const { options, cookieConfig, sessionConfig } = config
    const secret = options.secret || process.env.AUTH_SECRET || process.env.NEVR_AUTH_SECRET || ""

    return endpoint("/verify-email", {
        method: "GET",
        query: verifyEmailQuerySchema,
        meta: {
            summary: "Verify email",
            description: "Verify email address via token from email link",
            tags: ["Email Verification"],
        },
        handler: async (ctx: any) => {
            const query = ctx.query || {}
            const { token, callbackURL } = query

            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                return redirectOnError(ctx, callbackURL, "internal_error")
            }
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            // Verify the token
            const result = verifyEmailVerificationToken(token, secret)

            if (!result.valid || !result.payload) {
                if (result.error === "token_expired") {
                    return redirectOnError(ctx, callbackURL, "token_expired")
                }
                return redirectOnError(ctx, callbackURL, "invalid_token")
            }

            const { email, updateTo, requestType } = result.payload

            // Find user
            const userResult = await adapter.findUserByEmail(email)
            if (!userResult) {
                return redirectOnError(ctx, callbackURL, "user_not_found")
            }

            const user = userResult.user

            // Handle email update flow
            if (updateTo) {
                return handleEmailUpdate(ctx, adapter, user, email, updateTo, requestType, options, cookieConfig, secret, sessionConfig.expiresIn, callbackURL)
            }

            // Simple email verification flow
            if (user.emailVerified) {
                // Already verified
                if (callbackURL) {
                    return { status: 302, headers: { Location: callbackURL } }
                }
                return { status: 200, body: { status: true, user: null } }
            }

            // Run hook before verification
            if (options.emailVerification?.onEmailVerification) {
                await options.emailVerification.onEmailVerification(user, ctx.request)
            }

            // Update user as verified
            const updatedUser = await adapter.updateUser(user.id, {
                emailVerified: true,
            })

            // Run hook after verification
            if (options.emailVerification?.afterEmailVerification) {
                await options.emailVerification.afterEmailVerification(updatedUser!, ctx.request)
            }

            // Run auth hook
            await runHook("afterEmailVerified", updatedUser)

            // Auto sign-in if configured
            const headers: Record<string, string> = {}
            if (options.emailVerification?.autoSignInAfterVerification) {
                const sessionMwConfig: SessionMiddlewareConfig = {
                    cookieConfig,
                    sessionExpiresIn: sessionConfig.expiresIn,
                }
                const currentSession = await getSessionFromCtx(ctx, sessionMwConfig)

                if (!currentSession || currentSession.user.email !== email) {
                    const session = await adapter.createSession(user.id)
                    setSessionCookie(headers, session.token, cookieConfig)
                }
            }

            if (callbackURL) {
                return { status: 302, headers: { ...headers, Location: callbackURL } }
            }

            return { status: 200, body: { status: true, user: updatedUser }, headers }
        },
    })
}

/**
 * Handle email update verification flow
 */
async function handleEmailUpdate(
    ctx: any,
    adapter: InternalAdapter,
    user: AuthUser,
    currentEmail: string,
    newEmail: string,
    requestType: string | undefined,
    options: AuthPluginOptions,
    cookieConfig: SessionCookieConfig,
    secret: string,
    sessionExpiresIn: number,
    callbackURL?: string
): Promise<any> {
    const headers: Record<string, string> = {}

    // For change-email-confirmation, send verification to new email
    if (requestType === "change-email-confirmation") {
        const newToken = createEmailVerificationToken(
            secret,
            currentEmail,
            newEmail,
            options.emailVerification?.expiresIn ?? 3600,
            { requestType: "change-email-verification" }
        )
        const baseURL = options.baseURL || ""
        const callback = callbackURL ? encodeURIComponent(callbackURL) : encodeURIComponent("/")
        const url = `${baseURL}/auth/verify-email?token=${newToken}&callbackURL=${callback}`

        await options.emailVerification?.sendVerificationEmail?.(
            { user: { ...user, email: newEmail }, url, token: newToken },
            ctx.request
        )

        if (callbackURL) {
            return { status: 302, headers: { Location: callbackURL } }
        }
        return { status: 200, body: { status: true } }
    }

    // For change-email-verification, actually update the email
    if (requestType === "change-email-verification") {
        const updatedUser = await adapter.updateUser(user.id, {
            email: newEmail,
            emailVerified: true,
        })

        const session = await adapter.createSession(user.id)
        setSessionCookie(headers, session.token, cookieConfig)

        if (callbackURL) {
            return { status: 302, headers: { ...headers, Location: callbackURL } }
        }
        return { status: 200, body: { status: true, user: updatedUser }, headers }
    }

    // Default: update email but set as unverified, then send verification
    const updatedUser = await adapter.updateUser(user.id, {
        email: newEmail,
        emailVerified: false,
    })

    if (options.emailVerification?.sendVerificationEmail) {
        const newToken = createEmailVerificationToken(secret, newEmail)
        const baseURL = options.baseURL || ""
        const callback = callbackURL ? encodeURIComponent(callbackURL) : encodeURIComponent("/")

        await options.emailVerification.sendVerificationEmail(
            {
                user: updatedUser!,
                url: `${baseURL}/auth/verify-email?token=${newToken}&callbackURL=${callback}`,
                token: newToken,
            },
            ctx.request
        )
    }

    const session = await adapter.createSession(user.id)
    setSessionCookie(headers, session.token, cookieConfig)

    if (callbackURL) {
        return { status: 302, headers: { ...headers, Location: callbackURL } }
    }

    return { status: 200, body: { status: true, user: updatedUser }, headers }
}

/**
 * Helper to redirect with error
 */
function redirectOnError(ctx: any, callbackURL: string | undefined, error: string): any {
    if (callbackURL) {
        const separator = callbackURL.includes("?") ? "&" : "?"
        return { status: 302, headers: { Location: `${callbackURL}${separator}error=${error}` } }
    }
    throw new EndpointError("UNAUTHORIZED", {
        code: AUTH_ERROR_CODES.INVALID_VERIFICATION_TOKEN,
        message: error,
    })
}
