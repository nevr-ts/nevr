// =============================================================================
// HONO ADAPTER
// Hono adapter for nevr - lightweight, fast, and edge-ready
// =============================================================================

import type { Context, Hono } from "hono"
import type { NevrInstance, NevrRequest, NevrResponse, User } from "../types.js"

// Use a generic handler type to avoid version conflicts between different Hono versions
// This allows the adapter to work regardless of the exact Hono version the user has installed
type HonoHandler = (c: any) => Promise<Response> | Response
import { getLogger } from "../logger.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface HonoAdapterOptions {
  /** Get user from Hono context */
  getUser?: (c: Context) => User | null | Promise<User | null>

  /** Prefix for routes (optional, for mountNevr helper) */
  prefix?: string

  /** Base path to strip from URL (e.g., "/api") */
  basePath?: string

  /** Enable debug logs */
  debugLogs?: boolean

  /** CORS origin (string or array of strings) */
  cors?: string | string[] | boolean

  /** Trust proxy (for X-Forwarded-For) */
  trustProxy?: boolean
}

// -----------------------------------------------------------------------------
// Request Converter
// -----------------------------------------------------------------------------

async function honoToNevr(
  c: Context,
  options: { getUser?: HonoAdapterOptions["getUser"]; basePath?: string } = {}
): Promise<NevrRequest> {
  const { getUser, basePath } = options

  // Get user
  const user = getUser ? await getUser(c) : null

  // Parse query string
  const query: Record<string, string | string[] | undefined> = {}
  const url = new URL(c.req.url)
  url.searchParams.forEach((value, key) => {
    const existing = query[key]
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        query[key] = [existing, value]
      }
    } else {
      query[key] = value
    }
  })

  // Parse headers
  const headers: Record<string, string | undefined> = {}
  c.req.raw.headers.forEach((value: string, key: string) => {
    headers[key.toLowerCase()] = value
  })

  // Get body for non-GET requests
  let body: unknown = undefined
  let rawBody: string | undefined
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    try {
      // Clone request to read body twice (for rawBody and parsed)
      const text = await c.req.text()
      rawBody = text // Preserve raw body for webhook signature verification
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          body = text
        }
      }
    } catch {
      body = undefined
    }
  }

  // Extract path and strip basePath if provided
  let path = url.pathname
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length) || "/"
  }

  return {
    method: c.req.method as NevrRequest["method"],
    path,
    params: c.req.param() as Record<string, string>,
    query,
    body,
    rawBody, // Include raw body for webhook signature verification
    headers,
    user,
    context: {
      raw: { c },
      ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
    },
  }
}

// -----------------------------------------------------------------------------
// Response Sender
// -----------------------------------------------------------------------------

function sendResponse(c: Context, response: NevrResponse): Response {
  // Set headers
  if (response.headers) {
    for (const [key, value] of Object.entries(response.headers)) {
      c.header(key, value)
    }
  }

  // Send response
  if (response.status === 204) {
    return c.body(null, 204)
  }

  return c.json(response.body, response.status as any)
}

// -----------------------------------------------------------------------------
// CORS Handler
// -----------------------------------------------------------------------------

function getCorsHeaders(
  cors: string | string[] | boolean,
  origin?: string
): Record<string, string> {
  const headers: Record<string, string> = {}

  if (cors === true) {
    headers["Access-Control-Allow-Origin"] = origin || "*"
  } else if (typeof cors === "string") {
    headers["Access-Control-Allow-Origin"] = cors
  } else if (Array.isArray(cors) && origin && cors.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
  }

  if (headers["Access-Control-Allow-Origin"]) {
    headers["Access-Control-Allow-Methods"] =
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    headers["Access-Control-Allow-Headers"] =
      "Content-Type, Authorization, X-Requested-With"
    headers["Access-Control-Allow-Credentials"] = "true"
    headers["Access-Control-Max-Age"] = "86400"
  }

  return headers
}

// -----------------------------------------------------------------------------
// Hono Adapter Factory
// -----------------------------------------------------------------------------

/**
 * Create a Hono middleware handler for nevr
 *
 * @example
 * ```typescript
 * import { Hono } from "hono"
 * import { nevr } from "nevr"
 * import { honoAdapter } from "nevr/adapters/hono"
 *
 * const app = new Hono()
 *
 * app.all("/api/*", honoAdapter(api, {
 *   getUser: (c) => {
 *     const id = c.req.header("x-user-id")
 *     return id ? { id } : null
 *   },
 *   cors: true,
 * }))
 * ```
 */
export function honoAdapter(
  nevr: NevrInstance,
  options: HonoAdapterOptions = {}
): HonoHandler {
  const { getUser, basePath, cors, debugLogs } = options

  return async (c: Context) => {
    try {
      // Handle CORS preflight
      if (c.req.method === "OPTIONS" && cors) {
        const corsHeaders = getCorsHeaders(cors, c.req.header("origin"))
        for (const [key, value] of Object.entries(corsHeaders)) {
          c.header(key, value)
        }
        return c.body(null, 204)
      }

      // Set CORS headers
      if (cors) {
        const corsHeaders = getCorsHeaders(cors, c.req.header("origin"))
        for (const [key, value] of Object.entries(corsHeaders)) {
          c.header(key, value)
        }
      }

      // Convert Hono context to Nevr request
      const nevrRequest = await honoToNevr(c, { getUser, basePath })

      if (debugLogs) {
        getLogger().debug(`[nevr:hono] ${c.req.method} ${c.req.path}`)
      }

      // Handle request
      const response = await nevr.handleRequest(nevrRequest)

      // Send response
      return sendResponse(c, response)
    } catch (error) {
      if (debugLogs) {
        getLogger().error("[nevr:hono] Unhandled error:", error)
      }

      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
          },
        },
        500
      )
    }
  }
}

