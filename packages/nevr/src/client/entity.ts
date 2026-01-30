// =============================================================================
// ENTITY CLIENT
// Auto-generate CRUD methods for entities with full type safety
// =============================================================================

import type {
  NevrClientPlugin,
  NevrFetch,
  ClientStore,
  NevrClientOptions,
  NevrFetchOptions,
  NevrFetchResponse,
} from "./types.js"
import type { Entity, FieldDef } from "../types.js"
import { pluralize } from "../router.js"

// -----------------------------------------------------------------------------
// Entity Client Types
// -----------------------------------------------------------------------------

/**
 * Pagination response
 */
export interface PaginationInfo {
  total: number
  limit: number
  offset: number
}

/**
 * List response with pagination
 */
export interface ListResponse<T> {
  data: T[]
  pagination: PaginationInfo
}

/**
 * Filter operators for advanced querying
 */
export interface FilterOperators<T> {
  equals?: T
  not?: T
  in?: T[]
  notIn?: T[]
  lt?: T
  lte?: T
  gt?: T
  gte?: T
  contains?: string
  startsWith?: string
  endsWith?: string
}

/**
 * Filter type - supports both simple values and operators
 */
export type FilterValue<T> = T | FilterOperators<T> | null

/**
 * System fields that are always present on entities
 * These are added by the framework and not defined in entity fields
 */
