// =============================================================================
// EXPRESS ADAPTER
// Express adapter for nevr - uses Adapter Factory pattern
// =============================================================================

import type { Request, Response, Router, RequestHandler, NextFunction, Application } from "express"
import type { NevrInstance, NevrRequest, NevrResponse, User } from "../types.js"
import { getLogger } from "../logger.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// Type for middleware that can be used with app.use(path, middleware)
// Express IRouter.use() accepts this
export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>

export interface ExpressAdapterOptions {
  /** Get user from Express request */
  getUser?: (req: Request) => User | null | Promise<User | null>
  
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

async function expressToNevr(
  req: Request,
  getUser?: ExpressAdapterOptions["getUser"]
): Promise<NevrRequest> {
  // Get user
  const user = getUser ? await getUser(req) : null

  // Parse query string
  const query: Record<string, string | string[] | undefined> = {}
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string") {
      query[key] = value
    } else if (Array.isArray(value)) {
      query[key] = value.map(String)
    }
  }

  // Parse headers
  const headers: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers[key.toLowerCase()] = value
    }
  }

  return {
    method: req.method as NevrRequest["method"],
    path: req.path,
    params: req.params as Record<string, string>,
    query,
    body: req.body,
    // Include raw body if available (for webhook signature verification)
    rawBody: (req as any).rawBody,
    headers,
    user,
    context: {
      raw: { req, res: undefined }, // Store original Express request
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    },
  }
}

// -----------------------------------------------------------------------------
// Response Sender
// -----------------------------------------------------------------------------

function sendResponse(res: Response, response: NevrResponse): void {
  // Set headers
  if (response.headers) {
    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value)
    }
  }

  // Send response
  if (response.status === 204) {
    res.status(204).end()
  } else {
    res.status(response.status).json(response.body)
  }
}

// -----------------------------------------------------------------------------
// CORS Handler
// NOTE: This is a simple CORS handler for the adapter. For production apps,
// consider using the 'cors' npm package before the adapter for more control.
// When using external cors middleware, don't set the cors option here.
// -----------------------------------------------------------------------------

function getCorsHeaders(cors: string | string[] | boolean, origin?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  
  if (cors === true) {
    // Reflect the request origin (safe for credentials)
    headers["Access-Control-Allow-Origin"] = origin || "*"
  } else if (typeof cors === "string") {
    headers["Access-Control-Allow-Origin"] = cors
  } else if (Array.isArray(cors) && origin && cors.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
  }
  
  if (headers["Access-Control-Allow-Origin"]) {
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    // Only set credentials if not using wildcard origin
    if (headers["Access-Control-Allow-Origin"] !== "*") {
      headers["Access-Control-Allow-Credentials"] = "true"
    }
    headers["Access-Control-Max-Age"] = "86400"
  }
  
  return headers
}

// -----------------------------------------------------------------------------
// Express Adapter Factory
// -----------------------------------------------------------------------------

/**
 * Create an Express middleware handler for nevr
 *
 * @example
 * ```typescript
 * import express from "express"
 * import { nevr } from "nevr"
 * import { expressAdapter } from "nevr/adapters/express"
 *
 * const app = express()
 * app.use(express.json())
 *
 * app.use("/api", expressAdapter(api, {
 *   getUser: (req) => {
 *     const id = req.headers["x-user-id"]
 *     return id ? { id: String(id) } : null
 *   },
 *   cors: true,
 *   debugLogs: true,
 * }))
 * ```
 */
export function expressAdapter(
  nevr: NevrInstance,
  options: ExpressAdapterOptions = {}
): ExpressMiddleware {
  const { getUser, cors, debugLogs } = options

  // Return Express middleware
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Handle CORS preflight
      if (req.method === "OPTIONS" && cors) {
        const corsHeaders = getCorsHeaders(cors, req.headers.origin)
        for (const [key, value] of Object.entries(corsHeaders)) {
          res.setHeader(key, value)
        }
        res.status(204).end()
        return
      }

      // Set CORS headers
      if (cors) {
        const corsHeaders = getCorsHeaders(cors, req.headers.origin)
        for (const [key, value] of Object.entries(corsHeaders)) {
          res.setHeader(key, value)
        }
      }

      // Convert Express request to Nevr request
      const nevrRequest = await expressToNevr(req, getUser)

      if (debugLogs) {
        getLogger().debug(`[nevr:express] ${req.method} ${req.path}`)
      }

      // Handle request
      const response = await nevr.handleRequest(nevrRequest)

      // Send response
      sendResponse(res, response)
    } catch (error) {
      if (debugLogs) {
        getLogger().error("[nevr:express] Unhandled error:", error)
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      })
    }
  }
}