// -----------------------------------------------------------------------------
// Mount Helper - Mount nevr routes on a Hono app
// -----------------------------------------------------------------------------

/**
 * Mount nevr on a Hono app with automatic route registration
 *
 * @example
 * ```typescript
 * import { Hono } from "hono"
 * import { nevr } from "nevr"
 * import { mountNevr } from "nevr/adapters/hono"
 *
 * const app = new Hono()
 * mountNevr(app, api, { prefix: "/api" })
 * ```
 */
export function mountNevr(
  app: Hono<any>,
  api: NevrInstance,
  options: HonoAdapterOptions = {}
): void {
  const prefix = options.prefix || "/api"
  const handler = honoAdapter(api, options)

  // Mount on all methods with wildcard
  app.all(`${prefix}/*`, handler)
}

// Alias for backward compatibility
/** @deprecated Use mountNevr instead */
// export { mountNevr  }

// -----------------------------------------------------------------------------
// Helper: Development Auth
// -----------------------------------------------------------------------------

/**
 * Simple header-based auth for development
 * Uses X-User-Id and X-User-Role headers
 */
export function devAuth(c: Context): User | null {
  const id = c.req.header("x-user-id")
  const role = c.req.header("x-user-role")

  if (id) {
    return {
      id,
      role: role || "user",
    }
  }

  return null
}

// -----------------------------------------------------------------------------
// Helper: JWT Auth
// -----------------------------------------------------------------------------

/**
 * JWT-based auth helper (requires a verify function)
 */
export function jwtAuth(
  verify: (token: string) => User | null | Promise<User | null>
): (c: Context) => Promise<User | null> {
  return async (c: Context): Promise<User | null> => {
    const auth = c.req.header("authorization")
    if (!auth?.startsWith("Bearer ")) {
      return null
    }

    const token = auth.slice(7)
    try {
      return await verify(token)
    } catch {
      return null
    }
  }
}

// -----------------------------------------------------------------------------
// Helper: Cookie Auth
// -----------------------------------------------------------------------------

/**
 * Cookie-based session auth helper
 */
export function cookieAuth(
  getSession: (
    sessionId: string
  ) => User | null | Promise<User | null>,
  cookieName = "session"
): (c: Context) => Promise<User | null> {
  return async (c: Context): Promise<User | null> => {
    const cookie = c.req.header("cookie")
    if (!cookie) return null

    // Parse cookies
    const cookies: Record<string, string> = {}
    cookie.split(";").forEach((part: string) => {
      const [key, value] = part.trim().split("=")
      if (key && value) cookies[key] = value
    })

    const sessionId = cookies[cookieName]
    if (!sessionId) return null

    try {
      return await getSession(sessionId)
    } catch {
      return null
    }
  }
}

// -----------------------------------------------------------------------------
// Helper: Session Auth (with Auth Plugin)
// -----------------------------------------------------------------------------

/**
 * Session-based auth that works with the Nevr auth plugin
 * Reads session token from cookies and validates against the database
 *
 * @example
 * ```typescript
 * import { Hono } from "hono"
 * import { honoAdapter, sessionAuth } from "nevr/adapters/hono"
 * import { prisma } from "nevr/drivers/prisma"
 * import { PrismaClient } from "@prisma/client"
 *
 * const db = new PrismaClient()
 * const driver = prisma(db)
 *
 * const app = new Hono()
 * app.route("/api", honoAdapter(api, {
 *   getUser: sessionAuth(driver),
 * }))
 * ```
 */
export function sessionAuth(
  driver: any,
  options?: {
    /** Cookie name for session token (default: "nevr.session_token") */
    cookieName?: string
  }
): (c: Context) => Promise<User | null> {
  const cookieName = options?.cookieName || "nevr.session_token"

  return async (c: Context): Promise<User | null> => {
    // Try to get token from cookie
    const cookieHeader = c.req.header("cookie")
    let token: string | undefined

    if (cookieHeader) {
      const cookies: Record<string, string> = {}
      cookieHeader.split(";").forEach((cookie) => {
        const [name, ...valueParts] = cookie.split("=")
        const trimmedName = name?.trim()
        if (trimmedName) {
          cookies[trimmedName] = decodeURIComponent(valueParts.join("=").trim())
        }
      })
      token = cookies[cookieName]
    }

    // Also try Authorization header (Bearer token)
    if (!token) {
      const auth = c.req.header("authorization")
      if (auth?.startsWith("Bearer ")) {
        token = auth.slice(7)
      }
    }

    if (!token) {
      return null
    }

    try {
      // Find session in database
      const session = await driver.findOne("session", { token })
      if (!session) {
        return null
      }

      // Check expiry
      const expiresAt = new Date(session.expiresAt)
      if (expiresAt < new Date()) {
        return null
      }

      // Get user
      const user = await driver.findOne("user", { id: session.userId })
      if (!user) {
        return null
      }

      // Update session last used (async, don't wait)
      driver.update("session", { id: session.id }, { updatedAt: new Date() }).catch(() => {})

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
        image: user.image,
        emailVerified: user.emailVerified,
        // Include payment-related fields for billing portal
        stripeCustomerId: user.stripeCustomerId,
      }
    } catch (error) {
      getLogger().error("[nevr:hono] Session auth error:", error)
      return null
    }
  }
}

// Aliases for convenience
export { devAuth as honoDevAuth }
export { jwtAuth as honoJwtAuth }
export { sessionAuth as honoSessionAuth }

export default honoAdapter
