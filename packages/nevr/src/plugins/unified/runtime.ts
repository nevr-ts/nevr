// =============================================================================
// UNIFIED PLUGIN RUNTIME
// Runtime functions for plugin execution - replaces legacy plugin.ts
// =============================================================================

import type {
    Entity,
    FieldDef,
    Middleware,
    Hooks,
    HookContext,
    NevrInstance,
    Route,
    Operation,
    User,
    Driver,
    Where,
} from "../../types.js"

import type { UnifiedPlugin } from "./types.js"
import { getLogger } from "../../logger.js"

// -----------------------------------------------------------------------------
// Plugin Registry (Unified plugins only)
// -----------------------------------------------------------------------------

const pluginRegistry = new Map<string, UnifiedPlugin>()

// Track which plugins were pre-registered (schema-only)
const preRegisteredPlugins = new Set<string>()

/**
 * Pre-register a plugin's schema at import time.
 * This allows plugin() references to work during generation,
 * before the full plugin is instantiated.
 * 
 * Call this as a side effect in your plugin's module.
 */
export function preRegisterPluginSchema(id: string, schema: UnifiedPlugin["schema"]): void {
    if (pluginRegistry.has(id)) {
        // Already registered (either pre-registered or fully registered)
        return
    }

    // Create a minimal plugin with just schema
    const minimalPlugin: UnifiedPlugin = {
        meta: {
            id,
            name: id,
            version: "0.0.0",
        },
        schema,
    }

    pluginRegistry.set(id, minimalPlugin)
    preRegisteredPlugins.add(id)
}

/**
 * Register a unified plugin globally
 */
export function registerPlugin(plugin: UnifiedPlugin): void {
    const id = plugin.meta?.id
    if (!id) {
        throw new Error("[Nevr] Plugin must have a meta.id")
    }

    // If this plugin was pre-registered, replace it with the full version
    if (preRegisteredPlugins.has(id)) {
        pluginRegistry.set(id, plugin)
        preRegisteredPlugins.delete(id)
        return
    }

    if (pluginRegistry.has(id)) {
        throw new Error(`[Nevr] Plugin "${id}" is already registered.`)
    }
    pluginRegistry.set(id, plugin)
}

/**
 * Unregister a plugin by ID
 */
export function unregisterPlugin(id: string): boolean {
    preRegisteredPlugins.delete(id)
    return pluginRegistry.delete(id)
}

/**
 * Get a registered plugin by ID
 */
export function getPlugin(id: string): UnifiedPlugin | undefined {
    return pluginRegistry.get(id)
}

/**
 * List all registered plugins
 */
export function listPlugins(): UnifiedPlugin[] {
    return Array.from(pluginRegistry.values())
}

/**
 * Clear the plugin registry (useful for testing)
 */
export function clearPluginRegistry(): void {
    pluginRegistry.clear()
    preRegisteredPlugins.clear()
}

/**
 * Check for plugin conflicts
 */
export function checkPluginConflicts(plugins: UnifiedPlugin[]): string[] {
    const conflicts: string[] = []
    const routeRegistry = new Map<string, string>()
    const entityRegistry = new Map<string, string>()

    for (const plugin of plugins) {
        const pluginId = plugin.meta?.id || "unknown"

        // Check endpoints
        if (plugin.endpoints) {
            for (const [name, endpoint] of Object.entries(plugin.endpoints)) {
                const basePath = plugin.meta?.basePath || `/${pluginId}`
                const key = `${endpoint.method}:${basePath}${endpoint.path}`
                if (routeRegistry.has(key)) {
                    conflicts.push(
                        `Route conflict: "${key}" is defined by both "${routeRegistry.get(key)}" and "${pluginId}"`
                    )
                } else {
                    routeRegistry.set(key, pluginId)
                }
            }
        }

        // Check entities from schema
        if (plugin.schema?.entities) {
            for (const entityName of Object.keys(plugin.schema.entities)) {
                if (entityRegistry.has(entityName)) {
                    conflicts.push(
                        `Entity conflict: "${entityName}" is defined by both "${entityRegistry.get(entityName)}" and "${pluginId}"`
                    )
                } else {
                    entityRegistry.set(entityName, pluginId)
                }
            }
        }
    }

    return conflicts
}

