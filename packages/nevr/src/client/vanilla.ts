// =============================================================================
// VANILLA CLIENT
// Framework-agnostic NEVR client
// =============================================================================

import { atom, type Atom } from "nanostores"
import type {
  NevrClientOptions,
  NevrClientPlugin,
  InferClientAPI,
  InferActions,
  InferAtoms,
  InferErrorCodes,
  SessionState,
  ClientAtomListener,
  NevrFetchError,
  PrettifyDeep,
  UnionToIntersection,
} from "./types.js"
import { createNevrFetch } from "./fetch.js"
import { createClientStore } from "./store.js"
import { createDynamicProxy } from "./proxy.js"
import { capitalize } from "../utils/index.js"

/**
 * Configure client from options
 */
function getClientConfig(options?: NevrClientOptions) {
  const baseURL = options?.baseURL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")
  const basePath = options?.basePath || "/api"

  // Create fetch function with middleware support
  const $fetch = createNevrFetch({
    baseURL,
    basePath,
    defaultOptions: options?.fetchOptions,
    plugins: [],
    middleware: options?.middleware,
    interceptors: options?.interceptors,
  })

  // Create store
  const $store = createClientStore()

  // Collect plugin data
  const pluginPathMethods: Record<string, "POST" | "GET"> = {}
  const pluginsActions: Record<string, any> = {}
  const pluginsAtoms: Record<string, Atom<any>> = {}
  const atomListeners: ClientAtomListener[] = []

  // Process plugins
  for (const plugin of options?.plugins || []) {
    // Collect path methods
    if (plugin.pathMethods) {
      Object.assign(pluginPathMethods, plugin.pathMethods)
    }

    // Collect actions
    if (plugin.getActions) {
      const actions = plugin.getActions($fetch, $store, options)
      Object.assign(pluginsActions, actions)
    }

    // Collect atoms
    if (plugin.getAtoms) {
      const atoms = plugin.getAtoms($fetch)
      Object.assign(pluginsAtoms, atoms)
      Object.assign($store.atoms, atoms)
    }

    // Collect atom listeners
    if (plugin.atomListeners) {
      atomListeners.push(...plugin.atomListeners)
    }

    // Auto-wire endpoints from unified plugins
    // Endpoints are a typed object with EndpointDefinition values
    const unifiedPlugin = plugin as any
    if (unifiedPlugin.meta?.id && unifiedPlugin.endpoints) {
      const pluginId = unifiedPlugin.meta.id
      const pluginBasePath = unifiedPlugin.meta.basePath || `/${pluginId}`
      const endpoints = unifiedPlugin.endpoints as Record<string, any>

      // Create methods for this plugin namespace
      const methods: Record<string, Function> = {}

      for (const [endpointName, endpointDef] of Object.entries(endpoints)) {
        if (!endpointDef?.path || !endpointDef?.method) continue

        const fullPath = pluginBasePath + endpointDef.path
        const method = endpointDef.method

        // Register path method for proxy
        pluginPathMethods[fullPath] = method as "POST" | "GET"

        // Create the method
        methods[endpointName] = async (input?: any) => {
          return $fetch(fullPath, {
            method,
            body: method === "GET" ? undefined : input,
            query: method === "GET" ? input : undefined,
          })
        }
      }

      // Add to pluginsActions under plugin namespace
      pluginsActions[pluginId] = methods
    }
  }

  return {
    baseURL,
    basePath,
    $fetch,
    $store,
    pluginPathMethods,
    pluginsActions,
    pluginsAtoms,
    atomListeners,
  }
}

/**
 * Infer resolved hooks (atoms as use* hooks)
 */
type InferResolvedHooks<O extends NevrClientOptions> = O extends {
  plugins: Array<infer Plugin>
}
  ? UnionToIntersection<
    Plugin extends NevrClientPlugin
    ? Plugin["getAtoms"] extends (fetch: any) => infer Atoms
    ? Atoms extends Record<string, any>
    ? {
      [K in keyof Atoms as K extends `$${string}`
      ? never
      : K extends string
      ? `use${Capitalize<K>}`
      : never]: Atoms[K]
    }
    : {}
    : {}
    : {}
  >
  : {}

/**
 * Create a NEVR client
 *
 * @example
 * ```ts
 * import { createClient } from "nevr/client"
 * import { authClient } from "nevr/plugins/auth/client"
 *
 * const client = createClient({
 *   baseURL: "http://localhost:3000",
 *   plugins: [authClient()]
 * })
 *
 * // Type-safe API calls
 * const { data, error } = await client.auth.signIn({
 *   email: "user@example.com",
 *   password: "password"
 * })
 *
 * // Reactive session state
 * client.useSession.subscribe(({ data, isPending }) => {
 *   console.log("Session:", data)
 * })
 * ```
 */
