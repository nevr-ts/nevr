// =============================================================================
// PLUGIN CONTRACT
// The core interface and types that ALL Nevr plugins must follow
// =============================================================================

import type { Entity, FieldDef, NevrInstance, NevrRequest, NevrResponse, Operation, User, Route, Middleware, Hooks } from "../../types.js"
import type { RequestHooks, DatabaseHooks, PluginInitReturn, NevrContext, NevrMiddleware, HookEndpointContext } from "./api.js"

// -----------------------------------------------------------------------------
// Plugin Metadata
// -----------------------------------------------------------------------------

export interface PluginMeta {
  /** Unique plugin identifier (e.g., "auth", "payments", "storage") */
  id: string

  /** Human-readable plugin name */
  name: string

  /** Semantic version (e.g., "1.0.0") */
  version: string

  /** Plugin description */
  description?: string

  /** Author or maintainer */
  author?: string

  /** Plugin homepage or documentation URL */
  homepage?: string

  /** Required Nevr version (semver range) */
  nevrVersion?: string

  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[]

  /**
   * Base path for plugin routes (e.g., "/auth", "/payments")
   * If not provided, defaults to "/" + id (e.g., "/auth" for id="auth")
   * Set to false to disable base path (routes at root like non-plugin entities)
   */
  basePath?: string | false
}

// -----------------------------------------------------------------------------
// Plugin Schema Definition
// Defines the tables/entities a plugin provides
// -----------------------------------------------------------------------------

export interface PluginFieldDefObject {
  type: "string" | "text" | "int" | "float" | "boolean" | "datetime" | "json"
  required?: boolean
  unique?: boolean
  default?: unknown
  /** If true, developer MUST NOT remove this field */
  locked?: boolean
  /** Field description for documentation */
  description?: string
  /** Reference to another entity (creates foreign key) */
  references?: {
    entity: string
    field?: string  // defaults to "id"
  }

  // -------------------------------------------------------------------------
  // Safety Attributes
  // -------------------------------------------------------------------------

  /**
   * If false, this field cannot be set by client requests.
   * Protected fields can only be set by server-side code/plugins.
   * @default true
   *
   * @example
   * role: { type: "string", input: false } // Can't be set by client
   * stripeCustomerId: { type: "string", input: false } // Protected
   */
  input?: boolean

  /**
   * If false, this field is not returned in API responses.
   * Use for sensitive data like passwords.
   * @default true
   *
   * @example
   * password: { type: "string", returned: false } // Never sent to client
   */
  returned?: boolean

  /**
   * Transform functions for input/output
   * Applied automatically by the framework
   */
  transform?: {
    /** Transform value before saving to database */
    input?: (value: unknown) => unknown | Promise<unknown>
    /** Transform value before sending to client */
    output?: (value: unknown) => unknown | Promise<unknown>
  }

  /**
   * Called when the entity is updated
   * Useful for auto-updating timestamps
   */
  onUpdate?: () => unknown

  /**
   * Whether this field is sortable in queries
   * @default false
   */
  sortable?: boolean

  /**
   * Whether to create an index on this field
   * @default false
   */
  index?: boolean
}

// Import FieldBuilder family for Entity-First support
import { FieldBuilder, RelationBuilder, SelfRefBuilder } from "../../fields.js"

/**
 * Plugin field definition - supports both plain objects AND FieldBuilder
 * This enables Entity-First plugin development using Nevr's rich field DSL
 * 
 * @example
 * ```typescript
 * // Plain object (backward compatible)
 * password: { type: "string", input: false, returned: false }
 * 
 * // FieldBuilder (Entity-First, recommended)
 * password: string.password().omit()
 * email: string.email().trim().lower()
 * ```
 */
export type PluginFieldDef = PluginFieldDefObject | FieldBuilder | RelationBuilder | SelfRefBuilder

export interface PluginEntityDef {
  /** Entity fields */
  fields: Record<string, PluginFieldDef>

