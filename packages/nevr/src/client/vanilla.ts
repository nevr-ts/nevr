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
  Prettify,
  NevrFetch,
  DeepMergeUnion,
} from "./types.js"
import { type InferEntitiesFromServer, createEntityMethods } from "./entity.js"
import { createNevrFetch } from "./fetch.js"
import { createClientStore } from "./store.js"
import { createDynamicProxy } from "./proxy.js"
import { capitalize } from "../utils/index.js"
import { pluralize } from "../router.js"

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

// Server API type for entity inference
type ServerAPI = {
  $Infer: {
    Entities: Record<string, unknown>
    CreateInputs?: Record<string, unknown>
    EntityNames?: string
  }
}

/**
 * Client options with optional entity names for auto-entity-client
 */
export interface ClientOptionsWithEntities extends NevrClientOptions {
  /**
   * Entity names to expose on the client (creates runtime CRUD methods)
   *
   * When using `createClient<API>()`, this provides BOTH:
   * - Type inference from `<API>` for entity types
   * - Runtime methods (list, create, get, update, delete) from `entities` option
   *
   * @example
   * ```ts
   * const client = createClient<API>({
   *   entities: ["user", "product"],  // Runtime methods
   *   plugins: [authClient()],
   * })
   *
   * // Types from <API>, methods from entities option
   * await client.users.list()  // Typed as User[]
   * ```
   */
  entities?: string[]
}

/**
 * Extract action types from a plugins array
 * This works with the actual plugin types, not the generic NevrClientPlugin
 */
type ExtractPluginActionsFromArray<Plugins extends NevrClientPlugin[]> =
  Plugins extends Array<infer Plugin>
    ? Plugin extends { $InferActions: infer A }
      ? A extends Record<string, any>
        ? A
        : {}
      : Plugin extends NevrClientPlugin
        ? Plugin["getActions"] extends (...args: any) => infer Actions
          ? Actions
          : {}
        : {}
    : {}

/**
 * Infer hooks from a plugins array
 */
type InferHooksFromPlugins<Plugins extends NevrClientPlugin[]> =
  Plugins extends Array<infer Plugin>
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
 * Return type for createClient with proper plugin type inference
 * Separates the Plugins type parameter to ensure TypeScript infers it from the argument
 */
type CreateClientReturn<
  TApi extends ServerAPI | void,
  Plugins extends NevrClientPlugin[]
> = Prettify<
  // Plugin hooks (useSession, etc.)
  InferHooksFromPlugins<Plugins> &
  // Plugin actions (signIn, signUp, etc.) - deep merged
  DeepMergeUnion<ExtractPluginActionsFromArray<Plugins>> &
  // Entity API (if TApi is provided)
  (TApi extends ServerAPI
    ? InferEntitiesFromServer<
        TApi["$Infer"]["Entities"],
        TApi["$Infer"]["CreateInputs"] extends Record<string, unknown>
          ? TApi["$Infer"]["CreateInputs"]
          : { [K in keyof TApi["$Infer"]["Entities"]]: Omit<TApi["$Infer"]["Entities"][K], "id" | "createdAt" | "updatedAt"> }
      >
    : {}) &
  // Core client properties
  {
    /**
     * Reactive session state
     */
    useSession: Atom<SessionState<any>>

    /**
     * Raw fetch function for custom requests
     */
    $fetch: NevrFetch

    /**
     * Client store for reactive state
     */
    $store: ReturnType<typeof createClientStore>

    /**
     * Type inference helpers
     */
    $Infer: {
      Session: any
    }

    /**
     * Error codes from all plugins
     */
    $ERROR_CODES: any
  }
>

/**
 * Create a NEVR client
 *
 * @example Basic usage (plugins only):
 * ```ts
 * import { createClient } from "nevr/client"
 * import { authClient } from "nevr/plugins/auth/client"
 *
 * const client = createClient({
 *   plugins: [authClient()]
 * })
 *
 * // Type-safe plugin methods
 * await client.signIn.email({ email: "user@example.com", password: "..." })
 * ```
 *
 * @example With server API type (E2E type safety - RECOMMENDED):
 * ```ts
 * import { createClient } from "nevr/client"
 * import { authClient } from "nevr/plugins/auth/client"
 * import type { API } from "../server/api"
 *
 * const client = createClient<API>({
 *   entities: ["user", "product"],  // Required for runtime entity methods
 *   plugins: [authClient()],
 * })
 *
 * // Fully typed entities AND plugin methods!
 * await client.users.list()           // Entity types from <API>
 * await client.signIn.email({...})    // Plugin methods
 * ```
 *
 * @example Plugins only (no entities):
 * ```ts
 * const client = createClient({
 *   plugins: [authClient(), paymentClient()],
 * })
 *
 * await client.signIn.email({...})               // Auth
 * await client.payment.subscription.upgrade(...) // Payment
 * // client.users ❌ - no entity methods without <API> + entities option
 * ```
 */
/**
 * Extract plugins type from options
 */
