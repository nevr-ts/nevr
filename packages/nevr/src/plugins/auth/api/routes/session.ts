// =============================================================================
// ROUTE - SESSION
// Session management endpoints (get, list, revoke)
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import type { InternalAdapter, AuthSession } from "../../types.js"
import { AUTH_ERROR_CODES } from "../../error-codes.js"
import {
    getSessionToken,
    setSessionCookie,
    deleteSessionCookie,
    isExpired,
    needsRefresh,
    type SessionCookieConfig,
} from "../../cookies/session-cookie.js"
import { createInternalAdapter } from "../internal-adapter.js"

// -----------------------------------------------------------------------------
// Session Middleware Helpers
// -----------------------------------------------------------------------------

export interface SessionContext {
    session: AuthSession
    user: import("../../types.js").AuthUser
}

export interface SessionMiddlewareConfig {
    cookieConfig: SessionCookieConfig
    sessionExpiresIn: number
    /** Session age in seconds to be considered "fresh" for sensitive operations */
    freshAge?: number
}

/**
 * Get session from context - reusable helper for all routes
 * Returns session and user if valid, null otherwise
 */
export async function getSessionFromCtx(
    ctx: any,
    config: SessionMiddlewareConfig
): Promise<SessionContext | null> {
    const token = getSessionToken(ctx.headers || {}, config.cookieConfig.name)
    if (!token) return null

    const driver = ctx.context?.driver || ctx.driver
    if (!driver) return null

    const adapter = createInternalAdapter(driver, {
        sessionExpiresIn: config.sessionExpiresIn,
    })

    const result = await adapter.findSession(token)
    if (!result) return null

    return { session: result.session, user: result.user }
}

/**
 * Check if session is fresh (recently authenticated)
 * Useful for sensitive operations like password change, account deletion
 */
export function isSessionFresh(session: AuthSession, freshAgeSeconds: number = 300): boolean {
    const sessionCreatedAt = new Date(session.createdAt).getTime()
    const now = Date.now()
    const ageMs = now - sessionCreatedAt
    return ageMs < freshAgeSeconds * 1000
}

/**
 * Higher-order function that wraps a handler to require authentication
 */
export function requireSession<T>(
    handler: (ctx: any, session: SessionContext) => Promise<T>,
    config: SessionMiddlewareConfig
): (ctx: any) => Promise<T> {
    return async (ctx: any) => {
        const sessionCtx = await getSessionFromCtx(ctx, config)
        if (!sessionCtx) {
            throw new EndpointError("UNAUTHORIZED", {
                code: AUTH_ERROR_CODES.UNAUTHORIZED,
                message: "Authentication required",
            })
        }
        return handler(ctx, sessionCtx)
    }
}

/**
 * Higher-order function that requires a fresh session for sensitive operations
 */
export function requireFreshSession<T>(
    handler: (ctx: any, session: SessionContext) => Promise<T>,
    config: SessionMiddlewareConfig & { freshAge?: number }
): (ctx: any) => Promise<T> {
    const freshAge = config.freshAge ?? 300 // 5 minutes default

    return async (ctx: any) => {
        const sessionCtx = await getSessionFromCtx(ctx, config)
        if (!sessionCtx) {
            throw new EndpointError("UNAUTHORIZED", {
                code: AUTH_ERROR_CODES.UNAUTHORIZED,
                message: "Authentication required",
            })
        }
        if (!isSessionFresh(sessionCtx.session, freshAge)) {
            throw new EndpointError("FORBIDDEN", {
                code: AUTH_ERROR_CODES.SESSION_NOT_FRESH,
                message: "Session is not fresh. Please re-authenticate for sensitive operations.",
            })
        }
        return handler(ctx, sessionCtx)
    }
}

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const revokeSessionSchema = z.object({
    token: z.string().min(1, "Token is required"),
})

// -----------------------------------------------------------------------------
// Get Session
// -----------------------------------------------------------------------------

export interface SessionRouteConfig {
    cookieConfig: SessionCookieConfig
    sessionConfig: {
        expiresIn: number
        updateAge: number
    }
}

/**
 * Create get session endpoint
 */
export function getSession(config: SessionRouteConfig) {
    const { cookieConfig, sessionConfig } = config

    return endpoint("/get-session", {
        method: "GET",
        meta: {
            summary: "Get the current session",
            description: "Returns the current session and user if authenticated",
            tags: ["Session"],
        },
        handler: async (ctx: any) => {
            const headers: Record<string, string> = {}
            const token = getSessionToken(ctx.headers || {}, cookieConfig.name)

            if (!token) {
                return { status: 200, body: null }
            }

            // Get adapter from context at runtime
            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                return { status: 200, body: null }
            }
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            const result = await adapter.findSession(token)
            if (!result) {
                deleteSessionCookie(headers, cookieConfig)
                return { status: 200, body: null, headers }
            }

            const { session, user } = result

            // Check if session needs refresh
            if (needsRefresh(new Date(session.expiresAt), sessionConfig.expiresIn, sessionConfig.updateAge)) {
                const updated = await adapter.updateSession(token, {
                    expiresAt: new Date(Date.now() + sessionConfig.expiresIn * 1000),
                })
                if (updated) {
                    setSessionCookie(headers, token, cookieConfig)
                    return { status: 200, body: { session: updated, user }, headers }
                }
            }

            return { status: 200, body: { session, user }, headers }
        },
    })
}

