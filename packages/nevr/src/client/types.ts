// =============================================================================
// CLIENT TYPES
// Type definitions for the NEVR client plugin system
// =============================================================================

import type { Atom, WritableAtom } from "nanostores"
import type { NevrPlugin, PluginMeta, PluginSchema, PluginFieldDef } from "../plugins/core/contract.js"
import type { NevrInstanceType, InferClientFromServer, InferEntityFromSchema } from "../plugins/core/inference.js"

// -----------------------------------------------------------------------------
// Helper Types
// -----------------------------------------------------------------------------

export type LiteralString = string & {}

export type Awaitable<T> = T | Promise<T>

export type UnionToIntersection<U> = (
  U extends any ? (x: U) => void : never
) extends (x: infer I) => void
  ? I
  : never

export type PrettifyDeep<T> = {
  [K in keyof T]: T[K] extends object ? PrettifyDeep<T[K]> : T[K]
} & {}

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type StripEmptyObjects<T> = T extends infer U
  ? {} extends U
  ? never
  : U
  : never

// -----------------------------------------------------------------------------
// Deep Merge Types for Plugin Actions
// Merges nested objects like { signIn: { email } } & { signIn: { username } }
// into { signIn: { email, username } }
// -----------------------------------------------------------------------------

/**
 * Deep merge two types, combining nested objects instead of overwriting
 */
export type DeepMerge<T, U> = {
  [K in keyof T | keyof U]: K extends keyof T
    ? K extends keyof U
      ? T[K] extends Record<string, unknown>
        ? U[K] extends Record<string, unknown>
          ? DeepMerge<T[K], U[K]>
          : T[K]
        : U[K]
      : T[K]
    : K extends keyof U
      ? U[K]
      : never
}

/**
 * Deep merge array of types
 */
export type DeepMergeAll<T extends any[]> = T extends [infer First, ...infer Rest]
  ? Rest extends any[]
    ? Rest["length"] extends 0
      ? First
      : DeepMerge<First, DeepMergeAll<Rest>>
    : First
  : {}

/**
 * Convert union to tuple for iteration
 */
type UnionToTuple<T, L = LastOf<T>, N = [T] extends [never] ? true : false> =
  true extends N ? [] : Push<UnionToTuple<Exclude<T, L>>, L>

type LastOf<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never

type Push<T extends any[], V> = [...T, V]

/**
 * Deep merge union of types - preserves nested objects
 * TypeScript's intersection automatically merges nested objects with same keys
 * { auth: A } & { auth: B } => { auth: A & B }
 */
export type DeepMergeUnion<U> = [U] extends [never]
  ? {}
  : UnionToIntersection<U>

// -----------------------------------------------------------------------------
// Path to Object Types (for endpoint path inference)
// Converts API paths like "/sign-in/username" to { signIn: { username: fn } }
// -----------------------------------------------------------------------------

/**
 * Convert kebab-case to camelCase
 */
