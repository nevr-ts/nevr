// =============================================================================
// ROUTE - UPDATE USER
// Update user profile, change password, change email, delete account
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import type { AuthPluginOptions, AuthUser, InternalAdapter } from "../../types.js"
import { AUTH_ERROR_CODES } from "../../error-codes.js"
import { hashPassword, verifyPassword } from "../../crypto/index.js"
import { createEmailVerificationToken } from "../../crypto/jwt.js"
import { setSessionCookie, deleteSessionCookie, type SessionCookieConfig } from "../../cookies/session-cookie.js"
import { createInternalAdapter } from "../internal-adapter.js"
import {
    getSessionFromCtx,
    requireSession,
    requireFreshSession,
    type SessionMiddlewareConfig,
    type SessionContext,
} from "./session.js"
import { getLogger } from "../../../../logger.js"

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const updateUserSchema = z.record(z.string(), z.any())

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    revokeOtherSessions: z.boolean().optional(),
})

export const changeEmailSchema = z.object({
    newEmail: z.string().email("Invalid email address"),
    callbackURL: z.string().optional(),
})

export const deleteUserSchema = z.object({
    password: z.string().optional(),
    callbackURL: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Route Configuration
// -----------------------------------------------------------------------------

export interface UpdateUserRouteConfig {
    options: AuthPluginOptions
    cookieConfig: SessionCookieConfig
    sessionConfig: {
        expiresIn: number
    }
    passwordConfig: {
        hash: (password: string) => Promise<string>
        verify: (password: string, hash: string) => Promise<boolean>
        minLength: number
        maxLength: number
    }
}

// -----------------------------------------------------------------------------
// Update User (name, image, custom fields)
// -----------------------------------------------------------------------------

export function updateUser(config: UpdateUserRouteConfig) {
    const { cookieConfig, sessionConfig } = config
    const sessionMwConfig: SessionMiddlewareConfig = {
        cookieConfig,
        sessionExpiresIn: sessionConfig.expiresIn,
    }

    return endpoint("/update-user", {
        method: "POST",
        body: updateUserSchema,
        meta: {
            summary: "Update user profile",
            description: "Update name, image, or custom user fields",
            tags: ["User"],
        },
        handler: requireSession(async (ctx: any, session: SessionContext) => {
            const rawBody = ctx.body || ctx.input || {}

            // Validate - reject email updates via this route
            if (rawBody.email) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.FORBIDDEN,
                    message: "Email cannot be updated via this endpoint. Use /change-email instead.",
                })
            }

            const { name, image, ...rest } = rawBody as { name?: string; image?: string | null;[key: string]: any }

            // Check if there's anything to update
            if (name === undefined && image === undefined && Object.keys(rest).length === 0) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.FORBIDDEN,
                    message: "No fields to update",
                })
            }

            const driver = ctx.context?.driver || ctx.driver
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            // Update user
            const updatedUser = await adapter.updateUser(session.user.id, {
                ...(name !== undefined && { name }),
                ...(image !== undefined && { image }),
                // Additional fields can be handled here
            })

            // Update session cookie with new user data
            const headers: Record<string, string> = {}
            if (updatedUser) {
                setSessionCookie(headers, session.session.token, cookieConfig)
            }

            return {
                status: 200,
                body: { status: true, user: updatedUser },
                headers,
            }
        }, sessionMwConfig),
    })
}

// -----------------------------------------------------------------------------
// Change Password
// -----------------------------------------------------------------------------

export function changePassword(config: UpdateUserRouteConfig) {
    const { cookieConfig, sessionConfig, passwordConfig } = config
    const sessionMwConfig: SessionMiddlewareConfig = {
        cookieConfig,
        sessionExpiresIn: sessionConfig.expiresIn,
        freshAge: 300, // 5 minutes
    }

    return endpoint("/change-password", {
        method: "POST",
        body: changePasswordSchema,
        meta: {
            summary: "Change password",
            description: "Change user password (requires current password)",
            tags: ["User"],
        },
        handler: requireFreshSession(async (ctx: any, session: SessionContext) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(changePasswordSchema, rawBody)

            const { currentPassword, newPassword, revokeOtherSessions } = body

            // Validate new password length
            if (newPassword.length < passwordConfig.minLength) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.PASSWORD_TOO_SHORT,
                    message: `Password must be at least ${passwordConfig.minLength} characters`,
                })
            }
            if (newPassword.length > passwordConfig.maxLength) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.PASSWORD_TOO_LONG,
                    message: `Password must be at most ${passwordConfig.maxLength} characters`,
                })
            }

            const driver = ctx.context?.driver || ctx.driver
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            // Find credential account
            const account = await adapter.findAccountByUserId(session.user.id, "credential")
            if (!account || !account.password) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.CREDENTIAL_ACCOUNT_NOT_FOUND,
                    message: "No credential account found",
                })
            }

            // Verify current password
            const isValid = await passwordConfig.verify(currentPassword, account.password)
            if (!isValid) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
                    message: "Current password is incorrect",
                })
            }

            // Hash new password
            const hashedPassword = await passwordConfig.hash(newPassword)

            // Update password
            await driver.update("account", { id: account.id }, {
                password: hashedPassword,
                updatedAt: new Date()
            })

            const headers: Record<string, string> = {}
            let newToken: string | null = null

            // Optionally revoke other sessions
            if (revokeOtherSessions) {
                await adapter.deleteSessions(session.user.id)
                const newSession = await adapter.createSession(session.user.id)
                setSessionCookie(headers, newSession.token, cookieConfig)
                newToken = newSession.token
            }

            return {
                status: 200,
                body: {
                    status: true,
                    token: newToken,
                    user: {
                        id: session.user.id,
                        email: session.user.email,
                        name: session.user.name,
                        emailVerified: session.user.emailVerified,
                    },
                },
                headers,
            }
        }, sessionMwConfig),
    })
}