// -----------------------------------------------------------------------------
// List Sessions
// -----------------------------------------------------------------------------

/**
 * Create list sessions endpoint
 */
export function listSessions(config: SessionRouteConfig) {
    const { cookieConfig, sessionConfig } = config

    return endpoint("/list-sessions", {
        method: "GET",
        meta: {
            summary: "List all active sessions",
            description: "Returns all active sessions for the current user",
            tags: ["Session"],
        },
        handler: async (ctx: any) => {
            const token = getSessionToken(ctx.headers || {}, cookieConfig.name)

            if (!token) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Authentication required",
                })
            }

            // Get adapter from context at runtime
            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Database driver not available",
                })
            }
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            const result = await adapter.findSession(token)
            if (!result) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.SESSION_NOT_FOUND,
                    message: "Invalid session",
                })
            }

            const sessions = await adapter.listSessions(result.user.id)
            const activeSessions = sessions.filter((s: AuthSession) => !isExpired(new Date(s.expiresAt)))

            return { status: 200, body: { sessions: activeSessions } }
        },
    })
}

// -----------------------------------------------------------------------------
// Revoke Session
// -----------------------------------------------------------------------------

/**
 * Create revoke session endpoint
 */
export function revokeSession(config: SessionRouteConfig) {
    const { cookieConfig, sessionConfig } = config

    return endpoint("/revoke-session", {
        method: "POST",
        body: revokeSessionSchema,
        meta: {
            summary: "Revoke a specific session",
            description: "Invalidate a specific session by token",
            tags: ["Session"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(revokeSessionSchema, rawBody)

            const currentToken = getSessionToken(ctx.headers || {}, cookieConfig.name)
            if (!currentToken) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Authentication required",
                })
            }

            // Get adapter from context at runtime
            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Database driver not available",
                })
            }
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            const currentSession = await adapter.findSession(currentToken)
            if (!currentSession) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.SESSION_NOT_FOUND,
                    message: "Invalid session",
                })
            }

            // Only allow revoking own sessions
            const targetSession = await adapter.findSession(body.token)
            if (targetSession && targetSession.user.id === currentSession.user.id) {
                await adapter.deleteSession(body.token)
            }

            return { status: 200, body: { status: true } }
        },
    })
}

// -----------------------------------------------------------------------------
// Revoke All Sessions
// -----------------------------------------------------------------------------

/**
 * Create revoke all sessions endpoint
 */
export function revokeSessions(config: SessionRouteConfig) {
    const { cookieConfig, sessionConfig } = config

    return endpoint("/revoke-sessions", {
        method: "POST",
        meta: {
            summary: "Revoke all sessions",
            description: "Invalidate all sessions for the current user",
            tags: ["Session"],
        },
        handler: async (ctx: any) => {
            const token = getSessionToken(ctx.headers || {}, cookieConfig.name)
            if (!token) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Authentication required",
                })
            }

            // Get adapter from context at runtime
            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Database driver not available",
                })
            }
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            const result = await adapter.findSession(token)
            if (!result) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.SESSION_NOT_FOUND,
                    message: "Invalid session",
                })
            }

            await adapter.deleteSessions(result.user.id)

            const headers: Record<string, string> = {}
            deleteSessionCookie(headers, cookieConfig)

            return { status: 200, body: { status: true }, headers }
        },
    })
}

// -----------------------------------------------------------------------------
// Revoke Other Sessions
// -----------------------------------------------------------------------------

/**
 * Create revoke other sessions endpoint
 */
export function revokeOtherSessions(config: SessionRouteConfig) {
    const { cookieConfig, sessionConfig } = config

    return endpoint("/revoke-other-sessions", {
        method: "POST",
        meta: {
            summary: "Revoke all sessions except current",
            description: "Invalidate all sessions except the current one",
            tags: ["Session"],
        },
        handler: async (ctx: any) => {
            const token = getSessionToken(ctx.headers || {}, cookieConfig.name)
            if (!token) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Authentication required",
                })
            }

            // Get adapter from context at runtime
            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Database driver not available",
                })
            }
            const adapter: InternalAdapter = createInternalAdapter(driver, {
                sessionExpiresIn: sessionConfig.expiresIn,
            })

            const result = await adapter.findSession(token)
            if (!result) {
                throw new EndpointError("UNAUTHORIZED", {
                    code: AUTH_ERROR_CODES.SESSION_NOT_FOUND,
                    message: "Invalid session",
                })
            }

            const sessions = await adapter.listSessions(result.user.id)
            const otherSessions = sessions.filter((s: AuthSession) => s.token !== token)

            await Promise.all(otherSessions.map((s: AuthSession) => adapter.deleteSession(s.token)))

            return { status: 200, body: { status: true } }
        },
    })
}
