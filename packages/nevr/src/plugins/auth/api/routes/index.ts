// =============================================================================
// API ROUTES - BARREL EXPORTS
// Combine all routes into a single endpoints object
// =============================================================================

import type { AuthPluginOptions } from "../../types.js"
import { getSessionCookieConfig, type SessionCookieConfig } from "../../cookies/session-cookie.js"
import { hashPassword, verifyPassword } from "../../crypto/index.js"

// Import route factories
import { signUpEmail } from "./sign-up.js"
import { signInEmail } from "./sign-in.js"
import { signOut } from "./sign-out.js"
import {
    getSession,
    listSessions,
    revokeSession,
    revokeSessions,
    revokeOtherSessions,
    getSessionFromCtx,
    requireSession,
    requireFreshSession,
    isSessionFresh,
} from "./session.js"
import { sendVerificationEmail, verifyEmail } from "./email-verification.js"
import { requestPasswordReset, resetPasswordCallback, resetPassword } from "./reset-password.js"
import { updateUser, changePassword, changeEmail, deleteUser } from "./update-user.js"
import { listAccounts, unlinkAccount } from "./account.js"

// Re-export individual routes for custom usage
export { signUpEmail } from "./sign-up.js"
export { signInEmail } from "./sign-in.js"
export { signOut } from "./sign-out.js"
export {
    getSession,
    listSessions,
    revokeSession,
    revokeSessions,
    revokeOtherSessions,
    getSessionFromCtx,
    requireSession,
    requireFreshSession,
    isSessionFresh,
    type SessionContext,
    type SessionMiddlewareConfig,
} from "./session.js"
export { sendVerificationEmail, verifyEmail } from "./email-verification.js"
export { requestPasswordReset, resetPasswordCallback, resetPassword } from "./reset-password.js"
export { updateUser, changePassword, changeEmail, deleteUser } from "./update-user.js"
export { listAccounts, unlinkAccount } from "./account.js"

// -----------------------------------------------------------------------------
// Route Configuration
// -----------------------------------------------------------------------------

export interface CreateRoutesConfig {
    options: AuthPluginOptions
}

// -----------------------------------------------------------------------------
// Create All Routes
// -----------------------------------------------------------------------------

import { signInWithProvider, linkSocial } from "./oauth.js"
import { oauthCallback } from "./callback.js"

// Re-export OAuth routes
export { signInWithProvider, linkSocial } from "./oauth.js"
export { oauthCallback } from "./callback.js"

/**
 * Create all auth routes with configuration
 * NOTE: Routes get the adapter from ctx.context.driver at runtime
 * 
 * @param config - Route configuration
 * @returns Endpoints object for createPlugin
 */
export function createRoutes(config: CreateRoutesConfig) {
    const { options } = config

    // Build cookie config
    const cookieConfig: SessionCookieConfig = getSessionCookieConfig(options.session)

    // Build password config
    const passwordConfig = {
        hash: options.password?.hash ?? hashPassword,
        verify: options.password?.verify ?? verifyPassword,
        minLength: options.emailAndPassword?.minPasswordLength ?? 8,
        maxLength: options.emailAndPassword?.maxPasswordLength ?? 128,
    }

    // Build session config
    const sessionConfig = {
        expiresIn: options.session?.expiresIn ?? 60 * 60 * 24 * 7,
        updateAge: options.session?.updateAge ?? 60 * 60 * 24,
    }

    // Create route configs (no adapter - routes get it from context at runtime)
    const signUpConfig = { options, cookieConfig, passwordConfig }
    const signInConfig = { options, cookieConfig, passwordConfig }
    const signOutConfig = { cookieConfig, sessionExpiresIn: sessionConfig.expiresIn }
    const sessionRouteConfig = { cookieConfig, sessionConfig }
    const emailVerificationConfig = { options, cookieConfig, sessionConfig }
    const resetPasswordConfig = { options, sessionConfig, passwordConfig }
    const updateUserConfig = { options, cookieConfig, sessionConfig, passwordConfig }
    const accountConfig = { options, cookieConfig, sessionConfig }
    const oauthConfig = { options, cookieConfig, sessionConfig }

    return {
        // Core auth
        signUpEmail: signUpEmail(signUpConfig),
        signInEmail: signInEmail(signInConfig),
        signOut: signOut(signOutConfig),

        // Session management
        getSession: getSession(sessionRouteConfig),
        listSessions: listSessions(sessionRouteConfig),
        revokeSession: revokeSession(sessionRouteConfig),
        revokeSessions: revokeSessions(sessionRouteConfig),
        revokeOtherSessions: revokeOtherSessions(sessionRouteConfig),

        // Email verification
        sendVerificationEmail: sendVerificationEmail(emailVerificationConfig),
        verifyEmail: verifyEmail(emailVerificationConfig),

        // Password reset
        requestPasswordReset: requestPasswordReset(resetPasswordConfig),
        resetPasswordCallback: resetPasswordCallback(resetPasswordConfig),
        resetPassword: resetPassword(resetPasswordConfig),

        // Update user (Phase 4)
        updateUser: updateUser(updateUserConfig),
        changePassword: changePassword(updateUserConfig),
        changeEmail: changeEmail(updateUserConfig),
        deleteUser: deleteUser(updateUserConfig),

        // Account management (Phase 4)
        listAccounts: listAccounts(accountConfig),
        unlinkAccount: unlinkAccount(accountConfig),

        // OAuth (Phase 6)
        signInWithProvider: signInWithProvider(oauthConfig),
        linkSocial: linkSocial(oauthConfig),
        oauthCallback: oauthCallback(oauthConfig),
    }
}



