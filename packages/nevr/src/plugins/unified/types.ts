// =============================================================================
// UNIFIED PLUGIN TYPES
// Unified interface combining legacy and new plugin systems
// =============================================================================

import type {
    Entity,
    FieldDef,
    Route,
    Middleware,
    Hooks,
    NevrInstance,
    NevrRequest,
    NevrResponse,
    Driver,
    User,
} from "../../types.js"

import { FieldBuilder, RelationBuilder, SelfRefBuilder } from "../../fields.js"
import type { EndpointDefinition } from "./endpoint.js"

// -----------------------------------------------------------------------------
// Path Matcher Types
// -----------------------------------------------------------------------------

/**
 * Flexible path matching for interceptors
 * - string: exact match or glob pattern
 * - RegExp: regex pattern
 * - function: custom matcher
 */
export type PathMatcher =
    | string
    | RegExp
    | ((ctx: InterceptorContext) => boolean)

// -----------------------------------------------------------------------------
// Plugin Dependency Types
// -----------------------------------------------------------------------------

/**
 * Rich dependency specification with version constraints and optional flag
 */
export interface PluginDependency {
    /** Plugin ID to depend on */
    id: string

    /** Semver version range (e.g., "^1.0.0", ">=2.0.0") */
    version?: string

    /** If true, plugin works without this dependency but is enhanced with it */
    optional?: boolean
}

/**
 * Simple or rich dependency specification
 */
export type DependencySpec = string | PluginDependency

// -----------------------------------------------------------------------------
// Unified Plugin Metadata
// -----------------------------------------------------------------------------

export interface UnifiedPluginMeta {
    /** Unique plugin identifier (e.g., "auth", "payments") */
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

    /**
     * Plugin dependencies (other plugin IDs or rich specifications)
     * Can be simple strings or objects with version/optional constraints
     *
     * @example
     * ```typescript
     * // Simple dependencies
     * dependencies: ["auth", "storage"]
     *
     * // Rich dependencies with version constraints
     * dependencies: [
     *   { id: "auth", version: "^1.0.0" },
     *   { id: "storage", version: "*", optional: true }
     * ]
     * ```
     */
    dependencies?: DependencySpec[]

    /**
     * Base path for plugin routes (e.g., "/auth", "/payments")
     * Set to false to disable base path (routes at root)
     * @default "/" + id
     */
    basePath?: string | false
}

// -----------------------------------------------------------------------------
// Entity Hooks (Unified CRUD Hooks)
// -----------------------------------------------------------------------------

export interface EntityHookContext<T = Record<string, unknown>> {
    /** Entity data */
    data: T

    /** Existing data (for updates) */
    existingData?: T

    /** Current user */
    user?: User | null

    /** Database driver */
    driver: Driver

    /** Nevr context */
    context: {
        nevr: NevrInstance
        [key: string]: unknown
    }
}

export interface EntityHook<T = Record<string, unknown>> {
    /**
     * Called before operation
     * Can modify data by returning { data: modifiedData }
     */
    before?: (ctx: EntityHookContext<T>) => Promise<{ data: T } | void> | { data: T } | void

    /**
     * Called after operation
     * Cannot modify data (operation already completed)
     */
    after?: (ctx: EntityHookContext<T>) => Promise<void> | void
}

export interface EntityHooks {
    /** Hooks for specific entities */
    [entityName: string]: {
        create?: EntityHook
        update?: EntityHook
        delete?: EntityHook
    }
}

// -----------------------------------------------------------------------------
// Request Interceptors (unified before/after hooks)
// -----------------------------------------------------------------------------

export interface InterceptorContext {
    /** Request path */
    path: string

    /** HTTP method */
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

    /** Request body */
    body?: Record<string, unknown>

    /** Query parameters */
    query?: Record<string, unknown>

    /** URL parameters */
    params?: Record<string, string>

    /** Request headers */
    headers?: Record<string, string | undefined>

    /** Authenticated user */
    user?: User | null

    /** Nevr context */
    context: {
        nevr: NevrInstance
        driver: Driver
        [key: string]: unknown
    }

    /** After interceptors only: response returned */
    returned?: unknown

