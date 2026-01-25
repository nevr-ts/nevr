// =============================================================================
// NEXT.JS PAGES ROUTER SUPPORT
// Legacy support for Next.js Pages Router API routes
// =============================================================================

import type { NevrInstance, NevrRequest, NevrResponse, User } from "../../types.js"

/** Database session record */
interface SessionRecord {
  id: string
  token: string
  userId: string
  expiresAt: string | Date
}

/** Database user record */
interface UserRecord {
  id: string
  email?: string
  name?: string
  role?: string
  image?: string
  emailVerified?: boolean | Date
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Next.js Pages Router API request
 */
export interface NextApiRequest {
  method?: string
  url?: string
  query: Record<string, string | string[] | undefined>
  body?: unknown
  headers: Record<string, string | string[] | undefined>
  cookies: Record<string, string>
}

/**
 * Next.js Pages Router API response
 */
export interface NextApiResponse {
  status(code: number): NextApiResponse
  json(body: unknown): void
  setHeader(name: string, value: string): NextApiResponse
  end(): void
}

export interface ApiHandlerOptions {
  /** Get user from request */
  getUser?: (req: NextApiRequest) => User | null | Promise<User | null>

  /** Enable debug logs */
  debugLogs?: boolean

  /** Base path to strip from URL (default: "/api") */
  basePath?: string

  /** Enable CORS */
  cors?: boolean | string | string[]
}

// -----------------------------------------------------------------------------
// Request Converter
// -----------------------------------------------------------------------------

/**
 * Convert Next.js Pages API request to NevrRequest
 */
async function pagesRequestToNevr(
  req: NextApiRequest,
  options: ApiHandlerOptions
): Promise<NevrRequest> {
  const { getUser, basePath = "/api" } = options

  // Parse query
  const query: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(req.query)) {
    if (value !== undefined) {
      query[key] = value
    }
  }

  // Parse headers
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers[key.toLowerCase()] = value
    } else if (Array.isArray(value)) {
      headers[key.toLowerCase()] = value[0]
    }
  }

  // Get user
  const user = getUser ? await getUser(req) : null

  // Extract path
  let path = req.url || "/"
  const queryIndex = path.indexOf("?")
  if (queryIndex !== -1) {
    path = path.slice(0, queryIndex)
  }
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length) || "/"
  }

  return {
    method: (req.method || "GET") as NevrRequest["method"],
    path,
    params: {},
    query,
    body: req.body,
    headers,
    user,
    context: {
      raw: { req },
      ip: headers["x-forwarded-for"]?.split(",")[0]?.trim() || headers["x-real-ip"],
      userAgent: headers["user-agent"],
    },
  }
}

// -----------------------------------------------------------------------------
// Response Sender
// -----------------------------------------------------------------------------

/**
 * Send NevrResponse using Next.js Pages API response
 */
function sendResponse(res: NextApiResponse, response: NevrResponse): void {
  // Set headers
  if (response.headers) {
    for (const [key, value] of Object.entries(response.headers)) {
      if (value) {
        res.setHeader(key, value)
      }
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

function setCorsHeaders(
  res: NextApiResponse,
  origin: string | undefined,
  corsOption: boolean | string | string[]
): void {
  let allowOrigin = "*"

  if (corsOption === true) {
    allowOrigin = origin || "*"
  } else if (typeof corsOption === "string") {
    allowOrigin = corsOption
  } else if (Array.isArray(corsOption) && origin && corsOption.includes(origin)) {
    allowOrigin = origin
  }

  res.setHeader("Access-Control-Allow-Origin", allowOrigin)
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
  if (allowOrigin !== "*") {
    res.setHeader("Access-Control-Allow-Credentials", "true")
  }
  res.setHeader("Access-Control-Max-Age", "86400")
}

// -----------------------------------------------------------------------------
// API Handler Factory
// -----------------------------------------------------------------------------

/**
 * Create a Next.js Pages Router API handler for Nevr
 *
 * @example
 * ```typescript
 * // pages/api/[...nevr].ts
 * import { toApiHandler } from "nevr/adapters/nextjs"
 * import { api } from "@/lib/nevr"
 *
 * export default toApiHandler(api, {
 *   cors: true,
 *   debugLogs: process.env.NODE_ENV !== "production",
 * })
 * ```
 */
export function toApiHandler(
  nevr: NevrInstance,
  options: ApiHandlerOptions = {}
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  const { debugLogs, cors } = options

  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Handle CORS preflight
      if (req.method === "OPTIONS" && cors) {
        setCorsHeaders(res, req.headers.origin as string | undefined, cors)
        res.status(204).end()
        return
      }

      // Set CORS headers
      if (cors) {
        setCorsHeaders(res, req.headers.origin as string | undefined, cors)
      }

      // Convert request
      const nevrRequest = await pagesRequestToNevr(req, options)

      if (debugLogs) {
        console.log(`[nevr:pages] ${req.method} ${nevrRequest.path}`)
      }

      // Handle request
      const response = await nevr.handleRequest(nevrRequest)

      // Send response
      sendResponse(res, response)
    } catch (error) {
      if (debugLogs) {
        console.error("[nevr:pages] Unhandled error:", error)
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

/**
 * Create a getUser function for toApiHandler that uses session auth
 *
 * @example
 * ```typescript
 * // pages/api/[...nevr].ts
 * import { toApiHandler, pagesSessionAuth } from "nevr/adapters/nextjs"
 * import { api } from "@/lib/nevr"
 *
 * export default toApiHandler(api, {
 *   getUser: pagesSessionAuth(api),
 * })
 * ```
 */
export function pagesSessionAuth(
  api: NevrInstance,
  options: { cookieName?: string } = {}
): (req: NextApiRequest) => Promise<User | null> {
  const cookieName = options.cookieName || "nevr.session_token"

  return async (req: NextApiRequest): Promise<User | null> => {
    // Get token from cookie
    let token = req.cookies[cookieName]

    // Also try Authorization header
    if (!token) {
      const auth = req.headers.authorization
      if (typeof auth === "string" && auth.startsWith("Bearer ")) {
        token = auth.slice(7)
      }
    }

    if (!token) {
      return null
    }

    try {
      const driver = api.getDriver()

      // Find session
      const session = await driver.findOne("session", { token }) as SessionRecord | null
      if (!session) return null

      // Check expiry
      if (new Date(session.expiresAt) < new Date()) return null

      // Get user
      const user = await driver.findOne("user", { id: session.userId }) as UserRecord | null
      if (!user) return null

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
        image: user.image,
        emailVerified: user.emailVerified,
      }
    } catch (error) {
      console.error("[nevr:pages] Session auth error:", error)
      return null
    }
  }
}

export default toApiHandler