// -----------------------------------------------------------------------------
// Plugin Loading
// -----------------------------------------------------------------------------

/**
 * Apply plugin fields to entities (schema extensions)
 */
export function applyPluginFields(
    entities: Map<string, Entity>,
    plugins: UnifiedPlugin[]
): void {
    for (const plugin of plugins) {
        // Handle schema.extend for field extensions
        if (plugin.schema?.extend) {
            for (const [entityName, fields] of Object.entries(plugin.schema.extend)) {
                const entity = entities.get(entityName)
                if (entity && fields) {
                    // Convert FieldDefinition to FieldDef at runtime
                    for (const [fieldName, fieldDef] of Object.entries(fields)) {
                        // Handle FieldBuilder instances
                        if (typeof fieldDef === "object" && "build" in fieldDef && typeof fieldDef.build === "function") {
                            entity.config.fields[fieldName] = fieldDef.build()
                        } else if (typeof fieldDef === "object" && "type" in fieldDef) {
                            // Plain FieldDefinitionObject - convert to FieldDef
                            entity.config.fields[fieldName] = {
                                type: fieldDef.type,
                                optional: !fieldDef.required,
                                unique: fieldDef.unique || false,
                                default: fieldDef.default,
                                hasDefault: fieldDef.default !== undefined,
                            } as FieldDef
                        }
                    }
                }
            }
        }
    }
}

/**
 * Apply plugin entities to entity map
 */
export function applyPluginEntities(
    entities: Map<string, Entity>,
    plugins: UnifiedPlugin[]
): void {
    for (const plugin of plugins) {
        // Handle schema.entities
        if (plugin.schema?.entities) {
            for (const [entityName, entityDef] of Object.entries(plugin.schema.entities)) {
                const fields: Record<string, FieldDef> = {}

                for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
                    // Handle FieldBuilder instances
                    if (typeof fieldDef === "object" && "build" in fieldDef && typeof fieldDef.build === "function") {
                        fields[fieldName] = fieldDef.build()
                    } else if (typeof fieldDef === "object" && "type" in fieldDef) {
                        // Plain FieldDefinitionObject
                        fields[fieldName] = {
                            type: (fieldDef as any).type,
                            optional: !(fieldDef as any).required,
                            unique: (fieldDef as any).unique || false,
                            default: (fieldDef as any).default,
                            hasDefault: (fieldDef as any).default !== undefined,
                        } as FieldDef
                    }
                }

                entities.set(entityName, {
                    name: entityName,
                    config: {
                        fields,
                        rules: {},
                        timestamps: true,
                    },
                })
            }
        }
    }
}

/**
 * Collect all middleware from plugins (via interceptors)
 */
export function collectMiddleware(plugins: UnifiedPlugin[], nevr: NevrInstance): Middleware[] {
    const middleware: Middleware[] = []

    for (const plugin of plugins) {
        // Handle interceptors.before as middleware
        if (plugin.interceptors?.before) {
            for (const interceptor of plugin.interceptors.before) {
                middleware.push({
                    name: `${plugin.meta?.id || 'plugin'}-interceptor`,
                    handler: async (ctx, next) => {
                        await interceptor.handler(ctx as any)
                        await next()
                    },
                })
            }
        }
    }

    return middleware
}

/**
 * Collect all routes from plugins (via endpoints)
 */