// -----------------------------------------------------------------------------
// Change Email
// -----------------------------------------------------------------------------

export function changeEmail(config: UpdateUserRouteConfig) {
    const { options, cookieConfig, sessionConfig } = config
    const secret = options.secret || process.env.AUTH_SECRET || process.env.NEVR_AUTH_SECRET || ""
    const sessionMwConfig: SessionMiddlewareConfig = {
        cookieConfig,
        sessionExpiresIn: sessionConfig.expiresIn,
        freshAge: 300,
    }

    return endpoint("/change-email", {
        method: "POST",
        body: changeEmailSchema,
        meta: {
            summary: "Change email",
            description: "Change user email address (sends verification email)",
            tags: ["User"],
        },
        handler: requireFreshSession(async (ctx: any, session: SessionContext) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(changeEmailSchema, rawBody)

            const newEmail = body.newEmail.toLowerCase()

            // Check if same email
            if (newEmail === session.user.email) {
                throw new EndpointError("BAD_REQUEST", {
                    code: AUTH_ERROR_CODES.FORBIDDEN,
                    message: "New email is the same as current email",
                })
            }

            const driver = ctx.context?.driver || ctx.driver
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            // Check if email already exists
            const existingUser = await adapter.findUserByEmail(newEmail)
            if (existingUser) {
                throw new EndpointError("UNPROCESSABLE_ENTITY", {
                    code: AUTH_ERROR_CODES.USER_ALREADY_EXISTS,
                    message: "Email is already in use",
                })
            }

            // If email verification is enabled and user's current email is verified
            if (options.emailVerification?.sendVerificationEmail && session.user.emailVerified) {
                // Send verification to current email first (confirmation)
                const token = createEmailVerificationToken(
                    secret,
                    session.user.email,
                    newEmail,
                    options.emailVerification?.expiresIn ?? 3600,
                    { requestType: "change-email-confirmation" }
                )

                const baseURL = options.baseURL || ""
                const callbackURL = body.callbackURL ? encodeURIComponent(body.callbackURL) : encodeURIComponent("/")
                const url = `${baseURL}/auth/verify-email?token=${token}&callbackURL=${callbackURL}`

                await options.emailVerification.sendVerificationEmail(
                    { user: session.user, url, token },
                    ctx.request
                )

                return {
                    status: 200,
                    body: { status: true, message: "Verification email sent", user: null },
                }
            }

            // If no verification needed, update email directly (and set as unverified)
            const updatedUser = await adapter.updateUser(session.user.id, {
                email: newEmail,
                emailVerified: false,
            })

            const headers: Record<string, string> = {}
            setSessionCookie(headers, session.session.token, cookieConfig)

            return {
                status: 200,
                body: { status: true, message: "Email updated", user: updatedUser },
                headers,
            }
        }, sessionMwConfig),
    })
}

// -----------------------------------------------------------------------------
// Delete User
// -----------------------------------------------------------------------------

export function deleteUser(config: UpdateUserRouteConfig) {
    const { options, cookieConfig, sessionConfig, passwordConfig } = config
    const sessionMwConfig: SessionMiddlewareConfig = {
        cookieConfig,
        sessionExpiresIn: sessionConfig.expiresIn,
        freshAge: 300,
    }

    return endpoint("/delete-user", {
        method: "POST",
        body: deleteUserSchema,
        meta: {
            summary: "Delete user account",
            description: "Permanently delete user account and all associated data",
            tags: ["User"],
        },
        handler: requireFreshSession(async (ctx: any, session: SessionContext) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(deleteUserSchema, rawBody)

            const driver = ctx.context?.driver || ctx.driver
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            // If password provided, verify it
            if (body.password) {
                const account = await adapter.findAccountByUserId(session.user.id, "credential")
                if (account?.password) {
                    const isValid = await passwordConfig.verify(body.password, account.password)
                    if (!isValid) {
                        throw new EndpointError("BAD_REQUEST", {
                            code: AUTH_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
                            message: "Password is incorrect",
                        })
                    }
                }
            }

            // Delete all user data (cascade)
            try {
                // Delete sessions first
                await adapter.deleteSessions(session.user.id)

                // Delete accounts
                const accounts = await driver.findMany("account", { where: { userId: session.user.id } })
                for (const account of accounts) {
                    await driver.delete("account", { id: account.id })
                }

                // Delete user
                await driver.delete("user", { id: session.user.id })
            } catch (e) {
                getLogger().error("Failed to delete user", e)
                throw new EndpointError("INTERNAL_ERROR", {
                    code: AUTH_ERROR_CODES.INTERNAL_ERROR,
                    message: "Failed to delete user",
                })
            }

            // Clear session cookie
            const headers: Record<string, string> = {}
            deleteSessionCookie(headers, cookieConfig)

            return {
                status: 200,
                body: { status: true, message: "User deleted" },
                headers,
            }
        }, sessionMwConfig),
    })
}
