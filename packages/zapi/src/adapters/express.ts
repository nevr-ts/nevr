// =============================================================================
// EXPRESS ADAPTER
// Express adapter for nevr - uses Adapter Factory pattern
// =============================================================================

import type { Request, Response, Router, RequestHandler, NextFunction } from "express"
import type { ZapiInstance, ZapiRequest, ZapiResponse, User } from "../types.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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

async function expressToZapi(
  req: Request,
  getUser?: ExpressAdapterOptions["getUser"]
): Promise<ZapiRequest> {
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
    method: req.method as ZapiRequest["method"],
    path: req.path,
    params: req.params as Record<string, string>,
    query,
    body: req.body,
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

function sendResponse(res: Response, response: ZapiResponse): void {
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
// -----------------------------------------------------------------------------

function getCorsHeaders(cors: string | string[] | boolean, origin?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  
  if (cors === true) {
    headers["Access-Control-Allow-Origin"] = origin || "*"
  } else if (typeof cors === "string") {
    headers["Access-Control-Allow-Origin"] = cors
  } else if (Array.isArray(cors) && origin && cors.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
  }
  
  if (headers["Access-Control-Allow-Origin"]) {
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    headers["Access-Control-Allow-Credentials"] = "true"
    headers["Access-Control-Max-Age"] = "86400"
  }
  
  return headers
}

// -----------------------------------------------------------------------------
// Express Adapter Factory
// -----------------------------------------------------------------------------

/**
 * Create an Express middleware handler for zapi
 *
 * @example
 * ```typescript
 * import express from "express"
 * import { zapi } from "@zapi-x/core"
 * import { expressAdapter } from "@zapi-x/adapter-express"
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
  zapi: ZapiInstance,
  options: ExpressAdapterOptions = {}
): RequestHandler {
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

      // Convert Express request to Zapi request
      const zapiRequest = await expressToZapi(req, getUser)

      if (debugLogs) {
        console.log(`[zapi:express] ${req.method} ${req.path}`)
      }

      // Handle request
      const response = await zapi.handleRequest(zapiRequest)

      // Send response
      sendResponse(res, response)
    } catch (error) {
      if (debugLogs) {
        console.error("[zapi:express] Unhandled error:", error)
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

export default expressAdapter