export function collectRoutes(plugins: UnifiedPlugin[], nevr: NevrInstance): Route[] {
    const routes: Route[] = []

    for (const plugin of plugins) {
        // Handle endpoints{} pattern
        if (plugin.endpoints) {
            const basePath = plugin.meta?.basePath || `/${plugin.meta?.id || ''}`

            for (const [name, endpoint] of Object.entries(plugin.endpoints)) {
                const fullPath = basePath + endpoint.path
                routes.push({
                    method: endpoint.method,
                    path: fullPath,
                    handler: async (req: any) => {
                        // Create response headers storage
                        const responseHeaders: Record<string, string> = {}

                        // Call the endpoint handler with complete context
                        const ctx = {
                            // Validated body/input data
                            body: req.body || {},
                            input: req.body || req.query || {},
                            // Request object
                            request: req,
                            // User info
                            user: req.user || null,
                            // Database driver
                            driver: (nevr as any).driver,
                            // Headers and params
                            headers: req.headers || {},
                            params: req.params || {},
                            query: req.query || {},
                            // Plugin context
                            context: {
                                driver: (nevr as any).driver,
                            },
                            // Response helpers
                            setHeader: (name: string, value: string) => {
                                responseHeaders[name] = value
                            },
                            getResponseHeaders: () => responseHeaders,
                            json: <T>(data: T, status = 200) => ({
                                status,
                                body: data,
                                headers: responseHeaders,
                            }),
                            redirect: (url: string, status: 301 | 302 | 307 | 308 = 302) => ({
                                status,
                                body: undefined as any,
                                headers: { Location: url },
                            }),
                        }

                        try {
                            const result = await endpoint.handler(ctx as any)

                            // Handle response format (support both raw data and {status, body, headers})
                            if (result && typeof result === 'object' && 'status' in result && 'body' in result) {
                                const res = result as { status: number; body: unknown; headers?: Record<string, string> }
                                return {
                                    status: res.status,
                                    body: res.body,
                                    headers: { ...responseHeaders, ...(res.headers || {}) },
                                }
                            }
                            return { status: 200, body: result, headers: responseHeaders }
                        } catch (error) {
                            // Handle EndpointError properly
                            if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'EndpointError') {
                                const endpointError = error as unknown as { status: number; code: string; message: string; data?: Record<string, unknown> }
                                return {
                                    status: endpointError.status || 400,
                                    body: {
                                        error: endpointError.code || 'ERROR',
                                        message: endpointError.message,
                                        ...(endpointError.data && { data: endpointError.data }),
                                    },
                                    headers: responseHeaders,
                                }
                            }
                            // Re-throw other errors to be handled by nevr's handleError
                            throw error
                        }
                    },
                })
            }
        }
    }

    return routes
}

/**
 * Plugin initialization result
 */
export interface PluginInitResult {
    pluginId: string
    success: boolean
    error?: Error
}

/**
 * Initialize plugins (call lifecycle.onInit)
 * Returns results for each plugin initialization
 */
export async function initializePlugins(
    plugins: UnifiedPlugin[],
    nevr: NevrInstance
): Promise<PluginInitResult[]> {
    const results: PluginInitResult[] = []

    for (const plugin of plugins) {
        const pluginId = plugin.meta?.id || "unknown"

        try {
            // Call onRegister first
            if (plugin.lifecycle?.onRegister) {
                await plugin.lifecycle.onRegister(nevr)
            }
            // Then onInit
            if (plugin.lifecycle?.onInit) {
                await plugin.lifecycle.onInit(nevr)
            }

            results.push({ pluginId, success: true })
            getLogger().debug(`[Nevr] Plugin "${pluginId}" initialized successfully`)
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            results.push({ pluginId, success: false, error: err })
            getLogger().error(`[Nevr] Plugin "${pluginId}" failed to initialize:`, err)
        }
    }

    // Log summary if any plugins failed
    const failed = results.filter(r => !r.success)
    if (failed.length > 0) {
        getLogger().warn(`[Nevr] ${failed.length}/${plugins.length} plugins failed to initialize: ${failed.map(f => f.pluginId).join(", ")}`)
    }

    return results
}

// -----------------------------------------------------------------------------
// Hook Execution
// -----------------------------------------------------------------------------

/**
 * Execute a hook across all plugins
 */
export async function executeHook(
    hookName: keyof Hooks,
    ctx: HookContext,
    plugins: UnifiedPlugin[]
): Promise<void> {
    for (const plugin of plugins) {
        if (ctx.stopped) break

        // Check entity hooks for create/update/delete operations
        if (plugin.entityHooks && ctx.entity) {
            // Check for wildcard hooks first, then specific entity hooks
            const wildcardHooks = plugin.entityHooks["*"]
            const entityHooks = plugin.entityHooks[ctx.entity]

            for (const hooks of [wildcardHooks, entityHooks]) {
                if (!hooks) continue

                const operation = ctx.operation as "create" | "update" | "delete"
                const hook = hooks[operation]

                if (hook) {
                    // Map hookName to before/after
                    const isBefore = hookName.startsWith("before")
                    const hookFn = isBefore ? hook.before : hook.after

                    if (hookFn) {
                        const result = await hookFn({
                            data: ctx.input,
                            existingData: ctx.resource as any,
                            user: ctx.user,
                            driver: ctx.driver,
                            context: { nevr: {} as NevrInstance },
                        })

                        // If before hook returns modified data, apply it
                        if (isBefore && result && "data" in result) {
                            ctx.setInput(result.data as Record<string, unknown>)
                        }
                    }
                }
            }
        }
    }
}

