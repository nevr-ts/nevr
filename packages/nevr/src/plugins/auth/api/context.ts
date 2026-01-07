// =============================================================================
// API - REQUEST CONTEXT HELPERS
// Utilities for extracting information from requests
// =============================================================================

// -----------------------------------------------------------------------------
// IP Address Extraction
// -----------------------------------------------------------------------------

/**
 * Extract client IP address from request headers
 * Checks common proxy headers first
 * 
 * @param headers - Request headers
 * @returns IP address or null
 */
export function getIpAddress(headers: Record<string, string | undefined>): string | null {
    // X-Forwarded-For (standard reverse proxy header)
    const forwarded = headers["x-forwarded-for"]
    if (forwarded) {
        // Can contain multiple IPs, get the first (client)
        return forwarded.split(",")[0].trim()
    }

    // X-Real-IP (nginx)
    const realIp = headers["x-real-ip"]
    if (realIp) {
        return realIp
    }

    // CF-Connecting-IP (Cloudflare)
    const cfIp = headers["cf-connecting-ip"]
    if (cfIp) {
        return cfIp
    }

    // True-Client-IP (Akamai, Cloudflare Enterprise)
    const trueClientIp = headers["true-client-ip"]
    if (trueClientIp) {
        return trueClientIp
    }

    return null
}

/**
 * Extract user agent from request headers
 * 
 * @param headers - Request headers
 * @returns User agent string or null
 */
export function getUserAgent(headers: Record<string, string | undefined>): string | null {
    return headers["user-agent"] || null
}

/**
 * Extract origin from request headers
 * 
 * @param headers - Request headers
 * @returns Origin URL or null
 */
export function getOrigin(headers: Record<string, string | undefined>): string | null {
    return headers["origin"] || headers["referer"] || null
}

// -----------------------------------------------------------------------------
// Request Context
// -----------------------------------------------------------------------------

export interface RequestContext {
    ip: string | null
    userAgent: string | null
    origin: string | null
}

/**
 * Extract request context from headers
 */
export function getRequestContext(headers: Record<string, string | undefined>): RequestContext {
    return {
        ip: getIpAddress(headers),
        userAgent: getUserAgent(headers),
        origin: getOrigin(headers),
    }
}
