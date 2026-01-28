// =============================================================================
// AUTH PLUGIN
// Email/password authentication plugin for Nevr
// Modular architecture for flexibility
// =============================================================================

import { createPlugin } from "../unified/facade.js"
import { getLogger } from "../../logger.js"
import type { Driver } from "../../types.js"

// Import modular components
import { createInternalAdapter } from "./api/internal-adapter.js"
import { createHookAdapter } from "./api/hooks.js"
import { getSessionCookieConfig } from "./cookies/session-cookie.js"
import { hashPassword, verifyPassword } from "./crypto/index.js"
import { getAuthSchema } from "./schema.js"
import type { AuthPluginOptions, AuthUser, AuthSession, InternalAdapter } from "./types.js"

// Import route factories (ES imports, not require!)
import { signUpEmail } from "./api/routes/sign-up.js"
import { signInEmail } from "./api/routes/sign-in.js"
import { signOut } from "./api/routes/sign-out.js"
import { getSession, listSessions, revokeSession, revokeSessions, revokeOtherSessions } from "./api/routes/session.js"
import { sendVerificationEmail, verifyEmail } from "./api/routes/email-verification.js"
import { requestPasswordReset, resetPasswordCallback, resetPassword } from "./api/routes/reset-password.js"
import { updateUser, changePassword, changeEmail, deleteUser } from "./api/routes/update-user.js"
import { listAccounts, unlinkAccount } from "./api/routes/account.js"
import { signInWithProvider, linkSocial } from "./api/routes/oauth.js"
import { oauthCallback } from "./api/routes/callback.js"

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Types
export * from "./types.js"
export * from "./error-codes.js"
export { getAuthSchema, userEntity, sessionEntity, accountEntity, verificationEntity } from "./schema.js"

// Crypto module
export * from "./crypto/index.js"

// Cookies module
export * from "./cookies/index.js"

// API module
export * from "./api/index.js"

// Hooks (at root level for convenience)
export * from "./hooks.js"

// Unified endpoint utilities
export { z, endpoint, EndpointError, createMiddleware } from "../unified/endpoint.js"
export { EndpointError as AuthError } from "../unified/endpoint.js"

// Client plugin
export { authClient, type AuthClientOptions, type AuthClientMethods, type SessionData } from "./client.js"

// Sub-plugins
export * from "./plugins/username/index.js"

// =============================================================================
// PRE-REGISTRATION (Side Effect)
// This allows plugin('auth').user to work during generation,
// before the full plugin is instantiated via auth({...})
// =============================================================================

import { preRegisterPluginSchema } from "../unified/runtime.js"
import { getAuthSchema as _getAuthSchema } from "./schema.js"

// Pre-register auth schema when this module is imported
preRegisterPluginSchema("auth", _getAuthSchema())

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_SESSION_EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days
const DEFAULT_SESSION_UPDATE_AGE = 60 * 60 * 24 // 1 day
const DEFAULT_MIN_PASSWORD_LENGTH = 8
const DEFAULT_MAX_PASSWORD_LENGTH = 128

// =============================================================================
// AUTH PLUGIN
// =============================================================================