type ExtractPlugins<Options> = Options extends { plugins: infer P }
  ? P extends NevrClientPlugin[]
    ? P
    : []
  : []

// Overload 1: No options - base client (for curried pattern first call)
export function createClient<TApi extends ServerAPI>(): <const Options extends ClientOptionsWithEntities>(
  options: Options
) => CreateClientReturn<TApi, ExtractPlugins<Options>>

// Overload 2: No API type, with options - infer everything from options
export function createClient<
  const Options extends ClientOptionsWithEntities,
>(
  options: Options
): CreateClientReturn<void, ExtractPlugins<Options>>

// Overload 3: With API type and options (backwards compat - limited inference)
export function createClient<
  TApi extends ServerAPI,
  const Options extends ClientOptionsWithEntities,
>(
  options: Options
): CreateClientReturn<TApi, ExtractPlugins<Options>>

// Implementation
export function createClient<
  TApi extends ServerAPI | void = void,
  Options extends ClientOptionsWithEntities = ClientOptionsWithEntities,
>(
  options?: Options
): any {
  // If no options provided, return curried function for API type binding
  if (options === undefined) {
    return <const Opts extends ClientOptionsWithEntities>(opts: Opts) => {
      return createClientImpl<TApi, Opts>(opts)
    }
  }
  return createClientImpl<TApi, Options>(options)
}

// Internal implementation
function createClientImpl<
  TApi extends ServerAPI | void = void,
  const Options extends ClientOptionsWithEntities = ClientOptionsWithEntities
>(
  options?: Options
) {
  // Get entity names from options
  const entityNames = options?.entities || []

  const {
    pluginPathMethods,
    pluginsActions,
    pluginsAtoms,
    $fetch,
    atomListeners,
    $store,
  } = getClientConfig(options)

  // Add entity CRUD methods if entity names provided
  if (entityNames.length > 0) {
    for (const entityName of entityNames) {
      const pluralName = pluralize(entityName.toLowerCase())
      pluginsActions[pluralName] = createEntityMethods($fetch, entityName)
    }
  }

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

  // Infer entity types from server API (if provided)
  type EntityAPI = TApi extends ServerAPI
    ? InferEntitiesFromServer<
        TApi["$Infer"]["Entities"],
        TApi["$Infer"]["CreateInputs"] extends Record<string, unknown>
          ? TApi["$Infer"]["CreateInputs"]
          : { [K in keyof TApi["$Infer"]["Entities"]]: Omit<TApi["$Infer"]["Entities"][K], "id" | "createdAt" | "updatedAt"> }
      >
    : {}

  // Return typed client
  return proxy as UnionToIntersection<InferResolvedHooks<Options>> &
    ClientAPI &
    InferActions<Options> &
    EntityAPI & {
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

export type NevrClient<
  TApi extends ServerAPI | void = void,
  Plugins extends NevrClientPlugin[] = NevrClientPlugin[]
> = CreateClientReturn<TApi, Plugins>

// Server-Inferred Client Creation (DEPRECATED)
// Use createClient<API>() instead
// -----------------------------------------------------------------------------

import type { AuthClientMethods } from "../plugins/auth/client.js"

/**
 * @deprecated Use `createClient<API>()` instead for consistency.
 *
 * Create a typed client from server API type.
 * This function is kept for backwards compatibility but will be removed in a future version.
 *
 * @example
 * ```ts
 * // OLD (deprecated):
 * const client = createTypedClient<API>({ plugins: [...] })
 *
 * // NEW (recommended):
 * const client = createClient<API>({ plugins: [...] })
 * ```
 */
export function createTypedClient<
  TApi extends { $Infer: { Entities: Record<string, unknown>; CreateInputs?: Record<string, unknown> } },
  TPlugins extends Record<string, unknown> = {}
>(
  options: NevrClientOptions
) {
  return createClient<TApi>()(options as ClientOptionsWithEntities) as any
}

/**
 * @deprecated Use `createClient<API>()` instead.
 *
 * Original implementation kept for reference. Migrated to createClient.
 *
 * @example Migration:
 * ```ts
 * // BEFORE:
 * const client = createTypedClient<API>({
 *   plugins: [entityClient({ entities: ["user"] }), authClient()],
 * })
 *
 * // AFTER:
 * const client = createClient<API>({
 *   plugins: [entityClient({ entities: ["user"] }), authClient()],
 * })
 *
 * // Both support:
 * client.users.list()          // Entity types from API
 * client.signIn.email({...})   // Plugin methods (when authClient() is added)
 * client.signIn.username({...}) // Sub-plugin methods (when usernameClient() is added)
 * ```
 *
 * @example With sub-plugins:
 * ```ts
 * import { usernameClient } from "nevr/plugins/auth/plugins/username/client"
 *
 * const client = createClient<API>({
 *   plugins: [
 *     entityClient({ entities: ["user"] }),
 *     authClient(),
 *     usernameClient(),  // Adds signIn.username
 *   ],
 * })
 *
 * await client.signIn.email({...})     // From authClient
 * await client.signIn.username({...})  // From usernameClient (properly merged!)
 * ```
 */

