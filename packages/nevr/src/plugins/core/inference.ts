// =============================================================================
// TYPE INFERENCE SYSTEM
// Unified type inference from server to client
// =============================================================================

import type { NevrPlugin, PluginSchema, PluginFieldDef, PluginFieldDefObject, EndpointDefinition } from "./contract.js"
import type { Entity, FieldDef, FieldType } from "../../types.js"

// -----------------------------------------------------------------------------
// Field Type Mapping
// Maps Nevr field types to TypeScript types
// -----------------------------------------------------------------------------

export type FieldTypeToTS<T extends FieldType | PluginFieldDefObject["type"]> =
  T extends "string" | "text" ? string :
  T extends "int" | "float" ? number :
  T extends "boolean" ? boolean :
  T extends "datetime" ? Date :
  T extends "json" ? Record<string, unknown> :
  unknown

// -----------------------------------------------------------------------------
// Infer Entity Type from Schema
// Uses PluginFieldDefObject for type inference (FieldBuilder is runtime only)
// -----------------------------------------------------------------------------

export type InferEntityFromSchema<TSchema extends Record<string, PluginFieldDefObject>> = {
  [K in keyof TSchema]: TSchema[K]["required"] extends false
  ? FieldTypeToTS<TSchema[K]["type"]> | null
  : FieldTypeToTS<TSchema[K]["type"]>
} & { id: string }

// -----------------------------------------------------------------------------
// Infer All Entities from Plugin Schema
// Note: Type inference uses PluginFieldDefObject; FieldBuilder is resolved at runtime
// -----------------------------------------------------------------------------

export type InferEntitiesFromPluginSchema<TSchema extends PluginSchema> =
  TSchema["entities"] extends Record<string, { fields: infer TFields }>
  ? {
    [K in keyof TSchema["entities"]]: TSchema["entities"][K]["fields"] extends Record<string, PluginFieldDefObject>
    ? InferEntityFromSchema<TSchema["entities"][K]["fields"]>
    : Record<string, unknown> & { id: string } // Fallback for FieldBuilder-based schemas
  }
  : {}

// -----------------------------------------------------------------------------
// Infer Plugin Types
// Get all types from a plugin's $Infer
// -----------------------------------------------------------------------------

export type InferPluginTypes<TPlugin extends NevrPlugin> =
  TPlugin["$Infer"] extends Record<string, unknown>
  ? TPlugin["$Infer"]
  : {}

// -----------------------------------------------------------------------------
// Infer Endpoints from Plugin
// -----------------------------------------------------------------------------

export type InferPluginEndpoints<TPlugin extends NevrPlugin> =
  TPlugin["endpoints"] extends Record<string, EndpointDefinition>
  ? {
    [K in keyof TPlugin["endpoints"]]: {
      method: TPlugin["endpoints"][K]["method"]
      path: TPlugin["endpoints"][K]["path"]
      input: TPlugin["endpoints"][K]["input"]
      output: TPlugin["endpoints"][K]["output"]
    }
  }
  : {}

// -----------------------------------------------------------------------------
// Infer Error Codes from Plugin
// -----------------------------------------------------------------------------

export type InferPluginErrorCodes<TPlugin extends NevrPlugin> =
  TPlugin["$ERROR_CODES"] extends Record<string, string>
  ? keyof TPlugin["$ERROR_CODES"]
  : never

// -----------------------------------------------------------------------------
// Server Plugin Union
// Combines multiple plugins into a single type
// -----------------------------------------------------------------------------

export type MergePlugins<TPlugins extends NevrPlugin[]> = {
  entities: UnionToIntersection<InferEntitiesFromPluginSchema<NonNullable<TPlugins[number]["schema"]>>>
  types: UnionToIntersection<InferPluginTypes<TPlugins[number]>>
  endpoints: UnionToIntersection<InferPluginEndpoints<TPlugins[number]>>
  errorCodes: InferPluginErrorCodes<TPlugins[number]>
  plugins: TPlugins
}