export const auth = createPlugin<AuthPluginOptions>({
    id: "auth",
    name: "Authentication",
    version: "1.0.0",
    description: "Email/password authentication for Nevr ",
    basePath: "/auth",

    defaults: {
        emailAndPassword: {
            enabled: true,
            minPasswordLength: DEFAULT_MIN_PASSWORD_LENGTH,
            maxPasswordLength: DEFAULT_MAX_PASSWORD_LENGTH,
            autoSignIn: true,
        },
        session: {
            expiresIn: DEFAULT_SESSION_EXPIRES_IN,
            updateAge: DEFAULT_SESSION_UPDATE_AGE,
            cookieName: "nevr.session_token",
            cookie: {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
            },
        },
    },

    validate: (options) => {
        const secret = options.secret || process.env.AUTH_SECRET || process.env.NEVR_AUTH_SECRET
        if (!secret) return ["Secret is required. Set options.secret or NEVR_AUTH_SECRET env variable"]
        if (secret.length < 32) return [`Secret must be at least 32 characters for security (got ${secret.length}). Generate one with: openssl rand -base64 32`]
        return []
    },

    factory: (options) => {
        // Build configs (routes get adapter from context at runtime)
        const cookieConfig = getSessionCookieConfig(options.session)
        const passwordConfig = {
            hash: options.password?.hash ?? hashPassword,
            verify: options.password?.verify ?? verifyPassword,
            minLength: options.emailAndPassword?.minPasswordLength ?? DEFAULT_MIN_PASSWORD_LENGTH,
            maxLength: options.emailAndPassword?.maxPasswordLength ?? DEFAULT_MAX_PASSWORD_LENGTH,
        }
        const sessionConfig = {
            expiresIn: options.session?.expiresIn ?? DEFAULT_SESSION_EXPIRES_IN,
            updateAge: options.session?.updateAge ?? DEFAULT_SESSION_UPDATE_AGE,
        }

        // Get base auth schema
        const baseSchema = getAuthSchema(options.user?.additionalFields ? {
            userFields: options.user.additionalFields as any,
        } : undefined)

        // Merge sub-plugin schemas (like username, two-factor, etc.)
        if (options.plugins && options.plugins.length > 0) {
            for (const subPlugin of options.plugins) {
                const subSchema = subPlugin.schema as { extend?: Record<string, Record<string, unknown>>; entities?: Record<string, unknown> } | undefined
                if (subSchema?.extend) {
                    baseSchema.extend = baseSchema.extend || {}
                    for (const [entityName, fields] of Object.entries(subSchema.extend)) {
                        baseSchema.extend[entityName] = Object.assign(
                            {},
                            baseSchema.extend[entityName] || {},
                            fields
                        ) as any
                    }
                }
                if (subSchema?.entities) {
                    baseSchema.entities = baseSchema.entities || {}
                    Object.assign(baseSchema.entities, subSchema.entities)
                }
            }
        }

        return {
            schema: baseSchema,

            // Create endpoints using the route factories (no adapter - routes get it from context)
            endpoints: {
                // Core auth
                signUpEmail: signUpEmail({ options, cookieConfig, passwordConfig }),
                signInEmail: signInEmail({ options, cookieConfig, passwordConfig }),
                signOut: signOut({ cookieConfig, sessionExpiresIn: sessionConfig.expiresIn }),

                // Session management
                getSession: getSession({ cookieConfig, sessionConfig }),
                listSessions: listSessions({ cookieConfig, sessionConfig }),
                revokeSession: revokeSession({ cookieConfig, sessionConfig }),
                revokeSessions: revokeSessions({ cookieConfig, sessionConfig }),
                revokeOtherSessions: revokeOtherSessions({ cookieConfig, sessionConfig }),

                // Email verification
                sendVerificationEmail: sendVerificationEmail({ options, cookieConfig, sessionConfig }),
                verifyEmail: verifyEmail({ options, cookieConfig, sessionConfig }),

                // Password reset
                requestPasswordReset: requestPasswordReset({ options, sessionConfig, passwordConfig }),
                resetPasswordCallback: resetPasswordCallback({ options, sessionConfig, passwordConfig }),
                resetPassword: resetPassword({ options, sessionConfig, passwordConfig }),

                // User management
                updateUser: updateUser({ options, cookieConfig, sessionConfig, passwordConfig }),
                changePassword: changePassword({ options, cookieConfig, sessionConfig, passwordConfig }),
                changeEmail: changeEmail({ options, cookieConfig, sessionConfig, passwordConfig }),
                deleteUser: deleteUser({ options, cookieConfig, sessionConfig, passwordConfig }),

                // Account management
                listAccounts: listAccounts({ options, cookieConfig, sessionConfig }),
                unlinkAccount: unlinkAccount({ options, cookieConfig, sessionConfig }),

                // OAuth
                signInWithProvider: signInWithProvider({ options, cookieConfig, sessionConfig }),
                linkSocial: linkSocial({ options, cookieConfig, sessionConfig }),
                oauthCallback: oauthCallback({ options, cookieConfig, sessionConfig }),
            } as any,

            lifecycle: {
                onInit: () => {
                    getLogger().debug("[auth] Plugin initialized with modular architecture")
                },
            },

            // Rate limiting for auth endpoints (developer-configurable)
            rateLimit: options.rateLimit === false ? [] : [
                {
                    // Sign-in protection
                    pathMatcher: (path: string) => path.startsWith("/sign-in"),
                    window: options.rateLimit?.signIn?.window ?? 60 * 1000,
                    max: options.rateLimit?.signIn?.max ?? 10,
                },
                {
                    // Sign-up protection
                    pathMatcher: (path: string) => path.startsWith("/sign-up"),
                    window: options.rateLimit?.signUp?.window ?? 60 * 1000,
                    max: options.rateLimit?.signUp?.max ?? 10,
                },
                {
                    // Password reset protection
                    pathMatcher: (path: string) => path.includes("password"),
                    window: options.rateLimit?.passwordReset?.window ?? 60 * 1000,
                    max: options.rateLimit?.passwordReset?.max ?? 5,
                },
                {
                    // Email verification protection
                    pathMatcher: (path: string) => path.includes("verification") || path.includes("verify-email"),
                    window: options.rateLimit?.emailVerification?.window ?? 60 * 1000,
                    max: options.rateLimit?.emailVerification?.max ?? 5,
                },
            ],

            $Infer: { User: {} as AuthUser, Session: {} as AuthSession },
            $ERROR_CODES: {} as typeof import("./error-codes.js").AUTH_ERROR_CODES,
        }
    },
})

export default auth

// =============================================================================
// UTILITY - Get Internal Adapter (for sub-plugins)
// =============================================================================

/**
 * Get internal adapter for sub-plugins
 * @deprecated Use createInternalAdapter from ./api instead
 */
export function getInternalAdapter(driver: Driver): InternalAdapter {
    return createInternalAdapter(driver, {
        sessionExpiresIn: DEFAULT_SESSION_EXPIRES_IN,
        hooks: createHookAdapter(),
    })
}
