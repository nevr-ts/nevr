// =============================================================================
// ROUTE - SIGN OUT
// Sign out endpoint
// =============================================================================

import { endpoint } from "../../../unified/endpoint.js"
import type { InternalAdapter, AuthPluginOptions } from "../../types.js"
import { getSessionToken, deleteSessionCookie, type SessionCookieConfig } from "../../cookies/session-cookie.js"
import { runHook } from "../hooks.js"
import { getLogger } from "../../../../logger.js"
import { createInternalAdapter } from "../internal-adapter.js"

// -----------------------------------------------------------------------------
// Route Factory
// -----------------------------------------------------------------------------

export interface SignOutRouteConfig {
    cookieConfig: SessionCookieConfig
    sessionExpiresIn?: number
}

/**
 * Create sign out endpoint
 */
export function signOut(config: SignOutRouteConfig) {
    const { cookieConfig, sessionExpiresIn = 60 * 60 * 24 * 7 } = config

    return endpoint("/sign-out", {
        method: "POST",
        meta: {
            summary: "Sign out the current user",
            description: "Invalidate the current session and clear the session cookie",
            tags: ["Authentication"],
        },
        handler: async (ctx: any) => {
            const headers: Record<string, string> = {}

            // Get adapter from context at runtime
            const driver = ctx.context?.driver || ctx.driver
            const adapter: InternalAdapter | null = driver
                ? createInternalAdapter(driver, { sessionExpiresIn })
                : null

            const token = getSessionToken(ctx.headers || {}, cookieConfig.name)

            if (token && adapter) {
                // Get session to find user ID for hook
                const sessionResult = await adapter.findSession(token)
                const userId = sessionResult?.user?.id

                // Run beforeSignOut hook
                if (userId) {
                    await runHook("beforeSignOut", userId)
                }

                // Delete session
                try {
                    await adapter.deleteSession(token)
                } catch (e) {
                    getLogger().error("[auth] Failed to delete session", e)
                }

                // Run afterSignOut hook
                if (userId) {
                    await runHook("afterSignOut", userId)
                }
            }

            // Clear cookie
            deleteSessionCookie(headers, cookieConfig)

            return { status: 200, body: { success: true }, headers }
        },
    })
}