export function createClient<Options extends NevrClientOptions>(
  options?: Options
) {
  const {
    pluginPathMethods,
    pluginsActions,
    pluginsAtoms,
    $fetch,
    atomListeners,
    $store,
  } = getClientConfig(options)

  // Convert atoms to use* hooks
  const resolvedHooks: Record<string, any> = {}
  for (const [key, value] of Object.entries(pluginsAtoms)) {
    // Skip signal atoms (start with $)
    if (key.startsWith("$")) continue
    resolvedHooks[`use${capitalize(key)}`] = value
  }

  // Build routes object
  const routes = {
    ...pluginsActions,
    ...resolvedHooks,
    $fetch,
    $store,
  }

  // Create proxy
  const proxy = createDynamicProxy(
    routes,
    $fetch,
    pluginPathMethods,
    pluginsAtoms,
    atomListeners
  )

  // Infer session type
  type ClientAPI = InferClientAPI<Options>
  type Session = ClientAPI extends {
    getSession: () => Promise<{ data: infer S }>
  }
    ? S
    : any

  // Return typed client
  return proxy as UnionToIntersection<InferResolvedHooks<Options>> &
    ClientAPI &
    InferActions<Options> & {
      /**
       * Reactive session state
       */
      useSession: Atom<SessionState<Session>>

      /**
       * Raw fetch function for custom requests
       */
      $fetch: typeof $fetch

      /**
       * Client store for reactive state
       */
      $store: typeof $store

      /**
       * Type inference helpers
       */
      $Infer: {
        Session: NonNullable<Session>
      }

      /**
       * Error codes from all plugins
       */
      $ERROR_CODES: PrettifyDeep<InferErrorCodes<Options>>
    }
}

export type NevrClient<Options extends NevrClientOptions> = ReturnType<
  typeof createClient<Options>
>

// Server-Inferred Client Creation
// Creates a typed client from server API type
// -----------------------------------------------------------------------------

import type { InferEntitiesFromServer } from "./entity.js"
import type { AuthClientMethods } from "../plugins/auth/client.js"

/**
 * Create a typed client from server API type
 * 
 * This is the recommended pattern for full E2E type safety.
 * Uses the same flexible plugins array as createClient, but adds
 * type inference from your server API type.
 * 
 * @example
 * ```ts
 * // Server (api.ts)
 * export const api = nevr({
 *   entities: [user, product],
 *   plugins: [auth()],
 * })
 * export type API = typeof api
 * 
 * // Client (client.ts)
 * import { createTypedClient, entityClient } from "nevr/client"
 * import { authClient } from "nevr/plugins/auth/client"
 * import type { API } from "../server/api"
 * 
 * export const client = createTypedClient<API>({
 *   baseURL: "http://localhost:3000",
 *   plugins: [
 *     entityClient({ entities: ["user", "product"] }),
 *     authClient(),
 *   ],
 * })
 * 
 * // Fully typed!
 * await client.users.list()          // Entity types from API
 * await client.auth.signIn.email()   // Auth methods included by default
 * ```
 * 
 * @example
 * ```ts
 * // Custom plugin types (for non-auth plugins)
 * import type { StripeClientMethods } from "nevr/plugins/stripe/client"
 * 
 * const client = createTypedClient<API, { stripe: StripeClientMethods }>({
 *   plugins: [entityClient({ entities: ["user"] }), stripeClient()],
 * })
 * 
 * await client.stripe.createCheckout()  // Custom plugin typed!
 * ```
 */
export function createTypedClient<
  TApi extends { $Infer: { Entities: Record<string, unknown>; CreateInputs?: Record<string, unknown> } },
  TPlugins extends Record<string, unknown> = { auth: AuthClientMethods }
>(
  options: NevrClientOptions
): InferEntitiesFromServer<
  TApi["$Infer"]["Entities"],
  TApi["$Infer"]["CreateInputs"] extends Record<string, unknown>
  ? TApi["$Infer"]["CreateInputs"]
  : { [K in keyof TApi["$Infer"]["Entities"]]: Omit<TApi["$Infer"]["Entities"][K], "id" | "createdAt" | "updatedAt"> }
> & TPlugins & {
  useSession: import("nanostores").Atom<import("./types.js").SessionState<any>>
  $fetch: import("./types.js").NevrFetch
  $store: import("./types.js").ClientStore
  $Infer: { Session: any }
} {
  return createClient(options) as any
}