export type CamelCase<S extends string> =
  S extends `${infer P1}-${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
    : Lowercase<S>

/**
 * Convert path to nested object structure
 * e.g. "/sign-in/username" -> { signIn: { username: Fn } }
 */
export type PathToObject<
  T extends string,
  Fn extends (...args: any[]) => any,
> = T extends `/${infer Segment}/${infer Rest}`
  ? { [K in CamelCase<Segment>]: PathToObject<`/${Rest}`, Fn> }
  : T extends `/${infer Segment}`
    ? { [K in CamelCase<Segment>]: Fn }
    : never

// -----------------------------------------------------------------------------
// Client Store
// -----------------------------------------------------------------------------

export interface ClientStore {
  notify: (signal: string) => void
  listen: (signal: string, listener: () => void) => void
  atoms: Record<string, WritableAtom<any>>
}

// -----------------------------------------------------------------------------
// Fetch Types
// -----------------------------------------------------------------------------

export interface NevrFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  headers?: Record<string, string>
  body?: any
  query?: Record<string, any>
  credentials?: "include" | "omit" | "same-origin"
  /**
   * Disable signal triggers on success
   */
  disableSignal?: boolean
  /**
   * Custom fetch function
   */
  customFetch?: typeof fetch
  /**
   * Callbacks
   */
  onRequest?: (context: { url: string; options: RequestInit }) => void | Promise<void>
  onResponse?: (context: { response: Response; data: any }) => void | Promise<void>
  onSuccess?: (context: { data: any }) => void | Promise<void>
  onError?: (context: { error: NevrFetchError }) => void | Promise<void>
}

export interface NevrFetchResponse<T = any> {
  data: T | null
  error: NevrFetchError | null
}

export interface NevrFetchError {
  status: number
  statusText: string
  message: string
  code?: string
  details?: any
}

export type NevrFetch = <T = any>(
  path: string,
  options?: NevrFetchOptions
) => Promise<NevrFetchResponse<T>>

// -----------------------------------------------------------------------------
// Atom Listener
// -----------------------------------------------------------------------------

export interface ClientAtomListener {
  matcher: (path: string) => boolean
  signal: "$sessionSignal" | string
}

// -----------------------------------------------------------------------------
// Client Middleware
// -----------------------------------------------------------------------------

/**
 * Request context passed to middleware
 */
export interface MiddlewareRequestContext {
  /** Request URL */
  url: string
  /** Request path (without base) */
  path: string
  /** HTTP method */
  method: string
  /** Request headers (mutable) */
  headers: Record<string, string>
  /** Request body (mutable) */
  body?: unknown
  /** Query parameters */
  query?: Record<string, any>
  /** Abort the request and return early */
  abort: (response: NevrFetchResponse<any>) => void
  /** Whether request was aborted */
  aborted: boolean
}

/**
 * Response context passed to middleware
 */
export interface MiddlewareResponseContext {
  /** Original request context */
  request: MiddlewareRequestContext
  /** Response data */
  data: any
  /** Response error (if any) */
  error: NevrFetchError | null
  /** HTTP status code */
  status: number
  /** Whether request was successful */
  ok: boolean
}

/**
 * Client middleware function
 * Runs before request, can modify request or abort
 *
 * @example
 * ```ts
 * // Add auth token to all requests
 * const authMiddleware: ClientMiddleware = async (ctx, next) => {
 *   const token = localStorage.getItem('token')
 *   if (token) {
 *     ctx.headers['Authorization'] = `Bearer ${token}`
 *   }
 *   return next()
 * }
 *
 * // Log all requests
 * const logMiddleware: ClientMiddleware = async (ctx, next) => {
 *   console.log(`Request: ${ctx.method} ${ctx.path}`)
 *   const result = await next()
 *   console.log(`Response: ${result.status}`)
 *   return result
 * }
 *
 * // Retry on failure
 * const retryMiddleware: ClientMiddleware = async (ctx, next) => {
 *   let result = await next()
 *   if (result.error && result.status >= 500) {
 *     // Retry once
 *     result = await next()
 *   }
 *   return result
 * }
 *
 * const client = createClient({
 *   middleware: [authMiddleware, logMiddleware, retryMiddleware]
 * })
 * ```
 */
export type ClientMiddleware = (
  ctx: MiddlewareRequestContext,
  next: () => Promise<MiddlewareResponseContext>
) => Promise<MiddlewareResponseContext>

/**
 * Response interceptor - runs after response is received
 * Can modify response data or handle errors
 *
 * @example
 * ```ts
 * // Refresh token on 401
 * const refreshInterceptor: ResponseInterceptor = async (ctx) => {
 *   if (ctx.error?.status === 401) {
 *     await refreshToken()
 *     // Trigger retry by returning special value
 *     return { retry: true }
 *   }
 *   return ctx
 * }
 *
 * // Transform dates in response
 * const dateInterceptor: ResponseInterceptor = async (ctx) => {
 *   if (ctx.data) {
 *     ctx.data = transformDates(ctx.data)
 *   }
 *   return ctx
 * }
 * ```
 */
export type ResponseInterceptor = (
  ctx: MiddlewareResponseContext
) => Promise<MiddlewareResponseContext | { retry: true }>

// -----------------------------------------------------------------------------
// Client Plugin Types
// -----------------------------------------------------------------------------

export interface NevrClientPlugin {
  /**
   * Unique plugin identifier (must match server plugin)
   */
  id: LiteralString

  /**
   * Reference to server plugin for type inference
   * Only used for types, don't pass actual plugin
   */
  $InferServerPlugin?: NevrPlugin | undefined

  /**
   * Type-only property for action type inference
   * Used by InferActions to get proper types without calling getActions
   * This enables deep merging of nested action objects
   */
  $InferActions?: unknown

  /**
   * Custom actions added by this plugin
   */
  getActions?: (
    $fetch: NevrFetch,
    $store: ClientStore,
    options: NevrClientOptions | undefined
  ) => Record<string, any>

  /**
   * Reactive atoms provided by this plugin
   */
  getAtoms?: ($fetch: NevrFetch) => Record<string, Atom<any>>

  /**
   * Path method overrides
   */
  pathMethods?: Record<string, "POST" | "GET">

  /**
   * Fetch plugins/middleware
   */
  fetchPlugins?: NevrFetchPlugin[]

  /**
   * Atom listeners for reactive updates
   */
  atomListeners?: ClientAtomListener[]
}

export interface NevrFetchPlugin {
  name: string
  onRequest?: (context: { url: string; options: RequestInit }) => void | Promise<void>
  onResponse?: (context: { response: Response }) => void | Promise<void>
}

// -----------------------------------------------------------------------------
// Client Options
// -----------------------------------------------------------------------------

export interface SessionRevalidateOptions {
  /**
   * Refetch interval in seconds (0 = disabled)
   * @default 0
   */
  refetchInterval?: number

  /**
   * Refetch when window gains focus
   * @default true
   */
  refetchOnWindowFocus?: boolean

  /**
   * Refetch when network comes back online
   * @default false
   */
  refetchWhenOnline?: boolean
}

export interface NevrClientOptions {
  /**
   * Base URL for API requests
   */
  baseURL?: string

  /**
   * Base path prefix for all routes
   * @default "/api"
   */
  basePath?: string

  /**
   * Client plugins
   */
  plugins?: NevrClientPlugin[]

  /**
   * Client middleware - runs on every request
   * Middleware executes in order, wrapping each subsequent middleware
   *
   * @example
   * ```ts
   * const client = createClient({
   *   middleware: [
   *     // Auth middleware
   *     async (ctx, next) => {
   *       ctx.headers['Authorization'] = `Bearer ${getToken()}`
   *       return next()
   *     },
   *     // Logging middleware
   *     async (ctx, next) => {
   *       console.log(`${ctx.method} ${ctx.path}`)
   *       const result = await next()
   *       console.log(`Response: ${result.status}`)
   *       return result
   *     }
   *   ]
   * })
   * ```
   */
  middleware?: ClientMiddleware[]

  /**
   * Response interceptors - runs after response is received
   * Can transform data or handle errors (like token refresh)
   */
  interceptors?: ResponseInterceptor[]

  /**
   * Default fetch options
   */
  fetchOptions?: NevrFetchOptions

  /**
   * Session revalidation options
   */
  sessionOptions?: SessionRevalidateOptions

  /**
   * For type inference from server
   */
  $InferNevr?: any
}

// -----------------------------------------------------------------------------
// Type Inference Utilities
// -----------------------------------------------------------------------------

/**
 * Infer client API from options and plugins
 */
export type InferClientAPI<O extends NevrClientOptions> = InferRoutes<
  O["plugins"] extends Array<any>
  ? O["plugins"] extends Array<infer Pl>
  ? UnionToIntersection<
    Pl extends { $InferServerPlugin: infer Plug }
    ? Plug extends { endpoints: infer Endpoints }
    ? Endpoints
    : {}
    : {}
  >
  : {}
  : {}
>

/**
 * Extract action types from a single plugin
 */
type ExtractPluginActions<P> = P extends NevrClientPlugin
  ? P extends { $InferActions: infer A }
    ? A extends Record<string, any>
      ? A  // Use explicit $InferActions if available
      : {}
    : P["getActions"] extends (...args: any) => infer Actions
      ? Actions
      : {}
  : {}

/**
 * Infer actions from client plugins with deep merge support
 * This properly merges nested objects like { signIn: { email } } & { signIn: { username } }
 */
export type InferActions<O extends NevrClientOptions> = O["plugins"] extends Array<infer Plugin>
  ? Prettify<DeepMergeUnion<ExtractPluginActions<Plugin>>>
  : {}

/**
 * Infer atoms/hooks from client plugins
 */
export type InferAtoms<O extends NevrClientOptions> = O["plugins"] extends Array<infer Plugin>
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
 * Infer error codes from server plugins
 */
export type InferErrorCodes<O extends NevrClientOptions> = O["plugins"] extends Array<infer Plugin>
  ? UnionToIntersection<
    Plugin extends NevrClientPlugin
    ? Plugin["$InferServerPlugin"] extends { $ERROR_CODES: infer E }
    ? E extends Record<string, string>
    ? E
    : {}
    : {}
    : {}
  >
  : {}

/**
 * Convert endpoint paths to callable methods
 */
export type InferRoutes<Endpoints> = Endpoints extends Record<string, infer E>
  ? {
    [K in keyof Endpoints]: Endpoints[K] extends {
      input?: infer Input
      output?: infer Output
    }
    ? (
      input?: Input,
      options?: NevrFetchOptions
    ) => Promise<NevrFetchResponse<Output>>
    : never
  }
  : {}

/**
 * Check if a key is a signal (starts with $)
 */
export type IsSignal<T> = T extends `$${infer _}` ? true : false

// -----------------------------------------------------------------------------
// Session Types
// -----------------------------------------------------------------------------

export interface BaseUser {
  id: string
  email?: string
  name?: string
  image?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface BaseSession {
  id: string
  userId: string
  token: string
  expiresAt: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface SessionState<TUser = BaseUser, TSession = BaseSession> {
  data: { user: TUser; session: TSession } | null
  error: NevrFetchError | null
  isPending: boolean
}

// -----------------------------------------------------------------------------
// Infer Additional Fields from Plugins
// -----------------------------------------------------------------------------

export type InferAdditionalFields<
  Options extends NevrClientOptions,
  Key extends string,
  Format extends "input" | "output" = "output"
> = Options["plugins"] extends Array<infer T>
  ? T extends NevrClientPlugin
  ? T["$InferServerPlugin"] extends {
    schema: {
      [key in Key]: {
        fields: infer Field
      }
    }
  }
  ? Field
  : {}
  : {}
  : {}

/**
 * Infer session from client options
 */
export type InferSessionFromClient<O extends NevrClientOptions> = StripEmptyObjects<
  BaseSession & UnionToIntersection<InferAdditionalFields<O, "session">>
>

/**
 * Infer user from client options
 */
export type InferUserFromClient<O extends NevrClientOptions> = StripEmptyObjects<
  BaseUser & UnionToIntersection<InferAdditionalFields<O, "user">>
>

// -----------------------------------------------------------------------------
// Server Inference Types
// Infer client types from server instance
// -----------------------------------------------------------------------------

/**
 * Create client options that infer types from server
 * Usage: createClient<typeof auth>({ ... })
 */
export type CreateClientOptions<TServer> = TServer extends NevrInstanceType<infer E, infer P>
  ? NevrClientOptions & {
    $InferNevr: InferClientFromServer<TServer>
  }
  : NevrClientOptions

/**
 * Infer the full client type from a server instance
 * This is the main type for server → client sync
 */
export type InferClientType<TServer> = TServer extends NevrInstanceType<infer E, infer P>
  ? {
    // All entity types from server
    entities: InferClientFromServer<TServer>["entities"]
    // All plugin types
    plugins: InferClientFromServer<TServer>["plugins"]
    // All endpoints
    endpoints: InferClientFromServer<TServer>["endpoints"]
    // All error codes
    errorCodes: InferClientFromServer<TServer>["errorCodes"]
  }
  : never

/**
 * Infer entity type by name from server
 */
export type InferEntityType<TServer, TName extends string> = TServer extends NevrInstanceType
  ? InferClientFromServer<TServer>["entities"][TName]
  : never

/**
 * Infer plugin actions from server plugin
 */
export type InferPluginActions<TPlugin extends NevrPlugin> = TPlugin extends { endpoints: infer E }
  ? E
  : {}

// -----------------------------------------------------------------------------
// Entity-First Client Inference
// Automatically creates API methods from entities
// -----------------------------------------------------------------------------

/**
 * Auto-generate CRUD methods for an entity
 * Entity name → API methods
 */
export type EntityCRUD<TEntity, TName extends string> = {
  list: (options?: {
    filter?: Partial<TEntity>
    sort?: Partial<Record<keyof TEntity, "asc" | "desc">>
    take?: number
    skip?: number
  }) => Promise<NevrFetchResponse<{ data: TEntity[]; pagination: { total: number; limit: number; offset: number } }>>

  create: (
    data: Omit<TEntity, "id" | "createdAt" | "updatedAt">
  ) => Promise<NevrFetchResponse<TEntity>>

  read: (id: string) => Promise<NevrFetchResponse<TEntity>>

  update: (
    id: string,
    data: Partial<Omit<TEntity, "id" | "createdAt" | "updatedAt">>
  ) => Promise<NevrFetchResponse<TEntity>>

  delete: (id: string) => Promise<NevrFetchResponse<void>>
}

// -----------------------------------------------------------------------------
// Entity Actions Type Inference (Zero API Pattern)
// Automatically generates typed action methods from entity action definitions
// -----------------------------------------------------------------------------

import type { EntityAction, FieldDef } from "../types.js"

/**
 * Infer input type from action's input schema
 */
export type InferActionInput<TAction> = TAction extends { input: Record<string, FieldDef> }
  ? {
    [K in keyof TAction["input"]]: TAction["input"][K] extends { type: infer T }
    ? T extends "string" | "text" ? string
    : T extends "int" | "float" ? number
    : T extends "boolean" ? boolean
    : T extends "datetime" ? Date
    : T extends "json" ? Record<string, unknown>
    : unknown
    : unknown
  }
  : void

/**
 * Infer output type from action's returns config
 * Uses OmitFields/PickFields to avoid conflict with built-in Omit/Pick
 */
export type InferActionOutput<TAction, TEntityData = unknown> = TAction extends { returns: { entity: string; omit: infer OmitFields } }
  ? OmitFields extends string[]
  ? Omit<TEntityData, OmitFields[number]>
  : TEntityData
  : TAction extends { returns: { entity: string; pick: infer PickFields } }
  ? PickFields extends string[]
  ? Pick<TEntityData, PickFields[number] & keyof TEntityData>
  : TEntityData
  : Record<string, unknown>

/**
 * Create typed action method from action definition
 */
export type ActionMethod<TAction> = TAction extends { input: infer I }
  ? I extends void
  ? () => Promise<NevrFetchResponse<InferActionOutput<TAction>>>
  : (input: InferActionInput<TAction>) => Promise<NevrFetchResponse<InferActionOutput<TAction>>>
  : () => Promise<NevrFetchResponse<InferActionOutput<TAction>>>

/**
 * Create typed action method for resource-level actions (requires ID)
 */
export type ResourceActionMethod<TAction> = TAction extends { input: infer I }
  ? I extends void
  ? (id: string) => Promise<NevrFetchResponse<InferActionOutput<TAction>>>
  : (id: string, input: InferActionInput<TAction>) => Promise<NevrFetchResponse<InferActionOutput<TAction>>>
  : (id: string) => Promise<NevrFetchResponse<InferActionOutput<TAction>>>

/**
 * Infer action methods from entity actions
 * Handles both collection-level and resource-level actions
 */
export type InferEntityActions<TActions extends Record<string, EntityAction>> = {
  [K in keyof TActions]: TActions[K] extends { requiresId: true }
  ? ResourceActionMethod<TActions[K]>
  : ActionMethod<TActions[K]>
}

/**
 * Enhanced entity CRUD with typed actions
 * Adds typed action methods alongside standard CRUD
 */
export type EntityCRUDWithActions<TEntity, TName extends string, TActions extends Record<string, EntityAction> = {}> =
  EntityCRUD<TEntity, TName> & InferEntityActions<TActions>

/**
 * Create entity API from entity map with actions
 * Converts { user: { data: UserType, actions: {...} } } to typed client
 */
export type EntitiesAPIWithActions<TEntities extends Record<string, { data: unknown; actions?: Record<string, EntityAction> }>> = {
  [K in keyof TEntities as K extends string ? `${Lowercase<K>}s` : never]: TEntities[K] extends { data: infer D; actions: infer A }
  ? A extends Record<string, EntityAction>
  ? EntityCRUDWithActions<D, K & string, A>
  : EntityCRUD<D, K & string>
  : EntityCRUD<TEntities[K], K & string>
}

/**
 * Create entity API from entity map
 * Converts { user: UserType, post: PostType } to { users: EntityCRUD<UserType>, posts: EntityCRUD<PostType> }
 */
export type EntitiesAPI<TEntities extends Record<string, unknown>> = {
  [K in keyof TEntities as K extends string ? `${Lowercase<K>}s` : never]: EntityCRUD<TEntities[K], K & string>
}

// -----------------------------------------------------------------------------
// Plugin-Based Inference
// For specific plugin endpoints
// -----------------------------------------------------------------------------

/**
 * Infer auth plugin types if present
 */
export type InferAuthFromClient<O extends NevrClientOptions> = O["plugins"] extends Array<infer P>
  ? P extends NevrClientPlugin
  ? P["id"] extends "auth" | "auth-client"
  ? P["$InferServerPlugin"] extends { $Infer: infer I }
  ? I
  : {}
  : {}
  : {}
  : {}

/**
 * Infer schema extensions from all plugins
 */
export type InferSchemaExtensions<O extends NevrClientOptions> = O["plugins"] extends Array<infer P>
  ? P extends NevrClientPlugin
  ? P["$InferServerPlugin"] extends { schema: { extend: infer E } }
  ? E
  : {}
  : {}
  : {}
