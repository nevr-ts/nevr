// =============================================================================
// HONO ADAPTER
// Hono adapter for zapi - lightweight, fast, and edge-ready
// =============================================================================

import type { Context, MiddlewareHandler, Hono } from "hono"
import type { ZapiInstance, ZapiRequest, ZapiResponse, User } from "../types.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface HonoAdapterOptions {
  /** Get user from Hono context */
  getUser?: (c: Context) => User | null | Promise<User | null>

  /** Prefix for routes (optional) */
  prefix?: string

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

async function honoToZapi(
  c: Context,
  getUser?: HonoAdapterOptions["getUser"]
): Promise<ZapiRequest> {
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
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    try {
      body = await c.req.json()
    } catch {
      // Body might not be JSON
      try {
        body = await c.req.text()
      } catch {
        body = undefined
      }
    }
  }

  return {
    method: c.req.method as ZapiRequest["method"],
    path: url.pathname,
    params: c.req.param() as Record<string, string>,
    query,
    body,
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

function sendResponse(c: Context, response: ZapiResponse): Response {
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
 * Create a Hono middleware handler for zapi
 *
 * @example
 * ```typescript
 * import { Hono } from "hono"
 * import { zapi } from "@zapi-ts/core"
 * import { honoAdapter } from "@zapi-ts/adapter-hono"
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
  zapi: ZapiInstance,
  options: HonoAdapterOptions = {}
): MiddlewareHandler {
  const { getUser, cors, debugLogs } = options

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

      // Convert Hono context to Zapi request
      const zapiRequest = await honoToZapi(c, getUser)

      if (debugLogs) {
        console.log(`[zapi:hono] ${c.req.method} ${c.req.path}`)
      }

      // Handle request
      const response = await zapi.handleRequest(zapiRequest)

      // Send response
      return sendResponse(c, response)
    } catch (error) {
      if (debugLogs) {
        console.error("[zapi:hono] Unhandled error:", error)
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
// Mount Helper - Mount zapi routes on a Hono app
// -----------------------------------------------------------------------------

/**
 * Mount zapi on a Hono app with automatic route registration
 *
 * @example
 * ```typescript
 * import { Hono } from "hono"
 * import { zapi } from "@zapi-ts/core"
 * import { mountZapi } from "@zapi-ts/adapter-hono"
 *
 * const app = new Hono()
 * mountZapi(app, api, { prefix: "/api" })
 * ```
 */
export function mountZapi(
  app: Hono<any>,
  zapi: ZapiInstance,
  options: HonoAdapterOptions = {}
): void {
  const prefix = options.prefix || "/api"
  const handler = honoAdapter(zapi, options)

  // Mount on all methods with wildcard
  app.all(`${prefix}/*`, handler)
}

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

export default honoAdapter