// Helper: Convert union to intersection
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never

// -----------------------------------------------------------------------------
// Nevr Instance Type
// The type exported by the server that clients can infer from
// -----------------------------------------------------------------------------

export interface NevrInstanceType<
  TEntities extends Entity[] = Entity[],
  TPlugins extends NevrPlugin[] = NevrPlugin[]
> {
  /** All entities in the system */
  entities: TEntities

  /** All plugins registered */
  plugins: TPlugins

  /** Merged plugin data */
  $merged: MergePlugins<TPlugins>

  /** Inferred types */
  $types: {
    entities: InferEntitiesFromArray<TEntities>
    plugins: MergePlugins<TPlugins>["types"]
    endpoints: MergePlugins<TPlugins>["endpoints"]
    errorCodes: MergePlugins<TPlugins>["errorCodes"]
  }
}

// Infer entities from array
type InferEntitiesFromArray<TEntities extends Entity[]> = {
  [K in TEntities[number]["name"]]: Extract<TEntities[number], { name: K }> extends { config: { fields: infer F } }
  ? F extends Record<string, FieldDef>
  ? InferEntityFromFields<F>
  : never
  : never
}

type InferEntityFromFields<TFields extends Record<string, FieldDef>> = {
  [K in keyof TFields]: TFields[K]["optional"] extends true
  ? FieldTypeToTS<TFields[K]["type"]> | null
  : FieldTypeToTS<TFields[K]["type"]>
} & { id: string }

// -----------------------------------------------------------------------------
// Client Inference Types
// Used by the client to infer server types
// -----------------------------------------------------------------------------

/**
 * Infer server plugin for client
 * Inference helper
 */
export type InferServerPlugin<TServer extends NevrInstanceType> = TServer["$types"]

/**
 * Infer specific plugin from server
 */
export type InferPlugin<
  TServer extends NevrInstanceType,
  TPluginId extends string
> = Extract<TServer["plugins"][number], { meta: { id: TPluginId } }>

/**
 * Infer entity type from server
 */
export type InferEntity<
  TServer extends NevrInstanceType,
  TEntityName extends string
> = TServer["$types"]["entities"][TEntityName]

/**
 * Infer all endpoints from server
 */
export type InferEndpoints<TServer extends NevrInstanceType> = TServer["$types"]["endpoints"]

/**
 * Infer all error codes from server
 */
export type InferErrorCodes<TServer extends NevrInstanceType> = TServer["$types"]["errorCodes"]

// -----------------------------------------------------------------------------
// Path Method Inference
// Automatically infer HTTP methods for paths
// -----------------------------------------------------------------------------

export type InferPathMethods<TServer extends NevrInstanceType> = {
  [K in keyof TServer["$types"]["endpoints"]]: TServer["$types"]["endpoints"][K] extends { method: infer M, path: infer P }
  ? P extends string
  ? M extends "POST" | "GET" | "PUT" | "PATCH" | "DELETE"
  ? { path: P; method: M }
  : never
  : never
  : never
}[keyof TServer["$types"]["endpoints"]]

// Convert to path method map
export type PathMethodMap<TServer extends NevrInstanceType> = {
  [P in InferPathMethods<TServer>["path"]]: Extract<InferPathMethods<TServer>, { path: P }>["method"]
}

// -----------------------------------------------------------------------------
// API Route Inference
// Infer API routes from entities (entity-first approach)
// -----------------------------------------------------------------------------