export type SystemFields = {
  id: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Combined entity type with system fields
 */
export type EntityWithSystemFields<T> = T & SystemFields

/**
 * Entity filter type - properly typed for each field including system fields
 */
export type EntityFilter<T> = {
  [K in keyof EntityWithSystemFields<T>]?: FilterValue<EntityWithSystemFields<T>[K]>
} & {
  AND?: EntityFilter<T>[]
  OR?: EntityFilter<T>[]
  NOT?: EntityFilter<T>
}

/**
 * Sort direction
 */
export type SortDirection = "asc" | "desc"

/**
 * Entity sort type - properly typed for each field including system fields
 */
export type EntitySort<T> = {
  [K in keyof EntityWithSystemFields<T>]?: SortDirection
}

/**
 * Select type - specify which fields to return
 */
export type EntitySelect<T> = (keyof EntityWithSystemFields<T>)[] | {
  [K in keyof EntityWithSystemFields<T>]?: boolean
}

/**
 * List options for filtering, sorting, pagination
 * Fully typed based on entity fields including system fields (id, createdAt, updatedAt)
 */
export interface ListOptions<T> {
  /** Filter records - supports operators like { price: { gte: 100 } } */
  filter?: EntityFilter<T>
  /** Sort records - e.g., { createdAt: "desc" } */
  sort?: EntitySort<T>
  /** Number of records to return (limit) */
  take?: number
  /** Number of records to skip (offset) */
  skip?: number
  /** Relations to include */
  include?: string[]
  /** Select specific fields to return (defaults to all) */
  select?: EntitySelect<T>
}

/**
 * Action method type for entity actions
 */
export type ActionMethod<TInput = void, TOutput = unknown> =
  TInput extends void
  ? () => Promise<NevrFetchResponse<TOutput>>
  : (input: TInput) => Promise<NevrFetchResponse<TOutput>>

/**
 * Resource action method type (requires ID)
 */
export type ResourceActionMethod<TInput = void, TOutput = unknown> =
  TInput extends void
  ? (id: string) => Promise<NevrFetchResponse<TOutput>>
  : (id: string, input: TInput) => Promise<NevrFetchResponse<TOutput>>

/**
 * Entity CRUD methods with actions support
 */
export interface EntityMethods<
  TData,
  TCreate = Omit<TData, "id" | "createdAt" | "updatedAt">,
  TActions extends Record<string, any> = Record<string, never>
> {
  /**
   * List all records with pagination
   * @example
   * const { data } = await client.products.list({
   *   filter: { published: true, price: { gte: 100 } },
   *   sort: { createdAt: "desc" },
   *   take: 10
   * })
   */
  list: (options?: ListOptions<TData>) => Promise<NevrFetchResponse<ListResponse<TData>>>

  /**
   * Create a new record
   */
  create: (data: TCreate) => Promise<NevrFetchResponse<TData>>

  /**
   * Get a single record by ID
   */
  get: (id: string) => Promise<NevrFetchResponse<TData>>

  /**
   * Update a record by ID
   */
  update: (id: string, data: Partial<TCreate>) => Promise<NevrFetchResponse<TData>>

  /**
   * Delete a record by ID
   */
  delete: (id: string) => Promise<NevrFetchResponse<void>>

  /**
   * Count records matching filter
   */
  count: (filter?: EntityFilter<TData>) => Promise<NevrFetchResponse<{ count: number }>>

  /**
   * Entity actions - custom operations defined on the entity
   * @example
   * // Resource action (requires ID)
   * await client.orders.action("checkout", "order-123", { paymentMethodId: "pm_xxx" })
   *
   * // Collection action (no ID)
   * await client.products.action("bulkPublish", { ids: ["1", "2", "3"] })
   */
  action: <TOutput = unknown, TInput = unknown>(
    actionName: string,
    idOrInput: string | TInput,
    input?: TInput
  ) => Promise<NevrFetchResponse<TOutput>>
}

/**
 * Entity client options
 */
export interface EntityClientOptions<TEntities = Record<string, unknown>> {
  /**
   * Entity names to expose (will auto-pluralize for routes)
   * @example ["user", "product", "order"]
   */
  entities?: string[]

  /**
   * Entity actions configuration
   * @example { order: ["checkout", "cancel", "ship"] }
   */
  actions?: Record<string, string[]>

  /**
   * Type-safe entity definitions from server
   * @example { user: User, product: Product }
   */
  $types?: TEntities
}

// -----------------------------------------------------------------------------
// Entity Methods Factory
// -----------------------------------------------------------------------------

/**
 * Create CRUD methods for an entity with action support
 * Exported for use by createClient's `entities` option
 */
export function createEntityMethods<T>(
  $fetch: NevrFetch,
  entityName: string
): EntityMethods<T> {
  const basePath = `/${pluralize(entityName.toLowerCase())}`

  return {
    async list(options?: ListOptions<T>) {
      const query: Record<string, string> = {}

      if (options?.filter) {
        query.filter = JSON.stringify(options.filter)
      }
      if (options?.sort) {
        query.sort = JSON.stringify(options.sort)
      }
      if (options?.take !== undefined) {
        query.take = String(options.take)
      }
      if (options?.skip !== undefined) {
        query.skip = String(options.skip)
      }
      if (options?.include) {
        query.include = options.include.join(",")
      }
      if (options?.select) {
        // Convert array to comma-separated, object to JSON
        query.select = Array.isArray(options.select)
          ? options.select.join(",")
          : JSON.stringify(options.select)
      }

      return $fetch<ListResponse<T>>(basePath, {
        method: "GET",
        query,
      })
    },

    async create(data: Omit<T, "id" | "createdAt" | "updatedAt">) {
      return $fetch<T>(basePath, {
        method: "POST",
        body: data,
      })
    },

    async get(id: string) {
      return $fetch<T>(`${basePath}/${id}`, {
        method: "GET",
      })
    },

    async update(id: string, data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>) {
      return $fetch<T>(`${basePath}/${id}`, {
        method: "PUT",
        body: data,
      })
    },

    async delete(id: string) {
      return $fetch<void>(`${basePath}/${id}`, {
        method: "DELETE",
      })
    },

    async count(filter?: EntityFilter<T>) {
      const query: Record<string, string> = {}
      if (filter) {
        query.filter = JSON.stringify(filter)
      }

      return $fetch<{ count: number }>(`${basePath}/count`, {
        method: "GET",
        query,
      })
    },

    async action<TOutput = unknown, TInput = unknown>(
      actionName: string,
      idOrInput: string | TInput,
      input?: TInput
    ) {
      // Determine if this is a resource action (has ID) or collection action
      const isResourceAction = typeof idOrInput === "string" && input !== undefined
      const hasIdOnly = typeof idOrInput === "string" && input === undefined

      if (isResourceAction) {
        // Resource action: /entities/:id/actionName
        return $fetch<TOutput>(`${basePath}/${idOrInput}/${actionName}`, {
          method: "POST",
          body: input,
        })
      } else if (hasIdOnly) {
        // Resource action with no input: /entities/:id/actionName
        return $fetch<TOutput>(`${basePath}/${idOrInput}/${actionName}`, {
          method: "POST",
        })
      } else {
        // Collection action: /entities/actionName
        return $fetch<TOutput>(`${basePath}/${actionName}`, {
          method: "POST",
          body: idOrInput,
        })
      }
    },
  }
}

// -----------------------------------------------------------------------------
// Entity Client Plugin
// -----------------------------------------------------------------------------

/**
 * Create an entity client plugin that exposes CRUD methods for entities
 *
 * @example
 * ```ts
 * // Basic usage with entity names
 * const client = createClient({
 *   plugins: [
 *     entityClient({ entities: ["user", "product", "order"] })
 *   ]
 * })
 *
 * // List products
 * const { data } = await client.products.list({ take: 10 })
 *
 * // Create a user
 * const { data: user } = await client.users.create({ email: "test@test.com" })
 *
 * // Get by ID
 * const { data: product } = await client.products.get("abc123")
 * ```
 *
 * @example
 * ```ts
 * // Type-safe usage with server types
 * import type { $Infer } from "nevr"
 * import type { API } from "../server" // Your server export
 *
 * type Entities = $Infer<API>["entities"]
 *
 * const client = createClient({
 *   plugins: [
 *     entityClient<Entities>({ entities: ["user", "product"] })
 *   ]
 * })
 *
 * // Now client.users and client.products are fully typed!
 * ```
 */
export function entityClient<TEntities = Record<string, unknown>>(
  options?: EntityClientOptions<TEntities>
): NevrClientPlugin & {
  // Type inference helper
  $Entities: TEntities
} {
  const entityNames = options?.entities || []

  return {
    id: "entity-client",

    getActions: ($fetch: NevrFetch, $store: ClientStore, clientOptions?: NevrClientOptions) => {
      const actions: Record<string, EntityMethods<any>> = {}

      for (const entityName of entityNames) {
        const pluralName = pluralize(entityName.toLowerCase())
        actions[pluralName] = createEntityMethods($fetch, entityName)
      }

      return actions
    },

    // Path methods for CRUD operations
    pathMethods: entityNames.reduce((acc, name) => {
      const basePath = `/${pluralize(name.toLowerCase())}`
      return {
        ...acc,
        [basePath]: "GET" as const,
        [`${basePath}/count`]: "GET" as const,
      }
    }, {} as Record<string, "POST" | "GET">),

    // Type helper (not used at runtime)
    $Entities: {} as TEntities,
  }
}

// -----------------------------------------------------------------------------
// Type Inference Helpers
// -----------------------------------------------------------------------------

/**
 * Infer entity client type from entities
 */
export type InferEntityClient<TEntities extends Record<string, unknown>> = {
  [K in keyof TEntities as K extends string ? `${Lowercase<K>}s` : never]: EntityMethods<TEntities[K]>
}

/**
 * Create typed entity methods from entity array
 * For use with server type inference
 */
export type InferEntityMethods<TEntity> = TEntity extends { config: { fields: infer F } }
  ? F extends Record<string, FieldDef>
  ? EntityMethods<InferEntityType<F>>
  : never
  : never

/**
 * Infer entity type from fields
 */
type InferEntityType<F extends Record<string, FieldDef>> = {
  id: string
  createdAt?: Date
  updatedAt?: Date
} & {
  [K in keyof F]: F[K]["optional"] extends true
  ? FieldTypeToTS<F[K]["type"]> | null
  : FieldTypeToTS<F[K]["type"]>
}

type FieldTypeToTS<T> =
  T extends "string" | "text" ? string :
  T extends "int" | "float" ? number :
  T extends "boolean" ? boolean :
  T extends "datetime" ? Date :
  T extends "json" ? Record<string, unknown> :
  unknown

// -----------------------------------------------------------------------------
// Server-Inferred Client Types
// These types enable true E2E type safety from server to client
// -----------------------------------------------------------------------------

/**
 * Infer entity methods from server $Infer
 * Maps entity names to their CRUD methods
 *
 * @example
 * ```ts
 * import type { API } from "../server"
 *
 * type Entities = API["$Infer"]["Entities"]
 * type CreateInputs = API["$Infer"]["CreateInputs"]
 * type Client = InferEntitiesFromServer<Entities, CreateInputs>
 * // { users: EntityMethods<User, CreateUser>, ... }
 * ```
 */
export type InferEntitiesFromServer<
  TEntities extends Record<string, unknown>,
  TCreateInputs extends Record<string, unknown> = { [K in keyof TEntities]: Omit<TEntities[K], "id" | "createdAt" | "updatedAt"> }
> = {
    [K in keyof TEntities as K extends string ? PluralizeType<K> : never]: K extends keyof TCreateInputs
    ? EntityMethods<TEntities[K], TCreateInputs[K]>
    : EntityMethods<TEntities[K]>
  }

/**
 * Simple type-level pluralization
 * Handles common cases: user -> users, category -> categories
 */
type PluralizeType<T extends string> =
  T extends `${infer Start}y`
  ? `${Start}ies`
  : T extends `${infer _}s`
  ? T
  : `${T}s`

/**
 * Create a typed client from server API type
 *
 * @example
 * ```ts
 * // Server (server.ts)
 * export const api = nevr({
 *   entities: [user, product, order],
 *   // ...
 * })
 * export type API = typeof api
 *
 * // Client (client.ts)
 * import type { API } from "../server"
 * import { createTypedClient } from "nevr/client"
 *
 * // Full type inference - no manual interfaces needed!
 * const client = createTypedClient<API>({
 *   baseURL: "http://localhost:3000",
 * })
 *
 * // Fully typed!
 * const { data } = await client.users.list()
 * const { data } = await client.products.get("123")
 * await client.auth.signIn({ email: "...", password: "..." })
 * ```
 */
export type TypedClient<TAPI> = TAPI extends { $Infer: { Entities: infer E } }
  ? E extends Record<string, unknown>
  ? InferEntitiesFromServer<E> & {
    // Auth is typically provided by auth plugin
    // Include if API has auth plugin
    $api: TAPI
  }
  : never
  : never

/**
 * Get entity names from server API as array type
 */
export type EntityNamesFromServer<TAPI> = TAPI extends { $Infer: { EntityNames: infer Names } }
  ? Names extends string
  ? Names[]
  : string[]
  : string[]
