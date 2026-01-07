// =============================================================================
// CLIENT PROXY
// Dynamic proxy for converting method calls to API requests
// =============================================================================

import type { Atom } from "nanostores"
import type { NevrFetch, NevrFetchOptions, ClientAtomListener } from "./types.js"

/**
 * Determine HTTP method from path and arguments
 */
function getMethod(
  path: string,
  knownPathMethods: Record<string, "POST" | "GET">,
  args?: { fetchOptions?: NevrFetchOptions; query?: Record<string, any> }
): "GET" | "POST" {
  // Check known path methods first
  const method = knownPathMethods[path]
  if (method) return method

  // Check if method specified in options
  if (args?.fetchOptions?.method) {
    return args.fetchOptions.method as "GET" | "POST"
  }

  // If there's a body with data, use POST
  const { fetchOptions: _, query: __, ...body } = args || {}
  if (body && Object.keys(body).length > 0) {
    return "POST"
  }

  return "GET"
}

/**
 * Convert camelCase to kebab-case
 */
function toKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/**
 * Check if value is a nanostore atom
 */
function isAtom(value: any): value is Atom<any> {
  return value && typeof value === "object" && "get" in value && "subscribe" in value
}

/**
 * Create a dynamic proxy that converts method calls to API requests
 */
export function createDynamicProxy<T extends Record<string, any>>(
  routes: T,
  client: NevrFetch,
  knownPathMethods: Record<string, "POST" | "GET">,
  atoms: Record<string, Atom<any>>,
  atomListeners?: ClientAtomListener[]
): T {
  function createProxy(pathSegments: string[] = []): any {
    return new Proxy(function () {}, {
      get(_, prop) {
        if (typeof prop !== "string") return undefined

        // Ignore Promise-like methods
        if (prop === "then" || prop === "catch" || prop === "finally") {
          return undefined
        }

        const fullPath = [...pathSegments, prop]

        // Try to find existing property in routes
        let current: any = routes
        for (const segment of fullPath) {
          if (current && typeof current === "object" && segment in current) {
            current = current[segment]
          } else {
            current = undefined
            break
          }
        }

        // If it's a function, return it
        if (typeof current === "function") {
          return current
        }

        // If it's an atom, return it
        if (isAtom(current)) {
          return current
        }

        // Otherwise, continue building the path
        return createProxy(fullPath)
      },

      apply: async (_, __, args) => {
        // Build the route path from segments
        const routePath = "/" + pathSegments.map(toKebabCase).join("/")

        // Parse arguments
        const arg = (args[0] || {}) as Record<string, any>
        const fetchOptions = (args[1] || {}) as NevrFetchOptions

        // Extract query and fetchOptions from arg
        const { query, fetchOptions: argFetchOptions, ...body } = arg

        // Merge options
        const options: NevrFetchOptions = {
          ...fetchOptions,
          ...argFetchOptions,
        }

        // Determine method
        const method = getMethod(routePath, knownPathMethods, arg)

        // Make the request
        const response = await client(routePath, {
          ...options,
          body: method === "GET" ? undefined : { ...body, ...options.body },
          query: query || options.query,
          method,
          onSuccess: async (context) => {
            await options.onSuccess?.(context)

            // Trigger atom listeners on success
            if (!atomListeners || options.disableSignal) return

            const matches = atomListeners.filter((s) => s.matcher(routePath))
            if (!matches.length) return

            for (const match of matches) {
              const signal = atoms[match.signal]
              if (!signal) continue

              // Toggle signal to trigger reactivity
              const val = signal.get()
              setTimeout(() => {
                if ("set" in signal && typeof signal.set === "function") {
                  ;(signal as any).set(!val)
                }
              }, 10)
            }
          },
        })

        return response
      },
    })
  }

  return createProxy() as T
}