  /**
   * Entity actions (custom operations and workflows)
   * These become routes: POST /plugin/entities/:id/action-name
   * Uses the same system as regular entity actions
   */
  actions?: Record<string, import("../../types.js").EntityAction>

  /**
   * Authorization rules for CRUD operations
   * Same as regular entity rules
   */
  rules?: Partial<Record<import("../../types.js").Operation, import("../../types.js").RuleDef[]>>

  /**
   * Cross-field validators
   * Same as regular entity validators
   */
  validators?: import("../../types.js").EntityValidator[]

  /** If true, developer cannot remove this entity */
  required?: boolean

  /** If true, no CRUD routes are generated (plugin manages routes) */
  internal?: boolean

  /** Entity description for documentation */
  description?: string

  /**
   * Custom route path for this entity (relative to plugin basePath)
   * If not set, uses pluralized entity name
   * Example: "members" instead of default "users"
   */
  routePath?: string
}

export interface PluginSchema {
  /** 
   * Entities the plugin provides
   * Key is entity name (e.g., "session", "account")
   */
  entities?: Record<string, PluginEntityDef>

  /**
   * Fields to add to existing entities
   * Key is target entity name (e.g., "user")
   * Use "all" to add to all entities
   */
  extend?: Record<string, Record<string, PluginFieldDef>>
}

// -----------------------------------------------------------------------------
// Plugin Extension Options
// How developers can customize a plugin
// -----------------------------------------------------------------------------

export interface PluginExtensionFieldDef {
  /** Add a new field */
  add?: PluginFieldDef

  /** Rename the field (original name -> new name) */
  rename?: string

  /** Override field properties */
  override?: Partial<PluginFieldDef>

  /** Remove the field (only if not locked) */
  remove?: boolean
}

export interface PluginExtensionEntityDef {
  /** Modify existing fields */
  fields?: Record<string, PluginExtensionFieldDef>

  /** Add new fields directly */
  addFields?: Record<string, PluginFieldDef>

  /** Remove entity (only if not required) */
  remove?: boolean

  /** Rename the entity (e.g., rename "user" to "member") */
  rename?: string

  /** Override the route path for this entity */
  routePath?: string

  /** Make entity internal (no CRUD routes) */
  internal?: boolean
}

/** Route handler type for custom route implementations */
export type RouteHandler = (req: NevrRequest, nevr: NevrInstance) => Promise<NevrResponse>

/** Route configuration for overriding default CRUD routes */
export interface EntityRouteConfig {
  /** Disable this operation entirely */
  disable?: boolean
  /** Custom handler for this operation */
  handler?: RouteHandler
}

/** Per-entity route customization */
export interface EntityRoutesConfig {
  /** List operation (GET /entities) */
  list?: EntityRouteConfig | "disable" | RouteHandler
  /** Create operation (POST /entities) */
  create?: EntityRouteConfig | "disable" | RouteHandler
  /** Read operation (GET /entities/:id) */
  read?: EntityRouteConfig | "disable" | RouteHandler
  /** Update operation (PUT /entities/:id) */
  update?: EntityRouteConfig | "disable" | RouteHandler
  /** Delete operation (DELETE /entities/:id) */
  delete?: EntityRouteConfig | "disable" | RouteHandler
  /** Add custom routes */
  custom?: Route[]
}

export interface PluginExtension {
  /** Modify plugin's entities */
  entities?: Record<string, PluginExtensionEntityDef>

  /** Add completely new entities under this plugin's namespace */
  addEntities?: Record<string, PluginEntityDef>

  /**
   * Override plugin routes
   * Can be used to disable routes or provide custom handlers
   */
  routes?: {
    /** Route path -> "disable" | custom handler */
    [path: string]: "disable" | RouteHandler
  }

  /**
   * Override base path for this plugin instance
   * Takes precedence over meta.basePath
   */
  basePath?: string | false

  /**
   * Custom entity route configurations
   * Key is entity name, value is route configuration
   */
  entityRoutes?: Record<string, EntityRoutesConfig>
}

