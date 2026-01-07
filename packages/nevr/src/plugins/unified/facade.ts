// =============================================================================
// PLUGIN FACADE
// Unified API for plugin creation, detection, and management
// This is the recommended entry point for all plugin operations
// =============================================================================

import type { NevrInstance } from "../../types.js"
import type { NevrPlugin, PluginMeta, PluginFactory } from "../core/contract.js"
import type {
    UnifiedPlugin,
    UnifiedPluginMeta,
    LifecycleHooks,
    RequestInterceptors,
    EntityHooks,
    PluginSchema,
} from "./types.js"
import {
    normalizePlugin,
    normalizePlugins,
    isNewPlugin,
    isUnifiedPlugin,
    validateUnifiedPlugin,
} from "./compat.js"

// Re-export type guards for convenience
export { isNewPlugin, isUnifiedPlugin }

// -----------------------------------------------------------------------------
// Plugin Type Detection
// -----------------------------------------------------------------------------

export type PluginType = "unified" | "unknown"

/**
 * Detect the type of a plugin
 * Useful for debugging and conditional handling
 */
export function detectPluginType(plugin: any): PluginType {
    if (isUnifiedPlugin(plugin)) return "unified"
    return "unknown"
}

/**
 * Type guard to check if something is a valid plugin
 */
export function isValidPlugin(plugin: any): plugin is NevrPlugin | UnifiedPlugin {
    return isNewPlugin(plugin) || isUnifiedPlugin(plugin)
}

// -----------------------------------------------------------------------------
// Unified Plugin Creation
// -----------------------------------------------------------------------------

/**
 * Base options for creating a plugin (shared by static and factory modes)
 */
interface PluginBaseOptions {
    /** Plugin ID (lowercase alphanumeric with hyphens) */
    id: string
    /** Display name */
    name: string
    /** Semantic version */
    version: string
    /** Description */
    description?: string
    /** Plugin author */
    author?: string
    /** Homepage URL */
    homepage?: string
    /** Plugin dependencies */
    dependencies?: string[]
    /** Base path for routes */
    basePath?: string
}

/**
 * Static plugin content (non-factory mode)
 */
interface PluginStaticContent<TOptions = unknown> {
    /** Schema definitions */
    schema?: PluginSchema
    /** Lifecycle hooks */
    lifecycle?: LifecycleHooks
    /** Request interceptors */
    interceptors?: RequestInterceptors
    /** Entity hooks by entity name */
    entityHooks?: EntityHooks
    /** Custom plugin options (for typing) */
    options?: TOptions
    /** Typed endpoints for plugin-level operations */
    endpoints?: UnifiedPlugin["endpoints"]

    /** Type inference helper for plugin-specific types */
    $Infer?: Record<string, any>

    /** Error codes exported by the plugin */
    $ERROR_CODES?: Record<string, string>
}

/**
 * Options for creating a unified plugin
 * 
 * Supports THREE modes:
 * 1. Static: Just provide metadata + content → returns UnifiedPlugin
 * 2. Factory: Provide `factory` function → returns PluginFactory
 * 3. With validation: Add `validate` and `defaults` for complex plugins
 */
export type CreatePluginOptions<TOptions = unknown> =
    | (PluginBaseOptions & PluginStaticContent<TOptions>)
    | (PluginBaseOptions & {
        /** Default options (merged with user options) */
        defaults?: Partial<TOptions>
        /** Validate options before creating plugin */
        validate?: (options: TOptions) => string[] | void
        /** Factory function that creates plugin content from options */
        factory: (options: TOptions) => PluginStaticContent<TOptions>
    })

/**
 * Return type helper - if factory is present, return a factory function
 */
type CreatePluginReturn<T extends CreatePluginOptions<any>> =
    T extends { factory: any }
    ? PluginFactory<T extends CreatePluginOptions<infer O> ? O : unknown>
    : UnifiedPlugin<T extends CreatePluginOptions<infer O> ? O : unknown>

/**
 * Options for factory mode plugin creation
 */
type FactoryPluginOptions<TOptions> = PluginBaseOptions & {
    /** Default options (merged with user options) */
    defaults?: Partial<TOptions>
    /** Validate options before creating plugin */
    validate?: (options: TOptions) => string[] | void
    /** Factory function that creates plugin content from options */
    factory: (options: TOptions) => PluginStaticContent<TOptions>
}

/**
 * Create a unified plugin - THE ONE API for all plugin needs
 * 
 * @example Simple plugin (returns UnifiedPlugin)
 * ```typescript
 * const loggingPlugin = createPlugin({
 *   id: "logging",
 *   name: "Logging",
 *   version: "1.0.0",
 *   lifecycle: { onRequest: async (req) => console.log(req.path) }
 * })
 * ```
 * 
 * @example Configurable plugin (returns PluginFactory)
 * ```typescript
 * const rateLimitPlugin = createPlugin<{ max: number }>({
 *   id: "rate-limit",
 *   name: "Rate Limiter",
 *   version: "1.0.0",
 *   defaults: { max: 100 },
 *   validate: (opts) => {
 *     if (opts.max < 1) return ["max must be positive"]
 *   },
 *   factory: (opts) => ({
 *     interceptors: { before: [{ matcher: "**", handler: async () => {} }] }
 *   })
 * })
 * 
 * // Usage
 * const plugin = rateLimitPlugin({ max: 50 })
 * ```
 */
