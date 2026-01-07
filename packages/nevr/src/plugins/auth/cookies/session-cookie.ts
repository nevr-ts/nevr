// =============================================================================
// COOKIES - SESSION COOKIE MANAGEMENT
// Session-specific cookie operations
// =============================================================================

import type { AuthSession, AuthUser, AuthPluginOptions } from "../types.js"
import { createCookieHeader, deleteCookieHeader, parseCookies, type CookieOptions } from "./index.js"

// -----------------------------------------------------------------------------
// Session Cookie Configuration
// -----------------------------------------------------------------------------

export interface SessionCookieConfig {
    /** Cookie name */
    name: string
    /** Session expiry in seconds */
    expiresIn: number
    /** Cookie options */
    options: CookieOptions
}

/**
 * Get default session cookie configuration
 */
export function getSessionCookieConfig(options?: AuthPluginOptions["session"]): SessionCookieConfig {
    return {
        name: options?.cookieName ?? "nevr.session_token",
        expiresIn: options?.expiresIn ?? 60 * 60 * 24 * 7, // 7 days
        options: {
            path: options?.cookie?.path ?? "/",
            domain: options?.cookie?.domain,
            httpOnly: options?.cookie?.httpOnly ?? true,
            secure: options?.cookie?.secure ?? process.env.NODE_ENV === "production",
            sameSite: options?.cookie?.sameSite ?? "lax",
        },
    }
}

// -----------------------------------------------------------------------------
// Date Utilities
// -----------------------------------------------------------------------------

/**
 * Get a date in the future
 * 
 * @param seconds - Number of seconds from now
 * @returns Future date
 */
export function getExpiryDate(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000)
}

/**
 * Check if a date has expired
 * 
 * @param date - Date to check
 * @returns true if date is in the past
 */
export function isExpired(date: Date): boolean {
    return date.getTime() < Date.now()
}

/**
 * Check if session needs refresh (based on updateAge)
 * 
 * @param expiresAt - Session expiry date
 * @param expiresIn - Total session lifetime in seconds
 * @param updateAge - Update threshold in seconds
 * @returns true if session should be refreshed
 */
export function needsRefresh(expiresAt: Date, expiresIn: number, updateAge: number): boolean {
    const updateDue = expiresAt.getTime() - expiresIn * 1000 + updateAge * 1000
    return updateDue <= Date.now()
}

// -----------------------------------------------------------------------------
// Session Cookie Operations
// -----------------------------------------------------------------------------

/**
 * Set session cookie on response headers
 * 
 * @param headers - Response headers object
 * @param token - Session token
 * @param config - Session cookie configuration
 * @param dontRemember - If true, use shorter expiry
 */
export function setSessionCookie(
    headers: Record<string, string>,
    token: string,
    config: SessionCookieConfig,
    dontRemember?: boolean
): void {
    const maxAge = dontRemember ? 60 * 60 * 24 : config.expiresIn // 1 day if not remembered
    headers["Set-Cookie"] = createCookieHeader(config.name, token, {
        ...config.options,
        maxAge,
    })
}

/**
 * Delete session cookie from response headers
 * 
 * @param headers - Response headers object
 * @param config - Session cookie configuration
 */
export function deleteSessionCookie(
    headers: Record<string, string>,
    config: SessionCookieConfig
): void {
    headers["Set-Cookie"] = deleteCookieHeader(config.name, config.options)
}

/**
 * Get session token from request headers
 * Checks both Authorization header (Bearer) and Cookie header
 * 
 * @param headers - Request headers
 * @param cookieName - Cookie name to look for
 * @returns Session token or null
 */
export function getSessionToken(
    headers: Record<string, string | undefined>,
    cookieName: string
): string | null {
    // Check Authorization header first (Bearer token)
    const authHeader = headers["authorization"]
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7)
    }

    // Fall back to cookie
    const cookies = parseCookies(headers["cookie"])
    return cookies[cookieName] || null
}

// -----------------------------------------------------------------------------
// Session Cookie Context
// For use with endpoint context
// -----------------------------------------------------------------------------

export interface SessionCookieContext {
    session: AuthSession
    user: AuthUser
}

/**
 * Create session cookie helpers bound to configuration
 * 
 * @example
 * ```typescript
 * const cookieHelpers = createSessionCookieHelpers(options)
 * cookieHelpers.set(headers, token)
 * cookieHelpers.delete(headers)
 * ```
 */
export function createSessionCookieHelpers(sessionOptions?: AuthPluginOptions["session"]) {
    const config = getSessionCookieConfig(sessionOptions)

    return {
        config,
        set: (headers: Record<string, string>, token: string, dontRemember?: boolean) =>
            setSessionCookie(headers, token, config, dontRemember),
        delete: (headers: Record<string, string>) =>
            deleteSessionCookie(headers, config),
        getToken: (headers: Record<string, string | undefined>) =>
            getSessionToken(headers, config.name),
    }
}