// -----------------------------------------------------------------------------
// Helper: Development Auth
// -----------------------------------------------------------------------------

/**
 * Simple header-based auth for development
 * Uses X-User-Id and X-User-Role headers
 */
export function devAuth(req: Request): User | null {
  const id = req.headers["x-user-id"]
  const role = req.headers["x-user-role"]

  if (typeof id === "string" && id) {
    return {
      id,
      role: typeof role === "string" ? role : "user",
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
): (req: Request) => Promise<User | null> {
  return async (req: Request): Promise<User | null> => {
    const auth = req.headers.authorization
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
// Helper: Session Auth (with Auth Plugin)
// -----------------------------------------------------------------------------

/**
 * Session-based auth that works with the Nevr auth plugin
 * Reads session token from cookies and validates against the database
 *
 * @example
 * ```typescript
 * import { expressAdapter, sessionAuth } from "nevr/adapters/express"
 * import { PrismaClient } from "@prisma/client"
 * import { prisma } from "nevr/drivers/prisma"
 *
 * const prismaClient = new PrismaClient()
 * const driver = prisma(prismaClient)
 *
 * app.use("/api", expressAdapter(api, {
 *   getUser: sessionAuth(driver),
 *   cors: true,
 * }))
 * ```
 */
export function sessionAuth(
  driver: any,
  options?: {
    /** Cookie name for session token (default: "nevr.session_token") */
    cookieName?: string
    /** Session expiry in seconds (default: 7 days) */
    sessionExpiresIn?: number
  }
): (req: Request) => Promise<User | null> {
  const cookieName = options?.cookieName || "nevr.session_token"
  const sessionExpiresIn = options?.sessionExpiresIn || 60 * 60 * 24 * 7

  return async (req: Request): Promise<User | null> => {
    // Try to get token from cookie
    const cookieHeader = req.headers.cookie
    let token: string | undefined

    if (cookieHeader) {
      // Parse cookies
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
      const auth = req.headers.authorization
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
      getLogger().error("[nevr:express] Session auth error:", error)
      return null
    }
  }
}

// Aliases for convenience
export { devAuth as expressDevAuth }
export { jwtAuth as expressJwtAuth }
export { sessionAuth as expressSessionAuth }

// -----------------------------------------------------------------------------
// Helper: JSON Middleware with Raw Body Preservation
// -----------------------------------------------------------------------------

/**
 * Creates an express.json() middleware that preserves the raw body
 * for webhook signature verification (Stripe, etc.)
 *
 * Use this instead of express.json() when using payment webhooks.
 *
 * @example
 * ```typescript
 * import express from "express"
 * import { expressAdapter, sessionAuth, nevrJson } from "nevr/adapters/express"
 *
 * const app = express()
 *
 * // Use nevrJson(express) instead of express.json()
 * app.use(nevrJson(express))
 *
 * app.use("/api", expressAdapter(api, {
 *   getUser: sessionAuth(driver),
 *   cors: true,
 * }))
 * ```
 */
export function nevrJson(
  expressModule: { json: (options?: any) => RequestHandler },
  options?: Parameters<typeof import("express").json>[0]
): RequestHandler {
  return expressModule.json({
    ...options,
    verify: (req: any, res: any, buf: Buffer) => {
      // Store raw body for webhook signature verification
      req.rawBody = buf.toString()
      // Call user's verify if provided
      if (options?.verify) {
        options.verify(req, res, buf, "utf-8")
      }
    },
  })
}

// Alias
export { nevrJson as expressJson }

export default expressAdapter