/**
 * Execute error hook across all plugins
 */
export async function executeErrorHook(
    error: Error,
    ctx: HookContext,
    plugins: UnifiedPlugin[]
): Promise<void> {
    for (const plugin of plugins) {
        if (plugin.lifecycle?.onError) {
            await plugin.lifecycle.onError(error, {} as any, {} as any)
        }
    }
}

// -----------------------------------------------------------------------------
// Hook Context Factory
// -----------------------------------------------------------------------------

interface ServiceResolver {
    resolve: <T = unknown>(serviceId: string) => T
    resolveAsync: <T = unknown>(serviceId: string) => Promise<T>
}

export function createHookContext(
    entity: string,
    operation: Operation,
    user: User | null,
    input: Record<string, unknown>,
    resource: Record<string, unknown> | null,
    driver: Driver,
    resolver?: ServiceResolver
): HookContext {
    let stopped = false
    let currentInput = { ...input }
    let currentResource = resource ? { ...resource } : null
    let filters: Where = {}

    const defaultResolver: ServiceResolver = {
        resolve: (id) => { throw new Error(`[Nevr] Service "${id}" not found. Container not configured.`) },
        resolveAsync: async (id) => { throw new Error(`[Nevr] Service "${id}" not found. Container not configured.`) },
    }

    const serviceResolver = resolver || defaultResolver

    return {
        entity,
        operation,
        user,
        get input() {
            return currentInput
        },
        get resource() {
            return currentResource
        },
        driver,

        stop: () => {
            stopped = true
        },
        get stopped() {
            return stopped
        },

        setInput: (data: Record<string, unknown>) => {
            currentInput = { ...currentInput, ...data }
        },

        setResource: (data: Record<string, unknown>) => {
            currentResource = { ...currentResource, ...data }
        },

        addFilter: (filter: Where) => {
            filters = { ...filters, ...filter }
        },

        get filters() {
            return filters
        },

        // Service Container integration
        resolve: <T = unknown>(serviceId: string) => serviceResolver.resolve<T>(serviceId),
        resolveAsync: <T = unknown>(serviceId: string) => serviceResolver.resolveAsync<T>(serviceId),
    }
}

// -----------------------------------------------------------------------------
// Schema Conversion
// -----------------------------------------------------------------------------

export interface PluginSchemaLegacy {
    [model: string]: {
        fields: Record<string, {
            type: "string" | "number" | "boolean" | "date" | "json"
            required?: boolean
            unique?: boolean
            defaultValue?: unknown
            references?: { model: string; field: string }
        }>
        disableMigrations?: boolean
    }
}

/**
 * Convert Plugin Schema to Nevr Entities
 */
export function schemaToEntities(schema: PluginSchemaLegacy): Entity[] {
    const entities: Entity[] = []

    for (const [modelName, modelDef] of Object.entries(schema)) {
        const fields: Record<string, FieldDef> = {}

        for (const [fieldName, fieldDef] of Object.entries(modelDef.fields)) {
            fields[fieldName] = {
                type: fieldDef.type === "number" ? "int"
                    : fieldDef.type === "date" ? "datetime"
                        : fieldDef.type,
                optional: !fieldDef.required,
                unique: fieldDef.unique || false,
                default: fieldDef.defaultValue,
                hasDefault: fieldDef.defaultValue !== undefined,
                relation: fieldDef.references ? {
                    type: "belongsTo",
                    entity: () => ({ name: fieldDef.references!.model, config: { fields: {}, rules: {}, timestamps: false } }),
                    foreignKey: fieldName,
                    references: fieldDef.references.field,
                } : undefined,
            }
        }

        entities.push({
            name: modelName,
            config: {
                fields,
                rules: {},
                timestamps: true,
            },
        })
    }

    return entities
}