export type InferEntityRoutes<TEntity extends Entity> = {
  list: {
    method: "GET"
    path: `/${Lowercase<TEntity["name"]>}s`
    output: { data: InferEntityFromFields<TEntity["config"]["fields"]>[]; pagination: { total: number; limit: number; offset: number } }
  }
  create: {
    method: "POST"
    path: `/${Lowercase<TEntity["name"]>}s`
    input: Omit<InferEntityFromFields<TEntity["config"]["fields"]>, "id">
    output: InferEntityFromFields<TEntity["config"]["fields"]>
  }
  read: {
    method: "GET"
    path: `/${Lowercase<TEntity["name"]>}s/:id`
    output: InferEntityFromFields<TEntity["config"]["fields"]>
  }
  update: {
    method: "PUT"
    path: `/${Lowercase<TEntity["name"]>}s/:id`
    input: Partial<Omit<InferEntityFromFields<TEntity["config"]["fields"]>, "id">>
    output: InferEntityFromFields<TEntity["config"]["fields"]>
  }
  delete: {
    method: "DELETE"
    path: `/${Lowercase<TEntity["name"]>}s/:id`
    output: void
  }
}

// -----------------------------------------------------------------------------
// Full Server Type Export
// This is what gets exported from the server for client inference
// -----------------------------------------------------------------------------

export type CreateServerType<
  TConfig extends { entities: Entity[]; plugins?: NevrPlugin[] }
> = NevrInstanceType<TConfig["entities"], NonNullable<TConfig["plugins"]>>

// -----------------------------------------------------------------------------
// Helper: Create type-safe server configuration
// -----------------------------------------------------------------------------

export function defineConfig<
  TEntities extends Entity[],
  TPlugins extends NevrPlugin[]
>(config: {
  entities: TEntities
  plugins?: TPlugins
}): { entities: TEntities; plugins: TPlugins } {
  return config as { entities: TEntities; plugins: TPlugins }
}

// -----------------------------------------------------------------------------
// Helper: Infer client from server
// Used in client setup
// -----------------------------------------------------------------------------

export type InferClientFromServer<TServer> = TServer extends NevrInstanceType<infer E, infer P>
  ? {
    entities: InferEntitiesFromArray<E>
    plugins: P
    endpoints: MergePlugins<P>["endpoints"]
    errorCodes: MergePlugins<P>["errorCodes"]
  }
  : never

// -----------------------------------------------------------------------------
// $Infer Pattern
// Simple type inference from server to client
// -----------------------------------------------------------------------------

/**
 * Extract $Infer types from a Nevr server instance
 * Type inference pattern
 *
 * @example
 * ```typescript
 * // server.ts
 * export const api = nevr({
 *   entities: [user, post],
 *   plugins: [authPlugin],
 * })
 *
 * export type API = typeof api
 *
 * // client.ts (can be in separate package)
 * import type { API } from "./server"
 * import type { $Infer } from "nevr"
 *
 * type User = $Infer<API>["entities"]["user"]
 * type Post = $Infer<API>["entities"]["post"]
 * type Endpoints = $Infer<API>["endpoints"]
 * ```
 */
export type $Infer<TServer> = TServer extends { entities: Map<string, Entity>; plugins: infer P }
  ? P extends NevrPlugin[]
  ? {
    /** All entity types */
    entities: InferAllEntities<TServer>
    /** All plugin endpoints */
    endpoints: MergePlugins<P>["endpoints"]
    /** All error codes from plugins */
    errorCodes: MergePlugins<P>["errorCodes"]
    /** Plugin-specific types */
    plugins: MergePlugins<P>["types"]
  }
  : never
  : never

// Infer entities from NevrInstance (Map-based)
type InferAllEntities<TServer> = TServer extends { entities: Map<string, Entity> }
  ? {
    [K in EntityNamesFromMap<TServer>]: InferEntityByName<TServer, K>
  }
  : {}

// Get entity names from Map
type EntityNamesFromMap<TServer> = TServer extends { config: { entities: Array<infer E> } }
  ? E extends Entity
  ? E["name"]
  : never
  : string

// Infer single entity by name
type InferEntityByName<TServer, TName extends string> = TServer extends { config: { entities: Array<infer E> } }
  ? E extends Entity
  ? E["name"] extends TName
  ? E extends { config: { fields: infer F } }
  ? F extends Record<string, FieldDef>
  ? InferEntityFromFields<F>
  : never
  : never
  : never
  : never
  : never