// Overload 1: Factory mode - returns PluginFactory
export function createPlugin<TOptions>(
    options: FactoryPluginOptions<TOptions>
): PluginFactory<TOptions>

// Overload 2: Static mode - returns UnifiedPlugin
export function createPlugin<TOptions = unknown>(
    options: PluginBaseOptions & PluginStaticContent<TOptions>
): UnifiedPlugin<TOptions>

// Implementation
export function createPlugin<TOptions = unknown>(
    options: CreatePluginOptions<TOptions>
): UnifiedPlugin<TOptions> | PluginFactory<TOptions> {
    // Detect if this is factory mode
    if ("factory" in options && typeof options.factory === "function") {
        return createPluginWithFactory(options as PluginBaseOptions & {
            defaults?: Partial<TOptions>
            validate?: (options: TOptions) => string[] | void
            factory: (options: TOptions) => PluginStaticContent<TOptions>
        })
    }

    // Static mode - create plugin directly
    return createStaticPlugin(options as PluginBaseOptions & PluginStaticContent<TOptions>)
}

/**
 * Create a static plugin (non-factory mode)
 */
function createStaticPlugin<TOptions>(
    options: PluginBaseOptions & PluginStaticContent<TOptions>
): UnifiedPlugin<TOptions> {
    const meta: UnifiedPluginMeta = {
        id: options.id,
        name: options.name,
        version: options.version,
        description: options.description,
        author: options.author,
        homepage: options.homepage,
        dependencies: options.dependencies,
        basePath: options.basePath,
    }

    const plugin: UnifiedPlugin<TOptions> = {
        meta,
        schema: options.schema,
        lifecycle: options.lifecycle,
        interceptors: options.interceptors,
        entityHooks: options.entityHooks,
        options: options.options,
        endpoints: options.endpoints,
    }

    const errors = validateUnifiedPlugin(plugin)
    if (errors.length > 0) {
        throw new Error(`[Nevr] Invalid plugin: ${errors.join(", ")}`)
    }

    return plugin
}

/**
 * Create a plugin factory (factory mode)
 */
function createPluginWithFactory<TOptions>(
    options: PluginBaseOptions & {
        defaults?: Partial<TOptions>
        validate?: (options: TOptions) => string[] | void
        factory: (options: TOptions) => PluginStaticContent<TOptions>
    }
): PluginFactory<TOptions> {
    const { id, name, version, description, author, homepage, dependencies, basePath, defaults, validate, factory } = options

    return (userOptions?: TOptions) => {
        // Merge options with defaults
        const mergedOptions = {
            ...defaults,
            ...userOptions,
        } as TOptions

        // Validate options
        if (validate) {
            const errors = validate(mergedOptions)
            if (errors && errors.length > 0) {
                throw new Error(`[Nevr] [${id}] Invalid options: ${errors.join(", ")}`)
            }
        }

        // Call factory to get plugin content
        const content = factory(mergedOptions)

        // Build the plugin
        const meta: UnifiedPluginMeta = {
            id,
            name,
            version,
            description,
            author,
            homepage,
            dependencies,
            basePath,
        }

        const plugin: UnifiedPlugin<TOptions> & {
            $Infer?: Record<string, any>
            $ERROR_CODES?: Record<string, string>
        } = {
            meta,
            schema: content.schema,
            lifecycle: content.lifecycle,
            interceptors: content.interceptors,
            entityHooks: content.entityHooks,
            options: mergedOptions,
            endpoints: content.endpoints,
            ...(content.$Infer && { $Infer: content.$Infer }),
            ...(content.$ERROR_CODES && { $ERROR_CODES: content.$ERROR_CODES }),
        }

        const pluginErrors = validateUnifiedPlugin(plugin)
        if (pluginErrors.length > 0) {
            throw new Error(`[Nevr] [${id}] Invalid plugin: ${pluginErrors.join(", ")}`)
        }

        return plugin as unknown as NevrPlugin<TOptions>
    }
}

/**
 * Create a plugin factory for dynamic plugin creation
 * 
 * @deprecated Use `createPlugin` with `factory` option instead:
 * ```typescript
 * const plugin = createPlugin<Options>({
 *   id: "my-plugin",
 *   name: "My Plugin",
 *   version: "1.0.0",
 *   factory: (opts) => ({ ... })
 * })
 * ```
 * 
 * @example
 * ```typescript
 * interface RateLimitOptions {
 *   maxRequests: number
 *   windowMs: number
 * }
 * 
 * const rateLimitPlugin = createPluginFactory<RateLimitOptions>((options) => ({
 *   id: "rate-limit",
 *   name: "Rate Limiter",
 *   version: "1.0.0",
 *   interceptors: {
 *     before: [{
 *       matcher: "**",
 *       handler: async (ctx) => {
 *         // Use options.maxRequests, options.windowMs
 *       }
 *     }]
 *   }
 * }))
 * 
 * // Usage
 * const plugin = rateLimitPlugin({ maxRequests: 100, windowMs: 60000 })
 * ```
 */
