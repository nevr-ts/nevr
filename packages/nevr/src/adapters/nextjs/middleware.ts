// =============================================================================
// NEXT.JS MIDDLEWARE HELPER
// Middleware helper for protecting routes in Next.js
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MiddlewareOptions {
  /** Routes that require authentication (supports wildcards) */
  protectedRoutes?: string[]

  /** Routes that are always public (supports wildcards) */
  publicRoutes?: string[]

  /** Redirect path for unauthenticated users */
  loginPath?: string

  /** Cookie name for session */
  cookieName?: string

  /** Callback URL parameter name */
  callbackParam?: string

  /** Enable debug logging */
  debug?: boolean
}

export interface MiddlewareRequest {
  nextUrl: {
    pathname: string
    searchParams: URLSearchParams
  }
  url: string
  cookies: {
    get(name: string): { value: string } | undefined
  }
}

export interface MiddlewareResponseStatic {
  next(): MiddlewareResponseInstance
  redirect(url: URL): MiddlewareResponseInstance
}

export interface MiddlewareResponseInstance {
  // NextResponse instance
}

// -----------------------------------------------------------------------------
// Route Matching
// -----------------------------------------------------------------------------

/**
 * Check if a path matches a route pattern
 * Supports wildcards (*) for matching any segment
 */
function matchRoute(path: string, pattern: string): boolean {
  // Exact match
  if (path === pattern) return true

  // Wildcard at end (e.g., "/api/*" matches "/api/users")
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2)
    return path === prefix || path.startsWith(prefix + "/")
  }

  // Wildcard in middle (e.g., "/users/*/edit")
  if (pattern.includes("*")) {
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, "[^/]+") + "$"
    )
    return regex.test(path)
  }

  // Check if path starts with pattern (for nested routes)
  return path.startsWith(pattern + "/")
}

/**
 * Check if a path matches any of the route patterns
 */
function matchesAnyRoute(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchRoute(path, pattern))
}

// -----------------------------------------------------------------------------
// Middleware Factory
// -----------------------------------------------------------------------------

/**
 * Create a Next.js middleware for route protection
 *
 * Note: This is a lightweight middleware that only checks for cookie existence.
 * Full session validation happens in the route handlers for performance.
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { withNevrMiddleware } from "nevr/adapters/nextjs"
 *
 * export default withNevrMiddleware({
 *   protectedRoutes: ["/dashboard/*", "/settings/*", "/api/users/*"],
 *   publicRoutes: ["/", "/login", "/register", "/api/auth/*"],
 *   loginPath: "/login",
 * })
 *
 * export const config = {
 *   matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
 * }
 * ```
 */
export function withNevrMiddleware(options: MiddlewareOptions = {}) {
  const {
    protectedRoutes = [],
    publicRoutes = ["/", "/login", "/register", "/api/auth"],
    loginPath = "/login",
    cookieName = "nevr.session_token",
    callbackParam = "callbackUrl",
    debug = false,
  } = options

  // Return a middleware function that works with Next.js
  return async function middleware(request: MiddlewareRequest) {
    // Dynamic import NextResponse to avoid bundling issues
    const { NextResponse } = await import("next/server")

    const { pathname } = request.nextUrl

    if (debug) {
      console.log(`[nevr:middleware] Checking path: ${pathname}`)
    }

    // Skip static assets and Next.js internals
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/static") ||
      pathname.includes(".")
    ) {
      return NextResponse.next()
    }

    // Check if route is explicitly public
    if (matchesAnyRoute(pathname, publicRoutes)) {
      if (debug) {
        console.log(`[nevr:middleware] Public route: ${pathname}`)
      }
      return NextResponse.next()
    }

    // Check if route is protected
    const isProtected = protectedRoutes.length === 0
      ? false // If no protected routes defined, nothing is protected by default
      : matchesAnyRoute(pathname, protectedRoutes)

    if (isProtected) {
      // Check for session cookie
      const token = request.cookies.get(cookieName)?.value

      if (!token) {
        if (debug) {
          console.log(`[nevr:middleware] No session, redirecting to login: ${pathname}`)
        }

        // Redirect to login with callback URL
        const loginUrl = new URL(loginPath, request.url)
        loginUrl.searchParams.set(callbackParam, pathname)
        return NextResponse.redirect(loginUrl)
      }

      if (debug) {
        console.log(`[nevr:middleware] Session found, allowing: ${pathname}`)
      }
    }

    return NextResponse.next()
  }
}

/**
 * Create middleware config matcher for common patterns
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { withNevrMiddleware, createMatcher } from "nevr/adapters/nextjs"
 *
 * export default withNevrMiddleware({ ... })
 * export const config = createMatcher()
 * ```
 */
export function createMatcher(options: {
  /** Additional paths to exclude */
  exclude?: string[]
  /** Additional paths to include */
  include?: string[]
} = {}) {
  const excludePatterns = [
    "_next/static",
    "_next/image",
    "favicon.ico",
    ...(options.exclude || []),
  ]

  // Build negative lookahead pattern
  const excludeRegex = excludePatterns
    .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")

  const patterns = [`/((?!${excludeRegex}).*)`]

  if (options.include) {
    patterns.push(...options.include)
  }

  return { matcher: patterns }
}

export default withNevrMiddleware