    /** Response headers to add */
    responseHeaders?: Record<string, string>

    /** Set a response header */
    setHeader(name: string, value: string): void

    /** Get response headers */
    getResponseHeaders(): Record<string, string>
}

export type InterceptorHandler = (
    ctx: InterceptorContext
) => Promise<void> | void

export interface Interceptor {
    /** Matcher to determine if interceptor applies */
    matcher: PathMatcher

    /** Handler to execute if matcher returns true */
    handler: InterceptorHandler
}

export interface RequestInterceptors {
    /** Interceptors executed before endpoint handler */
    before?: Interceptor[]

    /** Interceptors executed after endpoint handler */
    after?: Interceptor[]
}

// -----------------------------------------------------------------------------
// Lifecycle Hooks
// -----------------------------------------------------------------------------

export interface LifecycleHooks {
    /**
     * Called when plugin factory creates instance
     * Use for one-time setup independent of Nevr instance
     */
    onCreate?: (options: any) => void | Promise<void>

    /**
     * Called when plugin registered to Nevr instance
     * Use to register services, validate config
     */
    onRegister?: (nevr: NevrInstance) => void | Promise<void>

    /**
     * Called when Nevr instance fully initialized
     * Use to start connections, background tasks
     */
    onInit?: (nevr: NevrInstance) => void | Promise<void>

    /**
     * Called on every request (after global middleware)
     * Use for logging, request modification
     */
    onRequest?: (req: NevrRequest, nevr: NevrInstance) => void | Promise<void>

    /**
     * Called when error occurs
     * Use for error reporting, logging
     */
    onError?: (error: Error, req: NevrRequest, nevr: NevrInstance) => void | Promise<void>

    /**
     * Called when server shutting down
     * Use to close connections, cleanup resources
     */
    onShutdown?: (nevr: NevrInstance) => void | Promise<void>

    /**
     * Called when hot reload is triggered
     * Use to update configuration without full restart
     *
     * @example
     * ```typescript
     * lifecycle: {
     *   onHotReload: async (nevr, newOptions) => {
     *     // Update plugin state with new options
     *     await updateAuthConfig(newOptions)
     *   }
     * }
     * ```
     */
    onHotReload?: (nevr: NevrInstance, newOptions: any) => void | Promise<void>
}

// -----------------------------------------------------------------------------
// Schema Types (Entity-First: supports both plain objects AND FieldBuilder)
// -----------------------------------------------------------------------------

/**
 * Plain field definition for backward compatibility
 */
export interface FieldDefinitionObject {
    type: "string" | "text" | "int" | "float" | "boolean" | "datetime" | "json"
    required?: boolean
    unique?: boolean
    default?: unknown
    locked?: boolean
    description?: string
    references?: {
        entity: string
        field?: string
    }
    // Field attributes
    input?: boolean
    returned?: boolean
    transform?: {
        input?: (value: unknown) => unknown | Promise<unknown>
        output?: (value: unknown) => unknown | Promise<unknown>
    }
    onUpdate?: () => unknown
    sortable?: boolean
    index?: boolean
}

/**
 * Field definition - supports both plain objects AND FieldBuilder
 * This enables Entity-First plugin development using Nevr's rich field DSL
 * 
 * @example
 * ```typescript
 * // Plain object (backward compatible)
 * { type: "string", required: true, input: false }
 * 
 * // FieldBuilder (Entity-First, recommended)
 * string.password().omit()
 * string.email().trim().lower()
 * int.min(0).max(100)
 * ```
 */
export type FieldDefinition = FieldDefinitionObject | FieldBuilder<any, any, any> | RelationBuilder | SelfRefBuilder

export interface EntityDefinition {
    fields: Record<string, FieldDefinition>
    required?: boolean
    internal?: boolean
    description?: string
    routePath?: string
}

export interface PluginSchema {
    /** Entities the plugin provides */
    entities?: Record<string, EntityDefinition>

    /** Fields to add to existing entities */
    extend?: Record<string, Record<string, FieldDefinition>>

