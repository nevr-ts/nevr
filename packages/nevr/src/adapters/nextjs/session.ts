// =============================================================================
// NEXT.JS SESSION UTILITIES
// Session access in Next.js Server Components
// =============================================================================

import type { NevrInstance, User, Driver } from "../../types.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Database session record */
interface SessionRecord {
  id: string
  token: string
  userId: string
  expiresAt: string | Date
  updatedAt?: string | Date
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

export interface Session {
  /** The authenticated user */
  user: User
  /** Session expiration time */
  expiresAt: Date
  /** Session token (for reference) */
  token: string
}

export interface GetSessionOptions {
  /** Cookie name for session token */
  cookieName?: string
}

export interface RequireSessionOptions extends GetSessionOptions {
  /** Path to redirect to if not authenticated */
  redirectTo?: string
}

// -----------------------------------------------------------------------------
// Session Utilities
// -----------------------------------------------------------------------------

/**
 * Get the current session in a Next.js Server Component
 *
 * Reads the session cookie and validates it against the database.
 *
 * @example
 * ```typescript
 * // app/dashboard/page.tsx (Server Component)
 * import { getServerSession } from "nevr/adapters/nextjs"
 * import { api } from "@/lib/nevr"
 *
 * export default async function Dashboard() {
 *   const session = await getServerSession(api)
 *
 *   if (!session) {
 *     redirect("/login")
 *   }
 *
 *   return <div>Welcome, {session.user.name}!</div>
 * }
 * ```
 */
export async function getServerSession(
  api: NevrInstance,
  options: GetSessionOptions = {}
): Promise<Session | null> {
  const cookieName = options.cookieName || "nevr.session_token"

  try {
    // Dynamic import to avoid bundling issues
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get(cookieName)

    if (!tokenCookie?.value) {
      return null
    }

    const token = tokenCookie.value

    // Get driver from Nevr instance
    const driver = api.getDriver() as Driver

    // Find session in database
    const session = await driver.findOne("session", { token }) as SessionRecord | null
    if (!session) {
      return null
    }

    // Check expiry
    const expiresAt = new Date(session.expiresAt)
    if (expiresAt < new Date()) {
      return null
    }

    // Get user
    const user = await driver.findOne("user", { id: session.userId }) as UserRecord | null
    if (!user) {
      return null
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
        image: user.image,
        emailVerified: user.emailVerified,
      },
      expiresAt,
      token,
    }
  } catch (error) {
    // Not in Next.js context or cookies() called outside request scope
    if (error instanceof Error) {
      if (
        error.message.includes("cookies was called outside") ||
        error.message.includes("was called outside a request scope") ||
        error.message.includes("Cannot find module")
      ) {
        return null
      }
    }
    // Log unexpected errors but don't throw to avoid breaking the page
    console.error("[nevr:next-session] Error getting session:", error)
    return null
  }
}

/**
 * Require authentication in a Server Component
 * Redirects to login if not authenticated
 *
 * @example
 * ```typescript
 * // app/dashboard/page.tsx
 * import { requireSession } from "nevr/adapters/nextjs"
 * import { api } from "@/lib/nevr"
 *
 * export default async function Dashboard() {
 *   const session = await requireSession(api)
 *   // If we get here, session is guaranteed to exist
 *
 *   return <div>Welcome, {session.user.name}!</div>
 * }
 * ```
 */
export async function requireSession(
  api: NevrInstance,
  options: RequireSessionOptions = {}
): Promise<Session> {
  const session = await getServerSession(api, options)

  if (!session) {
    // Dynamic import to avoid bundling issues
    const { redirect } = await import("next/navigation")
    redirect(options.redirectTo || "/login")
    // redirect() never returns, but TypeScript needs this for type narrowing
    throw new Error("Redirect failed")
  }

  return session
}

/**
 * Get session from request headers (for API routes)
 *
 * @example
 * ```typescript
 * // app/api/protected/route.ts
 * import { getSessionFromRequest } from "nevr/adapters/nextjs"
 * import { api } from "@/lib/nevr"
 *
 * export async function GET(request: Request) {
 *   const session = await getSessionFromRequest(api, request)
 *   if (!session) {
 *     return Response.json({ error: "Unauthorized" }, { status: 401 })
 *   }
 *   return Response.json({ user: session.user })
 * }
 * ```
 */
export async function getSessionFromRequest(
  api: NevrInstance,
  request: Request,
  options: GetSessionOptions = {}
): Promise<Session | null> {
  const cookieName = options.cookieName || "nevr.session_token"

  // Try to get token from cookie header
  const cookieHeader = request.headers.get("cookie")
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
    const auth = request.headers.get("authorization")
    if (auth?.startsWith("Bearer ")) {
      token = auth.slice(7)
    }
  }

  if (!token) {
    return null
  }

  try {
    // Get driver from Nevr instance
    const driver = api.getDriver() as Driver

    // Find session in database
    const session = await driver.findOne("session", { token }) as SessionRecord | null
    if (!session) {
      return null
    }

    // Check expiry
    const expiresAt = new Date(session.expiresAt)
    if (expiresAt < new Date()) {
      return null
    }

    // Get user
    const user = await driver.findOne("user", { id: session.userId }) as UserRecord | null
    if (!user) {
      return null
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
        image: user.image,
        emailVerified: user.emailVerified,
      },
      expiresAt,
      token,
    }
  } catch (error) {
    console.error("[nevr:next-session] Error getting session from request:", error)
    return null
  }
}

/**
 * Create a getUser function for toNextHandler that uses session auth
 *
 * @example
 * ```typescript
 * // app/api/[...nevr]/route.ts
 * import { toNextHandler, sessionAuth } from "nevr/adapters/nextjs"
 * import { api } from "@/lib/nevr"
 *
 * export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api, {
 *   getUser: sessionAuth(api),
 * })
 * ```
 */
export function sessionAuth(
  api: NevrInstance,
  options: GetSessionOptions = {}
): (request: Request) => Promise<User | null> {
  return async (request: Request): Promise<User | null> => {
    const session = await getSessionFromRequest(api, request, options)
    return session?.user || null
  }
}