// -----------------------------------------------------------------------------
// Simplified Entity Inference
// Direct entity type extraction
// -----------------------------------------------------------------------------

/**
 * Infer entity data type from Entity definition
 *
 * @example
 * ```typescript
 * const user = entity("user", {
 *   email: string,
 *   name: string.optional(),
 * })
 *
 * type UserData = InferEntityData<typeof user>
 * // { id: string; email: string; name: string | null }
 * ```
 */
export type InferEntityData<TEntity extends Entity> = TEntity extends { config: { fields: infer F } }
  ? F extends Record<string, FieldDef>
  ? InferEntityFromFields<F>
  : never
  : never

/**
 * Infer create input type (excludes id field which is auto-generated)
 */
export type InferCreateInput<TEntity extends Entity> = TEntity extends { config: { fields: infer F } }
  ? F extends Record<string, FieldDef>
  ? {
    [K in keyof F as K extends "id" ? never : K]: F[K]["optional"] extends true
    ? FieldTypeToTS<F[K]["type"]> | undefined
    : FieldTypeToTS<F[K]["type"]>
  }
  : never
  : never

/**
 * Infer update input type (all fields optional, excludes id)
 */
export type InferUpdateInput<TEntity extends Entity> = TEntity extends { config: { fields: infer F } }
  ? F extends Record<string, FieldDef>
  ? Partial<{
    [K in keyof F as K extends "id" ? never : K]: FieldTypeToTS<F[K]["type"]>
  }>
  : never
  : never

// -----------------------------------------------------------------------------
// Frontend-Friendly Type Helpers
// For use in React/Vue/Svelte components
// -----------------------------------------------------------------------------

/**
 * Extract entity list response type
 */
export type ListResponse<TEntity extends Entity> = {
  data: InferEntityData<TEntity>[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

/**
 * Extract single entity response type
 */
export type SingleResponse<TEntity extends Entity> = InferEntityData<TEntity>

/**
 * API response wrapper with error handling
 */
export type ApiResponse<TData> =
  | { data: TData; error: null }
  | { data: null; error: { code: string; message: string } }

// -----------------------------------------------------------------------------
// Type-Safe API Path Helper
// Generate typed paths from entity name
// -----------------------------------------------------------------------------

/**
 * Generate CRUD paths for an entity
 */
export type EntityPaths<TName extends string> = {
  list: `/${Lowercase<TName>}s`
  create: `/${Lowercase<TName>}s`
  read: `/${Lowercase<TName>}s/${string}`
  update: `/${Lowercase<TName>}s/${string}`
  delete: `/${Lowercase<TName>}s/${string}`
}

// -----------------------------------------------------------------------------
// DX Helper Types
// Simplified type extraction for better developer experience
// -----------------------------------------------------------------------------

/**
 * Extract entity type from API by name
 * Cleaner alternative to Api["$Infer"]["Entities"]["user"]
 *
 * @example
 * ```typescript
 * import type { EntityOf } from "nevr"
 * import type { Api } from "./server"
 *
 * type User = EntityOf<Api, "user">
 * type Product = EntityOf<Api, "product">
 * ```
 */
export type EntityOf<TApi, TName extends string> =
  TApi extends { $Infer: { Entities: infer E } }
  ? TName extends keyof E
  ? E[TName]
  : never
  : never

/**
 * Extract all entity names from API as union type
 *
 * @example
 * ```typescript
 * type Names = EntityNamesOf<Api>
 * // "user" | "product" | "order"
 * ```
 */
export type EntityNamesOf<TApi> =
  TApi extends { $Infer: { EntityNames: infer N } }
  ? N
  : never

/**
 * Extract all entities as a mapped type
 *
 * @example
 * ```typescript
 * type Entities = EntitiesOf<Api>
 * // { user: User; product: Product; order: Order }
 * ```
 */
export type EntitiesOf<TApi> =
  TApi extends { $Infer: { Entities: infer E } }
  ? E
  : never