    /** 
     * Entity-First: Actions defined on entities
     * Map of entity name -> actions for that entity
     * @example
     * ```typescript
     * entityActions: {
     *   user: {
     *     signUp: action("sign-up").post().input({...}),
     *     signIn: action("sign-in").post().input({...}),
     *   }
     * }
     * ```
     */
    entityActions?: Record<string, Record<string, unknown>>
}

// -----------------------------------------------------------------------------
// Migrations
// -----------------------------------------------------------------------------

export interface Migration {
    id: string
    description?: string
    version: number
    up: (driver: Driver) => Promise<void>
    down?: (driver: Driver) => Promise<void>
}

// -----------------------------------------------------------------------------
// Plugin Extension
// -----------------------------------------------------------------------------

export interface PluginExtension {
    /** Override base path */
    basePath?: string | false

    /** Modify entities */
    entities?: Record<string, {
        fields?: Record<string, {
            add?: FieldDefinition
            rename?: string
            override?: Partial<FieldDefinition>
            remove?: boolean
        }>
        addFields?: Record<string, FieldDefinition>
        remove?: boolean
        rename?: string
        routePath?: string
        internal?: boolean
    }>

    /** Add new entities */
    addEntities?: Record<string, EntityDefinition>

    /** Override routes */
    routes?: {
        [path: string]: "disable" | ((req: NevrRequest, nevr: NevrInstance) => Promise<NevrResponse>)
    }

    /** Entity route configurations */
    entityRoutes?: Record<string, {
        list?: "disable" | { disable?: boolean; handler?: Function }
        create?: "disable" | { disable?: boolean; handler?: Function }
        read?: "disable" | { disable?: boolean; handler?: Function }
        update?: "disable" | { disable?: boolean; handler?: Function }
        delete?: "disable" | { disable?: boolean; handler?: Function }
        custom?: Route[]
    }>
}

// -----------------------------------------------------------------------------
// Rate Limiting
// -----------------------------------------------------------------------------

export interface RateLimitRule {
    /** Time window in milliseconds */
    window: number

    /** Max requests per window */
    max: number

    /** Function to determine if rule applies to path */
    pathMatcher: (path: string) => boolean
}

// -----------------------------------------------------------------------------
// Unified Plugin Interface
// -----------------------------------------------------------------------------

export interface UnifiedPlugin<TOptions = any> {
    /** Plugin metadata */
    meta: UnifiedPluginMeta

    /** Schema definition */
    schema?: PluginSchema

    /** Database migrations */
    migrations?: Migration[]

    /** Lifecycle hooks */
    lifecycle?: LifecycleHooks

    /** Request interceptors with matchers */
    interceptors?: RequestInterceptors

    /** Entity CRUD hooks */
    entityHooks?: EntityHooks

    /** Plugin options */
    options?: TOptions

    /** Developer customizations */
    extension?: PluginExtension

    /** 
     * Typed endpoints object (better-auth inspired)
     * Use endpoint() helper for type inference
     * 
     * @example
     * ```typescript
     * endpoints: {
     *   upgrade: endpoint("/upgrade", { method: "POST", input: {...}, handler }),
     *   cancel: endpoint("/:id/cancel", { method: "POST", handler }),
     * }
     * ```
     */
    endpoints?: Record<string, EndpointDefinition>

    /** Inferrable types */
    $Infer?: Record<string, any>

    /** Error codes */
    $ErrorCodes?: Record<string, string>

    /** Rate limiting rules */
    rateLimit?: RateLimitRule[]
}

// -----------------------------------------------------------------------------
// Plugin Factory
// -----------------------------------------------------------------------------

export type UnifiedPluginFactory<TOptions = any> = (
    options?: TOptions & { extend?: PluginExtension }
) => UnifiedPlugin<TOptions>

// -----------------------------------------------------------------------------
// Helper Types
// -----------------------------------------------------------------------------

/**
 * Type guard to check if plugin is unified
 */
export function isUnifiedPlugin(plugin: any): plugin is UnifiedPlugin {
    return plugin && typeof plugin === "object" && "meta" in plugin && typeof plugin.meta.id === "string"
}

/**
 * Extract options type from plugin factory
 */
export type InferPluginOptions<T> = T extends UnifiedPluginFactory<infer O> ? O : never