export function createPluginFactory<TOptions>(
    factory: (options: TOptions) => CreatePluginOptions<TOptions>
): PluginFactory<TOptions> {
    return (options?: TOptions) => {
        const pluginOptions = factory(options as TOptions)
        return createPlugin(pluginOptions) as unknown as NevrPlugin<TOptions>
    }
}

// -----------------------------------------------------------------------------
// Plugin Normalization (Re-export from compat)
// -----------------------------------------------------------------------------

export { normalizePlugin, normalizePlugins, validateUnifiedPlugin }

// -----------------------------------------------------------------------------
// Plugin Registration Helper
// -----------------------------------------------------------------------------

export type AnyPlugin = NevrPlugin | UnifiedPlugin

/**
 * Process and normalize any plugin for registration
 * Returns the normalized plugin and any errors
 */
export function processPlugin(plugin: AnyPlugin): {
    normalized: UnifiedPlugin
    type: PluginType
    errors: string[]
} {
    const type = detectPluginType(plugin)

    if (type === "unknown") {
        return {
            normalized: plugin as UnifiedPlugin,
            type,
            errors: ["Unknown plugin format - cannot normalize"]
        }
    }

    const normalized = normalizePlugin(plugin)
    const errors = validateUnifiedPlugin(normalized)

    return { normalized, type, errors }
}

/**
 * Process multiple plugins
 */
export function processPlugins(plugins: AnyPlugin[]): {
    normalized: UnifiedPlugin[]
    errors: Map<string, string[]>
} {
    const normalized: UnifiedPlugin[] = []
    const errors = new Map<string, string[]>()

    for (const plugin of plugins) {
        const result = processPlugin(plugin)

        if (result.errors.length > 0) {
            const id = result.normalized.meta?.id || "unknown"
            errors.set(id, result.errors)
        }

        normalized.push(result.normalized)
    }

    return { normalized, errors }
}

// -----------------------------------------------------------------------------
// Convenience Creators
// -----------------------------------------------------------------------------

/**
 * Create a simple plugin with just lifecycle hooks
 * 
 * @example
 * ```typescript
 * const loggingPlugin = createLifecyclePlugin({
 *   id: "logging",
 *   name: "Request Logger",
 *   version: "1.0.0",
 *   onInit: async (nevr) => {
 *     console.log("Logger initialized")
 *   },
 *   onRequest: async (req, nevr) => {
 *     console.log(`${req.method} ${req.path}`)
 *   }
 * })
 * ```
 */
export function createLifecyclePlugin(options: {
    id: string
    name: string
    version: string
    description?: string
    onRegister?: LifecycleHooks["onRegister"]
    onInit?: LifecycleHooks["onInit"]
    onRequest?: LifecycleHooks["onRequest"]
    onError?: LifecycleHooks["onError"]
    onShutdown?: LifecycleHooks["onShutdown"]
}): UnifiedPlugin {
    return createStaticPlugin({
        id: options.id,
        name: options.name,
        version: options.version,
        description: options.description,
        lifecycle: {
            onRegister: options.onRegister,
            onInit: options.onInit,
            onRequest: options.onRequest,
            onError: options.onError,
            onShutdown: options.onShutdown,
        }
    })
}

/**
 * Create a plugin with entity hooks only
 * 
 * @example
 * ```typescript
 * const timestampPlugin = createEntityHooksPlugin({
 *   id: "timestamps",
 *   name: "Auto Timestamps",
 *   version: "1.0.0",
 *   hooks: {
 *     "*": {
 *       create: {
 *         before: async (ctx) => {
 *           ctx.data.createdAt = new Date()
 *         }
 *       }
 *     }
 *   }
 * })
 * ```
 */
export function createEntityHooksPlugin(options: {
    id: string
    name: string
    version: string
    description?: string
    hooks: EntityHooks
}): UnifiedPlugin {
    return createStaticPlugin({
        id: options.id,
        name: options.name,
        version: options.version,
        description: options.description,
        entityHooks: options.hooks,
    })
}

/**
 * Create a plugin with request interceptors
 * 
 * @example
 * ```typescript
 * const corsPlugin = createInterceptorPlugin({
 *   id: "cors",
 *   name: "CORS Handler",
 *   version: "1.0.0",
 *   before: [{
 *     matcher: "**",
 *     handler: async (ctx) => {
 *       ctx.setResponseHeader("Access-Control-Allow-Origin", "*")
 *     }
 *   }]
 * })
 * ```
 */
export function createInterceptorPlugin(options: {
    id: string
    name: string
    version: string
    description?: string
    before?: RequestInterceptors["before"]
    after?: RequestInterceptors["after"]
}): UnifiedPlugin {
    return createStaticPlugin({
        id: options.id,
        name: options.name,
        version: options.version,
        description: options.description,
        interceptors: {
            before: options.before,
            after: options.after,
        }
    })
}
