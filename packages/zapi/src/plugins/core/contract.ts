// =============================================================================
// PLUGIN CONTRACT
// The core interface and types that ALL Nevr plugins must follow
// =============================================================================

import type { Entity, FieldDef, Route, Middleware, ZapiInstance, ZapiRequest, Hooks } from "../../types.js"

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
  
  /** Required Zapi version (semver range) */
  zapiVersion?: string
  
  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[]
}

// -----------------------------------------------------------------------------
// Plugin Schema Definition
// Defines the tables/entities a plugin provides
// -----------------------------------------------------------------------------

export interface PluginFieldDef {
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
}

export interface PluginEntityDef {
  /** Entity fields */
  fields: Record<string, PluginFieldDef>
  
  /** If true, developer cannot remove this entity */
  required?: boolean
  
  /** If true, no CRUD routes are generated (plugin manages routes) */
  internal?: boolean
  
  /** Entity description for documentation */
  description?: string
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
}

export interface PluginExtension {
  /** Modify plugin's entities */
  entities?: Record<string, PluginExtensionEntityDef>
  
  /** Add completely new entities under this plugin's namespace */
  addEntities?: Record<string, PluginEntityDef>
  
  /** Override plugin routes */
  routes?: {
    /** Route path -> "disable" | custom handler */
    [path: string]: "disable" | ((req: ZapiRequest, zapi: ZapiInstance) => Promise<any>)
  }
}

// -----------------------------------------------------------------------------
// Plugin Hooks (Lifecycle Events)
// -----------------------------------------------------------------------------

export interface PluginLifecycleHooks {
  /** Called when plugin is registered */
  onRegister?: (zapi: ZapiInstance) => void | Promise<void>
  
  /** Called when Zapi instance is fully initialized */
  onInit?: (zapi: ZapiInstance) => void | Promise<void>
  
  /** Called before each request (after middleware) */
  onRequest?: (req: ZapiRequest, zapi: ZapiInstance) => void | Promise<void>
  
  /** Called when an error occurs */
  onError?: (error: Error, req: ZapiRequest, zapi: ZapiInstance) => void | Promise<void>
  
  /** Called when plugin is being shut down */
  onShutdown?: (zapi: ZapiInstance) => void | Promise<void>
}

// -----------------------------------------------------------------------------
// Full Plugin Contract
// -----------------------------------------------------------------------------

export interface ZapiPlugin<TOptions = any, TExtension = PluginExtension> {
  /** Plugin metadata */
  meta: PluginMeta
  
  /** Plugin schema (entities and field extensions) */
  schema?: PluginSchema
  
  /** Routes the plugin provides */
  routes?: Route[] | ((zapi: ZapiInstance) => Route[])
  
  /** Middleware the plugin provides */
  middleware?: Middleware[] | ((zapi: ZapiInstance) => Middleware[])
  
  /** Entity-level hooks (beforeCreate, afterUpdate, etc.) */
  hooks?: Hooks
  
  /** Lifecycle hooks */
  lifecycle?: PluginLifecycleHooks
  
  /** Options passed to plugin factory */
  options?: TOptions
  
  /** Extension applied by developer */
  extension?: TExtension
}

// -----------------------------------------------------------------------------
// Plugin Factory Type
// The function signature for creating plugins
// -----------------------------------------------------------------------------

export type PluginFactory<TOptions = any> = (
  options?: TOptions & { extend?: PluginExtension }
) => ZapiPlugin<TOptions>

// -----------------------------------------------------------------------------
// Plugin Registry Entry
// Stored in the global registry
// -----------------------------------------------------------------------------

export interface PluginRegistryEntry {
  plugin: ZapiPlugin
  initialized: boolean
  error?: Error
}

// -----------------------------------------------------------------------------
// Resolved Plugin (After Extension Applied)
// -----------------------------------------------------------------------------

export interface ResolvedPlugin {
  meta: PluginMeta
  entities: Entity[]
  routes: Route[]
  middleware: Middleware[]
  hooks: Hooks
  lifecycle: PluginLifecycleHooks
}
