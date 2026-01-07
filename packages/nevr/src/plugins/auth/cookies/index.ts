// =============================================================================
// COOKIES - CORE COOKIE UTILITIES
// Cookie parsing and creation utilities
// =============================================================================

// -----------------------------------------------------------------------------
// Cookie Options
// -----------------------------------------------------------------------------

export interface CookieOptions {
    /** Max age in seconds */
    maxAge?: number
    /** Expiry date */
    expires?: Date
    /** Cookie path */
    path?: string
    /** Cookie domain */
    domain?: string
    /** HTTPS only */
    secure?: boolean
    /** HTTP only (not accessible via JS) */
    httpOnly?: boolean
    /** SameSite policy */
    sameSite?: "strict" | "lax" | "none"
}

/**
 * Default cookie options for auth cookies
 */
export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
}

// -----------------------------------------------------------------------------
// Cookie Creation
// -----------------------------------------------------------------------------

/**
 * Create a Set-Cookie header value
 * 
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options
 * @returns Set-Cookie header string
 * 
 * @example
 * ```typescript
 * const cookie = createCookieHeader("session", "token123", { 
 *     maxAge: 86400, 
 *     httpOnly: true 
 * })
 * // "session=token123; Max-Age=86400; HttpOnly; Path=/"
 * ```
 */
export function createCookieHeader(
    name: string,
    value: string,
    options: CookieOptions = {}
): string {
    const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]

    if (options.maxAge !== undefined) {
        parts.push(`Max-Age=${options.maxAge}`)
    }

    if (options.expires) {
        parts.push(`Expires=${options.expires.toUTCString()}`)
    }

    if (options.path) {
        parts.push(`Path=${options.path}`)
    }

    if (options.domain) {
        parts.push(`Domain=${options.domain}`)
    }

    if (options.secure) {
        parts.push("Secure")
    }

    if (options.httpOnly) {
        parts.push("HttpOnly")
    }

    if (options.sameSite) {
        parts.push(`SameSite=${options.sameSite}`)
    }

    return parts.join("; ")
}

/**
 * Create a delete cookie header (sets maxAge to 0)
 * 
 * @param name - Cookie name
 * @param options - Cookie options (path/domain must match original)
 * @returns Set-Cookie header string that deletes the cookie
 */
export function deleteCookieHeader(name: string, options: CookieOptions = {}): string {
    return createCookieHeader(name, "", {
        ...options,
        maxAge: 0,
        expires: new Date(0),
    })
}

// -----------------------------------------------------------------------------
// Cookie Parsing
// -----------------------------------------------------------------------------

/**
 * Parse cookies from Cookie header
 * 
 * @param cookieHeader - Cookie header string
 * @returns Record of cookie name -> value
 * 
 * @example
 * ```typescript
 * const cookies = parseCookies("session=abc; user=john")
 * // { session: "abc", user: "john" }
 * ```
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) return {}

    const cookies: Record<string, string> = {}

    cookieHeader.split(";").forEach((cookie) => {
        const [name, ...valueParts] = cookie.split("=")
        const trimmedName = name?.trim()
        if (trimmedName) {
            cookies[trimmedName] = decodeURIComponent(valueParts.join("=").trim())
        }
    })

    return cookies
}

/**
 * Get a specific cookie value from Cookie header
 * 
 * @param cookieHeader - Cookie header string
 * @param name - Cookie name
 * @returns Cookie value or undefined
 */
export function getCookie(cookieHeader: string | undefined, name: string): string | undefined {
    const cookies = parseCookies(cookieHeader)
    return cookies[name]
}

// Re-export session cookie from sub-module
export * from "./session-cookie.js"
