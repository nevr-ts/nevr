// =============================================================================
// NEXT.JS ROUTE HANDLER
// Converts Nevr instance to Next.js App Router route handlers
// =============================================================================

import type { NevrInstance, NevrRequest, NevrResponse, User } from "../../types.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface NextHandlerOptions {
  /** Get user from request */
  getUser?: (request: Request) => User | null | Promise<User | null>

  /** Enable debug logs */
  debugLogs?: boolean

  /** Base path to strip from URL (default: "/api") */
  basePath?: string

  /** Trust proxy headers for IP detection */
  trustProxy?: boolean
}

export type NextRouteHandler = (request: Request) => Promise<Response>

export interface NextRouteHandlers {
  GET: NextRouteHandler
  POST: NextRouteHandler
  PUT: NextRouteHandler
  PATCH: NextRouteHandler
  DELETE: NextRouteHandler
  OPTIONS: NextRouteHandler
}

// -----------------------------------------------------------------------------
// Request Converter
// -----------------------------------------------------------------------------

/**
 * Convert Web Request to NevrRequest
 */
async function webRequestToNevr(
  request: Request,
  options: NextHandlerOptions
): Promise<NevrRequest> {
  const { getUser, basePath = "/api", trustProxy = true } = options
  const url = new URL(request.url)

  // Parse query params
  const query: Record<string, string | string[]> = {}
  url.searchParams.forEach((value, key) => {
    const existing = query[key]
    if (existing) {
      query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
    } else {
      query[key] = value
    }
  })

  // Parse headers
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })

  // Parse body for non-GET requests
  let body: unknown
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      const text = await request.text()
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

  // Get user
  const user = getUser ? await getUser(request) : null

  // Extract path after basePath
  let path = url.pathname
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length) || "/"
  }

  // Extract dynamic route params from path
  // Next.js [...nevr] catch-all provides the full path, params are in the path itself
  const params: Record<string, string> = {}

  // Get IP address
  let ip: string | undefined
  if (trustProxy) {
    ip = headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
         headers["x-real-ip"] ||
         undefined
  }

  return {
    method: request.method as NevrRequest["method"],
    path,
    params,
    query,
    body,
    headers,
    user,
    context: {
      raw: { request },
      ip,
      userAgent: headers["user-agent"],
    },
  }
}

// -----------------------------------------------------------------------------
// Response Converter
// -----------------------------------------------------------------------------

/**
 * Convert NevrResponse to Web Response
 */
function nevrResponseToWeb(response: NevrResponse): Response {
  const headers = new Headers()

  // Set custom headers
  if (response.headers) {
    for (const [key, value] of Object.entries(response.headers)) {
      if (value) {
        headers.set(key, value)
      }
    }
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return new Response(null, { status: 204, headers })
  }

  // JSON response
  headers.set("Content-Type", "application/json")
  return new Response(JSON.stringify(response.body), {
    status: response.status,
    headers,
  })
}

// -----------------------------------------------------------------------------
// CORS Handler
// -----------------------------------------------------------------------------

function createCorsResponse(request: Request): Response {
  const origin = request.headers.get("origin") || "*"

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  })
}

// -----------------------------------------------------------------------------
// Main Handler Factory
// -----------------------------------------------------------------------------

/**
 * Create Next.js App Router route handlers for Nevr
 *
 * @example
 * ```typescript
 * // app/api/[...nevr]/route.ts
 * import { toNextHandler } from "nevr/adapters/nextjs"
 * import { api } from "@/lib/nevr"
 *
 * export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api, {
 *   debugLogs: process.env.NODE_ENV !== "production",
 * })
 * ```
 */
export function toNextHandler(
  nevr: NevrInstance,
  options: NextHandlerOptions = {}
): NextRouteHandlers {
  const { debugLogs } = options

  const handler = async (request: Request): Promise<Response> => {
    try {
      // Convert Web Request to NevrRequest
      const nevrRequest = await webRequestToNevr(request, options)

      if (debugLogs) {
        console.log(`[nevr:next] ${request.method} ${nevrRequest.path}`)
      }

      // Handle request
      const response = await nevr.handleRequest(nevrRequest)

      // Convert NevrResponse to Web Response
      return nevrResponseToWeb(response)
    } catch (error) {
      if (debugLogs) {
        console.error("[nevr:next] Unhandled error:", error)
      }

      return Response.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
          },
        },
        { status: 500 }
      )
    }
  }

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
    OPTIONS: (request: Request) => Promise.resolve(createCorsResponse(request)),
  }
}

/**
 * Create a single Next.js route handler
 * Useful when you need more control over individual methods
 *
 * @example
 * ```typescript
 * // app/api/custom/route.ts
 * import { createNextHandler } from "nevr/adapters/nextjs"
 * import { api } from "@/lib/nevr"
 *
 * const handler = createNextHandler(api)
 *
 * export const GET = handler
 * export const POST = handler
 * ```
 */
export function createNextHandler(
  nevr: NevrInstance,
  options: NextHandlerOptions = {}
): NextRouteHandler {
  const handlers = toNextHandler(nevr, options)
  return handlers.GET // All methods use the same handler
}

export default toNextHandler