// -----------------------------------------------------------------------------
// Plugin Hooks (Lifecycle Events)
// -----------------------------------------------------------------------------

export interface PluginLifecycleHooks {
  /** Called when plugin is registered */
  onRegister?: (nevr: NevrInstance) => void | Promise<void>

  /** Called when Nevr instance is fully initialized */
  onInit?: (nevr: NevrInstance) => void | Promise<void>

  /** Called before each request (after middleware) */
  onRequest?: (req: NevrRequest, nevr: NevrInstance) => void | Promise<void>

  /** Called after each response is generated (before sending to client) */
  onResponse?: (req: NevrRequest, res: NevrResponse, nevr: NevrInstance) => void | Promise<void>

  /** Called when an error occurs */
  onError?: (error: Error, req: NevrRequest, nevr: NevrInstance) => void | Promise<void>

  /** Called when plugin is being shut down */
  onShutdown?: (nevr: NevrInstance) => void | Promise<void>
}

// -----------------------------------------------------------------------------
// Migration Types
// -----------------------------------------------------------------------------

export interface PluginMigration {
  /** Migration identifier (e.g., "001_initial", "002_add_username") */
  id: string
  /** Human-readable description */
  description?: string
  /** Migration version for ordering */
  version: number
  /** SQL or driver-agnostic migration up */
  up: (driver: any) => Promise<void>
  /** SQL or driver-agnostic migration down */
  down?: (driver: any) => Promise<void>
}

// -----------------------------------------------------------------------------
// OpenAPI Metadata Types
// -----------------------------------------------------------------------------

export interface OpenAPIParameter {
  name: string
  in: "query" | "path" | "header" | "cookie"
  required?: boolean
  description?: string
  schema?: {
    type: "string" | "number" | "integer" | "boolean" | "array" | "object"
    format?: string
    enum?: string[]
    items?: { type: string }
  }
}

export interface OpenAPIRequestBody {
  description?: string
  required?: boolean
  content?: {
    [contentType: string]: {
      schema: Record<string, any>
      example?: any
    }
  }
}

export interface OpenAPIResponse {
  description: string
  content?: {
    [contentType: string]: {
      schema: Record<string, any>
      example?: any
    }
  }
}

export interface OpenAPIMetadata {
  /** Operation ID for code generation */
  operationId?: string
  /** Short summary */
  summary?: string
  /** Detailed description */
  description?: string
  /** Tags for grouping */
  tags?: string[]
  /** Whether authentication is required */
  requiresAuth?: boolean
  /** Security schemes */
  security?: Array<Record<string, string[]>>
  /** Parameters */
  parameters?: OpenAPIParameter[]
  /** Request body */
  requestBody?: OpenAPIRequestBody
  /** Responses */
  responses?: Record<string, OpenAPIResponse>
  /** Deprecation status */
  deprecated?: boolean
}

// -----------------------------------------------------------------------------
// Endpoint Types (for type-safe API)
// -----------------------------------------------------------------------------

export interface EndpointInput {
  body?: Record<string, any>
  query?: Record<string, any>
  params?: Record<string, any>
}

export interface EndpointOutput {
  status: number
  body?: any
}

export interface EndpointDefinition<
  TInput extends EndpointInput = EndpointInput,
  TOutput = any
> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  input?: TInput
  output?: TOutput
  handler: (ctx: any) => Promise<TOutput>
  /** Middleware to apply to this endpoint */
  use?: NevrMiddleware[]
  /** OpenAPI metadata for documentation */
  metadata?: OpenAPIMetadata
}

// -----------------------------------------------------------------------------
// Request Hook Types (Before/After with Matchers)
// Request hooks allow intercepting endpoints before and after execution
// HookEndpointContext is imported from api.ts to avoid duplication
// -----------------------------------------------------------------------------

