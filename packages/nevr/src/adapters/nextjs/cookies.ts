// =============================================================================
// NEXT.JS COOKIES PLUGIN
// Handles cookie setting in Next.js Server Components
// =============================================================================

import type { Plugin, NevrRequest, NevrResponse, NevrInstance } from "../../types.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ParsedCookie {
  name: string
  value: string
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "lax" | "strict" | "none"
}

// -----------------------------------------------------------------------------
// Cookie Parser
// -----------------------------------------------------------------------------

/**
 * Parse Set-Cookie header string into structured cookie objects
 */
function parseSetCookieHeader(header: string): ParsedCookie[] {
  const cookies: ParsedCookie[] = []

  // Set-Cookie headers can be comma-separated for multiple cookies
  // But commas can also appear in Expires dates, so we need careful parsing
  const cookieStrings = splitSetCookieHeader(header)

  for (const cookieStr of cookieStrings) {
    const parts = cookieStr.split(";").map(p => p.trim())
    if (parts.length === 0) continue

    // First part is name=value
    const [nameValue, ...attributes] = parts
    const eqIndex = nameValue.indexOf("=")
    if (eqIndex === -1) continue

    const name = nameValue.slice(0, eqIndex).trim()
    const value = nameValue.slice(eqIndex + 1).trim()

    if (!name) continue

    const cookie: ParsedCookie = { name, value }

    // Parse attributes
    for (const attr of attributes) {
      const attrLower = attr.toLowerCase()

      if (attrLower === "httponly") {
        cookie.httpOnly = true
      } else if (attrLower === "secure") {
        cookie.secure = true
      } else if (attrLower.startsWith("path=")) {
        cookie.path = attr.slice(5)
      } else if (attrLower.startsWith("domain=")) {
        cookie.domain = attr.slice(7)
      } else if (attrLower.startsWith("max-age=")) {
        cookie.maxAge = parseInt(attr.slice(8), 10)
      } else if (attrLower.startsWith("expires=")) {
        cookie.expires = new Date(attr.slice(8))
      } else if (attrLower.startsWith("samesite=")) {
        const sameSite = attr.slice(9).toLowerCase()
        if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
          cookie.sameSite = sameSite
        }
      }
    }

    cookies.push(cookie)
  }

  return cookies
}

/**
 * Split Set-Cookie header into individual cookie strings
 * Handles the complexity of commas in Expires dates
 */
function splitSetCookieHeader(header: string): string[] {
  const cookies: string[] = []
  let current = ""
  let depth = 0

  for (let i = 0; i < header.length; i++) {
    const char = header[i]

    if (char === "," && depth === 0) {
      // Check if this comma is part of a date (e.g., "Mon, 01 Jan 2024")
      // Dates have specific patterns - look ahead for day names or month names
      const ahead = header.slice(i + 1, i + 10).trim().toLowerCase()
      const isDate = /^\d{2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(ahead)

      if (isDate) {
        current += char
      } else {
        if (current.trim()) {
          cookies.push(current.trim())
        }
        current = ""
      }
    } else {
      current += char
    }
  }

  if (current.trim()) {
    cookies.push(current.trim())
  }

  return cookies
}

// -----------------------------------------------------------------------------
// Next.js Cookies Plugin
// -----------------------------------------------------------------------------

export interface NextCookiesOptions {
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

/**
 * Plugin to properly handle cookies in Next.js Server Components
 *
 * Next.js Server Components can't read Set-Cookie headers from responses directly.
 * This plugin intercepts cookies and sets them using the next/headers API.
 *
 * @example
 * ```typescript
 * // lib/nevr.ts
 * import { nevr } from "nevr"
 * import { nextCookies } from "nevr/adapters/nextjs"
 *
 * export const api = nevr({
 *   entities: [...],
 *   driver: prisma(db),
 *   plugins: [
 *     auth({ ... }),
 *     nextCookies(), // Required for cookie handling in Server Components
 *   ],
 * })
 * ```
 */
export function nextCookies(options: NextCookiesOptions = {}): Plugin {
  const { debug = false } = options

  return {
    name: "next-cookies",
    description: "Handles cookie setting in Next.js Server Components",

    hooks: {
      onResponse: async (req: NevrRequest, res: NevrResponse, _nevr: NevrInstance) => {
        const setCookie = res?.headers?.["set-cookie"]
        if (!setCookie) return

        try {
          // Dynamic import to avoid bundling issues in non-Next.js environments
          const { cookies } = await import("next/headers")
          const cookieStore = await cookies()

          // Parse Set-Cookie header
          const parsedCookies = parseSetCookieHeader(setCookie)

          if (debug) {
            console.log(`[nevr:next-cookies] Setting ${parsedCookies.length} cookies`)
          }

          for (const cookie of parsedCookies) {
            try {
              cookieStore.set(cookie.name, decodeURIComponent(cookie.value), {
                httpOnly: cookie.httpOnly,
                secure: cookie.secure,
                sameSite: cookie.sameSite,
                maxAge: cookie.maxAge,
                path: cookie.path || "/",
                domain: cookie.domain,
              })

              if (debug) {
                console.log(`[nevr:next-cookies] Set cookie: ${cookie.name}`)
              }
            } catch (err) {
              // This will fail silently in Server Components that are rendered
              // before the response is sent (expected behavior)
              if (debug) {
                console.log(`[nevr:next-cookies] Could not set cookie ${cookie.name} (expected in some contexts)`)
              }
            }
          }
        } catch (error) {
          // Not in Next.js context or cookies() called outside request scope
          if (error instanceof Error) {
            if (
              error.message.includes("cookies was called outside") ||
              error.message.includes("was called outside a request scope") ||
              error.message.includes("Cannot find module")
            ) {
              // Expected in non-Next.js environments or certain contexts
              if (debug) {
                console.log("[nevr:next-cookies] Not in Next.js request context, skipping")
              }
              return
            }
          }
          // Re-throw unexpected errors
          throw error
        }
      },
    },
  }
}

export default nextCookies