export interface PluginRequestHook {
  /** Matcher function to determine if hook applies */
  matcher: (context: HookEndpointContext) => boolean
  /** Handler middleware to execute */
  handler: NevrMiddleware
}

export interface PluginRequestHooks {
  /** Hooks run before endpoint handler */
  before?: PluginRequestHook[]
  /** Hooks run after endpoint handler */
  after?: PluginRequestHook[]
}

// -----------------------------------------------------------------------------
// Full Plugin Contract
// -----------------------------------------------------------------------------

export interface NevrPlugin<TOptions = any, TExtension = PluginExtension> {
  /** Plugin metadata */
  meta: PluginMeta

  /** Plugin schema (entities and field extensions) */
  schema?: PluginSchema

  /**
   * Database migrations for this plugin
   * Migrations are run in order based on version number
   */
  migrations?: PluginMigration[]

  /**
   * Request-level hooks with matchers
   * Allows intercepting specific endpoints
   */
  requestHooks?: PluginRequestHooks

  /** Lifecycle hooks */
  lifecycle?: PluginLifecycleHooks

  /**
   * Init function called during plugin initialization
   * Can return context modifications, options overrides, and database hooks
   * Can return context modifications, options overrides, and database hooks
   */
  init?: (ctx: NevrContext) => Promise<PluginInitReturn | void> | PluginInitReturn | void

  /**
   * Database hooks for entity operations
   * Database hooks for entity operations
   */
  databaseHooks?: DatabaseHooks

  /** Options passed to plugin factory */
  options?: TOptions

  /** Extension applied by developer */
  extension?: TExtension

  /**
   * Typed endpoints for client type inference
   * This is the key to the dual-plugin system
   */
  endpoints?: Record<string, EndpointDefinition>

  /**
   * Types to be inferred by the client
   * Used for schema inference
   */
  $Infer?: Record<string, any>

  /**
   * Error codes returned by this plugin
   */
  $ERROR_CODES?: Record<string, string>

  /**
   * Rate limit rules for this plugin
   */
  rateLimit?: {
    window: number
    max: number
    pathMatcher: (path: string) => boolean
  }[]

  /**
   * Custom adapter methods for database operations
   * Custom adapter methods for database operations
   */
  adapter?: {
    [key: string]: (...args: any[]) => Promise<any>
  }
}

// -----------------------------------------------------------------------------
// Plugin Factory Type
// The function signature for creating plugins
// -----------------------------------------------------------------------------

export type PluginFactory<TOptions = any> = (
  options?: TOptions & { extend?: PluginExtension }
) => NevrPlugin<TOptions>

// -----------------------------------------------------------------------------
// Plugin Registry Entry
// Stored in the global registry
// -----------------------------------------------------------------------------

export interface PluginRegistryEntry {
  plugin: NevrPlugin
  initialized: boolean
  error?: Error
}

// -----------------------------------------------------------------------------
// Resolved Plugin (After Extension Applied)
// -----------------------------------------------------------------------------

/** Entity metadata including plugin and routing information */
export interface ResolvedEntityMeta {
  /** Original entity name from plugin */
  originalName: string
  /** Plugin ID that owns this entity */
  pluginId: string
  /** Base path for routes (e.g., "/auth") */
  basePath: string
  /** Custom route path (overrides pluralized name) */
  routePath?: string
  /** If true, no CRUD routes generated */
  internal: boolean
  /** Route customizations */
  routeConfig?: EntityRoutesConfig
}

export interface ResolvedPlugin {
  meta: PluginMeta
  /** Resolved base path for this plugin */
  basePath: string
  entities: Entity[]
  /** Metadata for each entity (keyed by entity name) */
  entityMeta: Map<string, ResolvedEntityMeta>
  routes: Route[]
  middleware: Middleware[]
  hooks: Hooks
  lifecycle: PluginLifecycleHooks
  /** Route overrides from extension */
  routeOverrides?: PluginExtension["routes"]
  /** Entity route configs from extension */
  entityRoutes?: PluginExtension["entityRoutes"]
}
