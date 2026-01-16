// =============================================================================
// NEVR CORE
// Main entry point - creates nevr instance
// Framework & Database Agnostic
//
// Architecture:
// - Entity-first: Entity is the source of truth
// - Service Container: Functional DI for plugins and services
// - Actions: Custom operations and workflows on entities
// - Remote Joiner: API-level stitching for cross-service data
// =============================================================================

import type {
    NevrConfig,
    NevrInstance,
    NevrRequest,
    NevrResponse,
    Entity,
    Plugin,
    Middleware,
    MiddlewareContext,
    Route,
    EntityAction,
    EntityActionContext,
    EntityWorkflowStep,
    User,
    ServiceResolverContext,
    ServiceRegistrationOptions,
    EntityOperation,
    OperationContext,
    ActionReturnConfig,
} from "./types.js"

import { resolveEntity } from "./entity.js"
import { ServiceContainer, createScope, type ScopedContainer } from "./container.js"
import { validateInput, validateQueryParams } from "./validation.js"
import { checkRules } from "./rules.js"
import {
    enhanceWriteData,
    enhanceReadData,
    enhanceReadDataArray,
    hasEnhancements,
} from "./enhancements/index.js"
import {
    applyPluginFields,
    applyPluginEntities,
    collectMiddleware,
    collectRoutes,
    initializePlugins,
    executeHook,
    createHookContext,
} from "./plugins/unified/runtime.js"
import { normalizePlugins } from "./plugins/unified/compat.js"
import type { UnifiedPlugin } from "./plugins/unified/types.js"
import { matchRoute, pluralize, type MatchRouteOptions } from "./router.js"
import {
    validationError,
    unauthorizedError,
    forbiddenError,
    notFoundError,
    handleError,
} from "./error.js"
import { resolvePlugin, type ResolvedEntityMeta } from "./plugins/core/resolver.js"
import type { NevrPlugin } from "./plugins/core/contract.js"
import { capitalize } from "./utils/index.js"
import { getLogger } from "./logger.js"

// -----------------------------------------------------------------------------
// Default Middleware
// -----------------------------------------------------------------------------

function createCorsMiddleware(options: NevrConfig["cors"]): Middleware | null {
    // IMPORTANT: Only add CORS if explicitly enabled
    // When undefined, don't add CORS - let users use external cors packages
    // This prevents conflicts with Express cors middleware, etc.
    if (options === undefined || options === false) return null

    const corsOptions = typeof options === "boolean" ? {} : options
    const origin = corsOptions.origin ?? "*"
    const credentials = corsOptions.credentials ?? false
    const methods = corsOptions.methods ?? ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    const allowedHeaders = corsOptions.allowedHeaders ?? ["Content-Type", "Authorization"]

    return {
        name: "cors",
        handler: async (ctx, next) => {
            const originValue = Array.isArray(origin) ? origin.join(", ") : String(origin)
            ctx.response.headers = ctx.response.headers || {}
            ctx.response.headers["Access-Control-Allow-Origin"] = originValue
            ctx.response.headers["Access-Control-Allow-Methods"] = methods.join(", ")
            ctx.response.headers["Access-Control-Allow-Headers"] = allowedHeaders.join(", ")

            if (credentials) {
                ctx.response.headers["Access-Control-Allow-Credentials"] = "true"
            }

            if (ctx.request.method === "OPTIONS" as any) {
                ctx.end(null, 204)
                return
            }

            await next()
        },
    }
}

function createSecurityMiddleware(options: NevrConfig["security"]): Middleware | null {
    if (options === false) return null

    return {
        name: "security",
        handler: async (ctx, next) => {
            ctx.response.headers = ctx.response.headers || {}
            ctx.response.headers["X-Content-Type-Options"] = "nosniff"
            ctx.response.headers["X-Frame-Options"] = "DENY"
            ctx.response.headers["X-XSS-Protection"] = "1; mode=block"
            await next()
        },
    }
}

// -----------------------------------------------------------------------------
// Action Routes Collection
// -----------------------------------------------------------------------------

/**
 * Collect action routes from all entities
 * Generates routes like:
 * - POST /users/verify (collection action)
 * - POST /users/:id/verify (resource action)
 */
function collectActionRoutes(
    entities: Map<string, Entity>,
    instance: NevrInstance,
    executeAction: <TInput, TOutput>(entityName: string, actionName: string, input: TInput, ctx?: { user?: User | null; resourceId?: string }) => Promise<TOutput>
): Route[] {
    const routes: Route[] = []

    for (const [entityName, entity] of entities) {
        const actions = entity.config.actions
        if (!actions) continue

        const basePath = `/${pluralize(entityName)}`

        for (const [actionName, action] of Object.entries(actions)) {
            const actionPath = action.path || actionName

            // Build the full path
            const fullPath = action.requiresId
                ? `${basePath}/:id/${actionPath}`
                : `${basePath}/${actionPath}`

            routes.push({
                method: action.method || "POST",
                path: fullPath,
                metadata: {
                    operationId: `${entityName}_${actionName}`,
                    summary: action.metadata?.summary || `${capitalize(actionName)} ${entityName}`,
                    description: action.metadata?.description,
                    tags: action.metadata?.tags || [capitalize(entityName)],
                },
                handler: async (req: NevrRequest, _nevr: NevrInstance): Promise<NevrResponse> => {
                    try {
                        // Check authorization rules
                        if (action.rules && action.rules.length > 0) {
                            let resource: Record<string, unknown> | null = null

                            if (action.requiresId && req.params?.id) {
                                resource = await instance.driver.findOne<Record<string, unknown>>(entityName, { id: req.params.id })
                                if (!resource) {
                                    return {
                                        status: 404,
                                        body: { error: `${capitalize(entityName)} not found`, code: "NOT_FOUND" },
                                    }
                                }
                            }

                            const ruleResult = await checkRules(entity, "update", {
                                user: req.user,
                                input: (req.body as Record<string, unknown>) || {},
                                resource,
                            })

                            if (!ruleResult.allowed) {
                                return req.user
                                    ? { status: 403, body: { error: ruleResult.error || "Forbidden", code: "FORBIDDEN" } }
                                    : { status: 401, body: { error: ruleResult.error || "Unauthorized", code: "UNAUTHORIZED" } }
                            }
                        }

                        // Execute the action
                        const result = await executeAction(
                            entityName,
                            actionName,
                            req.body || {},
                            {
                                user: req.user,
                                resourceId: req.params?.id,
                            }
                        )

                        return {
                            status: 200,
                            body: result,
                        }
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        return {
                            status: 500,
                            body: { error: err.message, code: "ACTION_ERROR" },
                        }
                    }
                },
            })
        }
    }

    return routes
}

// -----------------------------------------------------------------------------
// Field Selection Helper
// -----------------------------------------------------------------------------

/**
 * Apply field selection to response data
 * Filters each record to only include specified fields
 */
function applyFieldSelection(
    data: Record<string, unknown>[],
    select: Record<string, boolean>
): Record<string, unknown>[] {
    const selectedFields = Object.keys(select).filter(key => select[key])

    if (selectedFields.length === 0) {
        return data  // No valid selection, return all data
    }

    return data.map(record => {
        const filtered: Record<string, unknown> = {}
        for (const field of selectedFields) {
            if (field in record) {
                filtered[field] = record[field]
            }
        }
        return filtered
    })
}

// -----------------------------------------------------------------------------
// Type Inference Helpers
// -----------------------------------------------------------------------------

/**
 * Infer entity data type from field definitions
 * Uses the generic FieldDef<TType, TOptional, THasDefault> for accurate type inference
 * Includes foreignKey fields for relations (e.g., user -> also includes userId)
 */
type InferEntityData<TFields extends Record<string, import("./types.js").FieldDef<any, any, any>>> = {
    id: string
} & {
    // Non-relation fields
    [K in keyof TFields as K extends string
    ? HasRelation<TFields[K]> extends true ? never : K
    : never
    ]: TFields[K] extends import("./types.js").FieldDef<infer TType extends import("./types.js").FieldType, infer TOptional extends boolean, any>
    ? TOptional extends true
    ? InferFieldTypeFromDef<TType> | null
    : InferFieldTypeFromDef<TType>
    : unknown
} & {
    // Relation foreign keys (e.g., userId for user relation)
    [K in keyof TFields as K extends string
    ? HasRelation<TFields[K]> extends true ? ForeignKeyName<K> : never
    : never
    ]: TFields[K] extends import("./types.js").FieldDef<any, infer TOptional extends boolean, any>
    ? TOptional extends true ? string | null : string
    : string
}

/**
 * Helper: Check if field has a relation
 */
type HasRelation<T> = T extends { relation: any } ? true : false

/**
 * Helper: Get the foreignKey name for a relation field (fieldName + "Id")
 */
type ForeignKeyName<K extends string> = `${K}Id`

/**
 * Infer create input type from field definitions
 * - Excludes id (auto-generated)
 * - Makes optional fields optional with ?:
 * - Makes fields with defaults optional with ?:
 * - Converts relation fields to their foreignKey (e.g., user -> userId)
 *
 * Uses conditional types to separate required vs optional fields:
 * - Required: not optional AND no default
 * - Optional: optional OR hasDefault
 */
type InferCreateInput<TFields extends Record<string, import("./types.js").FieldDef<any, any, any>>> =
    // Required non-relation fields
    {
        [K in keyof TFields as K extends string
        ? HasRelation<TFields[K]> extends true
        ? never  // Relations handled separately
        : TFields[K] extends import("./types.js").FieldDef<any, true, any>
        ? never  // optional fields go to optional section
        : TFields[K] extends import("./types.js").FieldDef<any, any, true>
        ? never  // fields with defaults go to optional section
        : K
        : never
        ]: TFields[K] extends import("./types.js").FieldDef<infer TType extends import("./types.js").FieldType, any, any>
        ? InferFieldTypeFromDef<TType>
        : unknown
    } &
    // Optional non-relation fields
    {
        [K in keyof TFields as K extends string
        ? HasRelation<TFields[K]> extends true
        ? never  // Relations handled separately
        : TFields[K] extends import("./types.js").FieldDef<any, true, any>
        ? K  // optional fields
        : TFields[K] extends import("./types.js").FieldDef<any, any, true>
        ? K  // fields with defaults
        : never
        : never
        ]?: TFields[K] extends import("./types.js").FieldDef<infer TType extends import("./types.js").FieldType, any, any>
        ? InferFieldTypeFromDef<TType> | null
        : unknown
    } &
    // Required relation fields (as foreignKey: e.g., user -> userId)
    {
        [K in keyof TFields as K extends string
        ? HasRelation<TFields[K]> extends true
        ? TFields[K] extends import("./types.js").FieldDef<any, true, any>
        ? never  // optional relations go to optional section
        : ForeignKeyName<K>
        : never
        : never
        ]: string
    } &
    // Optional relation fields (as foreignKey)
    {
        [K in keyof TFields as K extends string
        ? HasRelation<TFields[K]> extends true
        ? TFields[K] extends import("./types.js").FieldDef<any, true, any>
        ? ForeignKeyName<K>
        : never
        : never
        : never
        ]?: string | null
    }

type InferFieldTypeFromDef<T> =
    T extends "string" | "text" ? string :
    T extends "int" | "float" ? number :
    T extends "boolean" ? boolean :
    T extends "datetime" ? Date :
    T extends "json" ? Record<string, unknown> :
    unknown

/**
 * Infer all entity types from config
 */
type InferEntities<TEntities extends Entity[]> = {
    [E in TEntities[number]as E["name"]]: E extends { config: { fields: infer F } }
    ? F extends Record<string, import("./types.js").FieldDef<any, any, any>>
    ? InferEntityData<F>
    : never
    : never
}

/**
 * Infer all create input types from config
 */
type InferCreateInputs<TEntities extends Entity[]> = {
    [E in TEntities[number]as E["name"]]: E extends { config: { fields: infer F } }
    ? F extends Record<string, import("./types.js").FieldDef<any, any, any>>
    ? InferCreateInput<F>
    : never
    : never
}

/**
 * Typed Nevr instance with $Infer for E2E type safety
 */
export interface TypedNevrInstance<TEntities extends Entity[] = Entity[]> extends NevrInstance {
    /**
     * Type inference helper - use with `typeof api.$Infer`
     *
     * @example
     * ```typescript
     * // Server
     * export const api = nevr({ entities: [user, product] })
     * export type API = typeof api
     *
     * // Client (can be in different package!)
     * import type { API } from "../server"
     *
     * type User = API["$Infer"]["Entities"]["user"]
     * type Product = API["$Infer"]["Entities"]["product"]
     * type CreateUserInput = API["$Infer"]["CreateInputs"]["user"]
     * ```
     */
    $Infer: {
        /** All entity types inferred from server */
        Entities: InferEntities<TEntities>
        /** All create input types (optional fields are optional) */
        CreateInputs: InferCreateInputs<TEntities>
        /** Entity names as string literal type */
        EntityNames: TEntities[number]["name"]
    }
}

// -----------------------------------------------------------------------------
// Nevr Factory
// -----------------------------------------------------------------------------

/**
 * Create a new Nevr instance with full type inference
 *
 * @example
 * ```typescript
 * import { nevr, entity, string, int } from "nevr"
 * import { prisma } from "nevr/drivers/prisma"
 *
 * const user = entity("user", {
 *   email: string.unique(),
 *   name: string.optional(),
 *   age: int.optional(),
 * })
 *
 * const api = nevr({
 *   entities: [user],
 *   driver: prisma(new PrismaClient()),
 * })
 *
 * // Type inference works!
 * export type API = typeof api
 * type User = API["$Infer"]["Entities"]["user"]
 * // User = { id: string; email: string; name: string | null; age: number | null }
 * ```
 */
export function nevr<TEntities extends Entity[]>(
    config: NevrConfig & { entities: TEntities }
): TypedNevrInstance<TEntities> {
    // Use provided context or create default container
    // This enables test isolation and multiple instances
    const container = config.nevrContext?.services ?? new ServiceContainer()

    // Build entity map
    const entities = new Map<string, Entity>()

    for (const entityDef of config.entities) {
        const entity = resolveEntity(entityDef)
        entities.set(entity.name, entity)
    }

    // Normalize all plugins to UnifiedPlugin format
    const plugins: UnifiedPlugin[] = normalizePlugins(config.plugins || [])

    // Resolve new-style plugins and collect entity metadata
    const entityMeta = new Map<string, ResolvedEntityMeta>()

    for (const plugin of plugins) {
        // Check if this is a new-style NevrPlugin (has meta property)
        if ("meta" in plugin && (plugin as NevrPlugin).meta) {
            const resolved = resolvePlugin(plugin as NevrPlugin)

            // Add plugin entities to main entity map
            for (const entity of resolved.entities) {
                entities.set(entity.name, entity)
            }

            // Store entity metadata
            for (const [name, meta] of resolved.entityMeta) {
                entityMeta.set(name, meta)
            }
        }
    }

    // Apply plugin modifications (for legacy plugins)
    applyPluginEntities(entities, plugins)
    applyPluginFields(entities, plugins)

    // Get driver
    const driver = config.driver

    // Configure container with driver
    container.setDriver(driver)

    // Register driver as a service
    container.registerInstance("driver", driver)
    container.registerInstance("db", driver)

    // Create service resolver for hooks
    const serviceResolver = {
        resolve: <T = unknown>(id: string) => container.resolve<T>(id),
        resolveAsync: <T = unknown>(id: string) => container.resolveAsync<T>(id),
    }

    // Build initial middleware stack
    const middleware: Middleware[] = []

    // Add default middleware
    const corsMiddleware = createCorsMiddleware(config.cors)
    if (corsMiddleware) middleware.push(corsMiddleware)

    const securityMiddleware = createSecurityMiddleware(config.security)
    if (securityMiddleware) middleware.push(securityMiddleware)

    // Plugin routes will be populated after instance is created
    let pluginRoutes: Route[] = []
    let routeOptions: MatchRouteOptions = { entityMeta, entityRoutes: config.entityRoutes }

    // -----------------------------------------------------------------------------
    // Request Handler
    // -----------------------------------------------------------------------------

    async function processRequest(req: NevrRequest): Promise<NevrResponse> {
        const state = new Map<string, unknown>()
        let ended = false
        let endResponse: NevrResponse | null = null

        const ctx: MiddlewareContext = {
            request: req,
            response: { headers: {} },
            get: <T = unknown>(key: string) => state.get(key) as T | undefined,
            set: (key: string, value: unknown) => state.set(key, value),
            end: (body: unknown, status: number = 200) => {
                ended = true
                endResponse = { status, body, headers: ctx.response.headers }
            },
            get ended() {
                return ended
            },
        }

        // Execute middleware
        let middlewareIndex = 0

        const executeMiddleware = async (): Promise<void> => {
            if (ended || middlewareIndex >= middleware.length) return
            const mw = middleware[middlewareIndex++]
            await mw.handler(ctx, executeMiddleware)
        }

        await executeMiddleware()

        if (endResponse) {
            return endResponse
        }

        // Route the request
        const route = matchRoute(req, entities, routeOptions)

        // Health check
        if (route.type === "health") {
            return {
                status: 200,
                body: { status: "ok", timestamp: new Date().toISOString() },
                headers: ctx.response.headers,
            }
        }

        // Plugin route
        if (route.type === "plugin" && route.pluginRoute) {
            try {
                const response = await route.pluginRoute.handler(req, instance)
                return { ...response, headers: { ...ctx.response.headers, ...response.headers } }
            } catch (error) {
                return handleError(error)
            }
        }

        // Not found
        if (route.type === "notFound" || !route.entity || !route.operation) {
            return notFoundError("Endpoint not found")
        }

        // Custom handler
        if (route.customHandler) {
            try {
                const response = await route.customHandler(req, instance)
                return { ...response, headers: { ...ctx.response.headers, ...response.headers } }
            } catch (error) {
                return handleError(error)
            }
        }

        // Entity CRUD operations
        const { entity, resourceId, operation } = route

        try {
            const hookCtx = createHookContext(
                entity.name,
                operation === "list" ? "list" : operation,
                req.user,
                (req.body as Record<string, unknown>) || {},
                null,
                driver,
                serviceResolver
            )

            // LIST
            if (operation === "list") {
                const ruleResult = await checkRules(entity, "list", {
                    user: req.user,
                    input: {},
                    resource: null,
                })

                if (!ruleResult.allowed) {
                    return req.user
                        ? forbiddenError(ruleResult.error)
                        : unauthorizedError(ruleResult.error)
                }

                await executeHook("beforeList", hookCtx, plugins)
                if (hookCtx.stopped) {
                    return { status: 200, body: hookCtx.resource || [], headers: ctx.response.headers }
                }

                const { filter, sort, take, skip, include, select } = validateQueryParams(
                    req.query as Record<string, unknown>
                )

                // Auto-filter by owner if entity has ownerField and user is authenticated
                // This ensures users only see their own data (row-level security)
                let ownerFilter: Record<string, unknown> = {}
                if (entity.config.ownerField && req.user) {
                    ownerFilter = { [entity.config.ownerField]: req.user.id }
                }

                const where = { ...filter, ...ownerFilter, ...hookCtx.filters }

                const rawData = await driver.findMany(entity.name, {
                    where,
                    orderBy: Object.keys(sort).length > 0 ? sort : undefined,
                    take,
                    skip,
                    include: Object.keys(include).length > 0 ? include : undefined,
                })

                // Apply read enhancements (security, field access)
                let data = hasEnhancements(entity)
                    ? await enhanceReadDataArray(rawData as Record<string, unknown>[], entity, {
                        user: req.user,
                    })
                    : rawData

                // Apply field selection if specified
                if (select && Object.keys(select).length > 0) {
                    data = applyFieldSelection(data as Record<string, unknown>[], select)
                }

                const total = await driver.count(entity.name, where)

                return {
                    status: 200,
                    body: { data, pagination: { total, limit: take, offset: skip } },
                    headers: ctx.response.headers,
                }
            }

            // CREATE
            if (operation === "create") {
                const input = (req.body as Record<string, unknown>) || {}

                const validation = validateInput(entity, input, "create")
                if (!validation.valid) {
                    return validationError(validation.errors)
                }

                const ruleResult = await checkRules(entity, "create", {
                    user: req.user,
                    input: validation.data,
                    resource: null,
                })

                if (!ruleResult.allowed) {
                    return req.user
                        ? forbiddenError(ruleResult.error)
                        : unauthorizedError(ruleResult.error)
                }

                // Apply write enhancements (transforms, validation, security)
                let enhancedInput = validation.data
                if (hasEnhancements(entity)) {
                    try {
                        enhancedInput = await enhanceWriteData(validation.data, entity, "create", {
                            user: req.user,
                            skipValidation: true, // Already validated above
                        })
                    } catch (error) {
                        if (error instanceof Error && error.name === "FieldValidationErrors") {
                            return validationError((error as any).toJSON?.() || [{ field: "unknown", message: error.message }])
                        }
                        throw error
                    }
                }

                hookCtx.setInput(enhancedInput)

                if (entity.config.ownerField && req.user) {
                    hookCtx.setInput({ [entity.config.ownerField]: req.user.id })
                }

                await executeHook("beforeCreate", hookCtx, plugins)
                if (hookCtx.stopped) {
                    return { status: 201, body: hookCtx.resource, headers: ctx.response.headers }
                }

                const created = await driver.create(entity.name, hookCtx.input)

                // Apply read enhancements before returning
                const enhancedCreated = hasEnhancements(entity)
                    ? await enhanceReadData(created as Record<string, unknown>, entity, { user: req.user })
                    : created

                hookCtx.setResource(enhancedCreated as Record<string, unknown>)
                await executeHook("afterCreate", hookCtx, plugins)

                return { status: 201, body: enhancedCreated, headers: ctx.response.headers }
            }

            // READ
            if (operation === "read" && resourceId) {
                await executeHook("beforeRead", hookCtx, plugins)

                const where = { id: resourceId, ...hookCtx.filters }
                const resource = await driver.findOne<Record<string, unknown>>(entity.name, where)

                if (!resource) {
                    return notFoundError(`${capitalize(entity.name)} not found`)
                }

                const ruleResult = await checkRules(entity, "read", {
                    user: req.user,
                    input: {},
                    resource,
                })

                if (!ruleResult.allowed) {
                    return req.user
                        ? forbiddenError(ruleResult.error)
                        : unauthorizedError(ruleResult.error)
                }

                const { include } = validateQueryParams(req.query as Record<string, unknown>)

                let result = resource
                if (Object.keys(include).length > 0) {
                    const withIncludes = await driver.findOne(entity.name, { id: resourceId })
                    if (withIncludes) result = withIncludes as Record<string, unknown>
                }

                // Apply read enhancements (security, field access)
                const enhancedResult = hasEnhancements(entity)
                    ? await enhanceReadData(result, entity, { user: req.user })
                    : result

                return { status: 200, body: enhancedResult, headers: ctx.response.headers }
            }

            // UPDATE
            if (operation === "update" && resourceId) {
                const existing = await driver.findOne<Record<string, unknown>>(entity.name, {
                    id: resourceId,
                })

                if (!existing) {
                    return notFoundError(`${capitalize(entity.name)} not found`)
                }

                const input = (req.body as Record<string, unknown>) || {}

                const validation = validateInput(entity, input, "update")
                if (!validation.valid) {
                    return validationError(validation.errors)
                }

                const ruleResult = await checkRules(entity, "update", {
                    user: req.user,
                    input: validation.data,
                    resource: existing,
                })

                if (!ruleResult.allowed) {
                    return req.user
                        ? forbiddenError(ruleResult.error)
                        : unauthorizedError(ruleResult.error)
                }

                // Apply write enhancements (transforms, validation, security)
                let enhancedInput = validation.data
                if (hasEnhancements(entity)) {
                    try {
                        enhancedInput = await enhanceWriteData(validation.data, entity, "update", {
                            user: req.user,
                            existingData: existing,
                            resourceId,
                            skipValidation: true, // Already validated above
                        })
                    } catch (error) {
                        if (error instanceof Error && error.name === "FieldValidationErrors") {
                            return validationError((error as any).toJSON?.() || [{ field: "unknown", message: error.message }])
                        }
                        throw error
                    }
                }

                hookCtx.setInput(enhancedInput)
                hookCtx.setResource(existing)

                await executeHook("beforeUpdate", hookCtx, plugins)
                if (hookCtx.stopped) {
                    return { status: 200, body: hookCtx.resource, headers: ctx.response.headers }
                }

                const updated = await driver.update(entity.name, { id: resourceId }, hookCtx.input)

                // Apply read enhancements before returning
                const enhancedUpdated = hasEnhancements(entity)
                    ? await enhanceReadData(updated as Record<string, unknown>, entity, { user: req.user })
                    : updated

                hookCtx.setResource(enhancedUpdated as Record<string, unknown>)
                await executeHook("afterUpdate", hookCtx, plugins)

                return { status: 200, body: enhancedUpdated, headers: ctx.response.headers }
            }

            // DELETE
            if (operation === "delete" && resourceId) {
                const existing = await driver.findOne<Record<string, unknown>>(entity.name, {
                    id: resourceId,
                })

                if (!existing) {
                    return notFoundError(`${capitalize(entity.name)} not found`)
                }

                const ruleResult = await checkRules(entity, "delete", {
                    user: req.user,
                    input: {},
                    resource: existing,
                })

                if (!ruleResult.allowed) {
                    return req.user
                        ? forbiddenError(ruleResult.error)
                        : unauthorizedError(ruleResult.error)
                }

                hookCtx.setResource(existing)

                await executeHook("beforeDelete", hookCtx, plugins)
                if (hookCtx.stopped) {
                    return { status: 204, body: null, headers: ctx.response.headers }
                }

                await driver.delete(entity.name, { id: resourceId })

                await executeHook("afterDelete", hookCtx, plugins)

                return { status: 204, body: null, headers: ctx.response.headers }
            }

            return notFoundError("Endpoint not found")
        } catch (error) {
            return handleError(error)
        }
    }

    async function handleRequest(req: NevrRequest): Promise<NevrResponse> {
        try {
            if (config.context) {
                const context = await config.context(req)
                req.context = { ...req.context, ...context }
            }

            return await processRequest(req)
        } catch (error) {
            return handleError(error)
        }
    }

    // -----------------------------------------------------------------------------
    // Action Execution Engine
    // -----------------------------------------------------------------------------

    async function executeEntityAction<TInput = unknown, TOutput = unknown>(
        entityName: string,
        actionName: string,
        input: TInput,
        ctx?: { user?: User | null; resourceId?: string }
    ): Promise<TOutput> {
        const entity = entities.get(entityName)
        if (!entity) {
            throw new Error(`[Nevr] Entity "${entityName}" not found`)
        }

        const action = entity.config.actions?.[actionName]
        if (!action) {
            throw new Error(`[Nevr] Action "${actionName}" not found on entity "${entityName}"`)
        }

        // Build action context
        const workflowData = new Map<string, unknown>()

        let resource: Record<string, unknown> | null = null
        if (action.requiresId && ctx?.resourceId) {
            resource = await driver.findOne<Record<string, unknown>>(entityName, { id: ctx.resourceId })
            if (!resource) {
                throw new Error(`[Nevr] ${capitalize(entityName)} not found`)
            }
        }

        const actionCtx: EntityActionContext<TInput> = {
            entity: entityName,
            action: actionName,
            input: input as TInput,
            resourceId: ctx?.resourceId,
            resource,
            user: ctx?.user || null,
            driver,
            resolve: <T = unknown>(id: string) => container.resolve<T>(id),
            resolveAsync: <T = unknown>(id: string) => container.resolveAsync<T>(id),
            set: <T = unknown>(key: string, value: T) => workflowData.set(key, value),
            get: <T = unknown>(key: string) => workflowData.get(key) as T | undefined,
        }

        // Execute workflow if defined
        if (action.workflow) {
            return await executeWorkflowAction<TInput, TOutput>(action, actionCtx)
        }

        // Execute multi-entity operations if defined (Zero API pattern)
        if (action.operations && action.operations.length > 0) {
            return await executeOperationsAction<TInput, TOutput>(action, actionCtx, entity)
        }

        // Execute simple action handler
        if (action.handler) {
            return await action.handler(actionCtx) as TOutput
        }

        throw new Error(`[Nevr] Action "${actionName}" has no handler, workflow, or operations defined`)
    }

    /**
     * Execute multi-entity operations (Zero API pattern)
     * Supports auto-mapping input to entity fields and transaction support
     */
    async function executeOperationsAction<TInput, TOutput>(
        action: EntityAction<TInput>,
        ctx: EntityActionContext<TInput>,
        primaryEntity: Entity
    ): Promise<TOutput> {
        const operations = action.operations!
        const results: Record<string, Record<string, unknown>> = {}

        // Helper: Auto-map input to target entity fields using enhancement pipeline
        const autoMapInput = async (targetEntityName: string): Promise<Record<string, unknown>> => {
            const targetEntity = entities.get(targetEntityName)
            if (!targetEntity) {
                throw new Error(`[Nevr] Entity "${targetEntityName}" not found for auto-mapping`)
            }

            const entityFields = targetEntity.config.fields
            const input = ctx.input as Record<string, unknown>

            // Filter to only include fields that exist in target entity
            const mapped: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(input)) {
                if (key in entityFields) {
                    mapped[key] = value
                }
            }

            // Apply enhancements (transforms, validation, security) if entity has them
            if (hasEnhancements(targetEntity)) {
                return await enhanceWriteData(mapped, targetEntity, "create", {
                    user: ctx.user,
                    skipValidation: false, // Let enhancement handle validation
                })
            }

            return mapped
        }

        // Execute operations
        const executeOps = async (txDriver: typeof driver): Promise<void> => {
            for (const op of operations) {
                // Check condition if present
                if (op.condition) {
                    const opCtx: OperationContext<TInput> = {
                        input: ctx.input,
                        results,
                        resourceId: ctx.resourceId,
                        user: ctx.user,
                        driver: txDriver,
                    }
                    const shouldRun = await op.condition(opCtx)
                    if (!shouldRun) continue
                }

                const opCtx: OperationContext<TInput> = {
                    input: ctx.input,
                    results,
                    resourceId: ctx.resourceId,
                    user: ctx.user,
                    driver: txDriver,
                }

                switch (op.operation) {
                    case "create": {
                        const data = op.data === "auto"
                            ? await autoMapInput(op.entity)
                            : typeof op.data === "function"
                                ? await op.data(opCtx)
                                : {}
                        const result = await txDriver.create<Record<string, unknown>>(op.entity, data)

                        // Apply transform if present
                        results[op.entity] = op.transform
                            ? await op.transform(result, opCtx) as Record<string, unknown>
                            : result
                        break
                    }

                    case "update": {
                        const where = op.where
                            ? await op.where(opCtx)
                            : { id: ctx.resourceId }
                        const data = typeof op.data === "function"
                            ? await op.data(opCtx)
                            : {}
                        const result = await txDriver.update<Record<string, unknown>>(op.entity, where, data)

                        results[op.entity] = op.transform
                            ? await op.transform(result, opCtx) as Record<string, unknown>
                            : result
                        break
                    }

                    case "delete": {
                        const where = op.where
                            ? await op.where(opCtx)
                            : { id: ctx.resourceId }
                        await txDriver.delete(op.entity, where)
                        results[op.entity] = { deleted: true }
                        break
                    }

                    case "read": {
                        const where = op.where
                            ? await op.where(opCtx)
                            : { id: ctx.resourceId }
                        const result = await txDriver.findOne<Record<string, unknown>>(op.entity, where)

                        results[op.entity] = op.transform
                            ? await op.transform(result, opCtx) as Record<string, unknown>
                            : result || {}
                        break
                    }
                }
            }
        }

        // Execute in transaction if multiple operations
        if (operations.length > 1 && driver.transaction) {
            await driver.transaction(async (tx) => {
                await executeOps(tx as typeof driver)
            })
        } else {
            await executeOps(driver)
        }

        // Apply returns configuration
        if (action.returns) {
            return applyReturnsConfig(results, action.returns) as TOutput
        }

        // Return all results
        return results as TOutput
    }

    /**
     * Apply returns configuration (pick/omit fields)
     */
    function applyReturnsConfig(
        results: Record<string, Record<string, unknown>>,
        config: ActionReturnConfig
    ): unknown {
        if (config.transform) {
            return config.transform(results)
        }

        const data = config.entity
            ? results[config.entity] || {}
            : results

        if (!data || typeof data !== "object") {
            return data
        }

        let output = { ...data as Record<string, unknown> }

        if (config.pick) {
            const picked: Record<string, unknown> = {}
            for (const key of config.pick) {
                if (key in output) {
                    picked[key] = output[key]
                }
            }
            output = picked
        }

        if (config.omit) {
            for (const key of config.omit) {
                delete output[key]
            }
        }

        return output
    }

    async function executeWorkflowAction<TInput, TOutput>(
        action: EntityAction,
        ctx: EntityActionContext<TInput>
    ): Promise<TOutput> {
        const workflow = action.workflow!
        const completedSteps: { step: EntityWorkflowStep; result: unknown }[] = []

        const executeSteps = async (txDriver?: typeof driver): Promise<TOutput> => {
            const stepCtx = txDriver ? { ...ctx, driver: txDriver } : ctx

            for (const step of workflow.steps) {
                try {
                    // Execute with retry
                    const result = await executeStepWithRetry(step, stepCtx)
                    completedSteps.push({ step, result })
                } catch (error) {
                    // Run compensation for completed steps
                    await runCompensation(completedSteps, stepCtx)
                    throw error
                }
            }

            // Return last step result or empty object
            return (completedSteps[completedSteps.length - 1]?.result ?? {}) as TOutput
        }

        // Execute with or without transaction
        if (workflow.useTransaction && driver.transaction) {
            return await driver.transaction(async (tx) => {
                return executeSteps(tx as typeof driver)
            })
        }

        return executeSteps()
    }

    async function executeStepWithRetry(
        step: EntityWorkflowStep,
        ctx: EntityActionContext
    ): Promise<unknown> {
        const maxAttempts = step.retry?.maxAttempts || 1
        const baseDelay = step.retry?.delay || 100
        const backoff = step.retry?.backoff || 2

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await step.execute(ctx)
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                if (attempt < maxAttempts) {
                    const delay = baseDelay * Math.pow(backoff, attempt - 1)
                    await new Promise((resolve) => setTimeout(resolve, delay))
                }
            }
        }

        throw lastError
    }

    interface CompensationError {
        stepName: string
        error: Error
    }

    interface CompensationResult {
        compensated: string[]
        errors: CompensationError[]
        success: boolean
    }

    async function runCompensation(
        completedSteps: { step: EntityWorkflowStep; result: unknown }[],
        ctx: EntityActionContext
    ): Promise<CompensationResult> {
        const compensated: string[] = []
        const errors: CompensationError[] = []

        // Run compensation in reverse order
        for (let i = completedSteps.length - 1; i >= 0; i--) {
            const { step, result } = completedSteps[i]

            if (step.compensate) {
                try {
                    await step.compensate(ctx, result)
                    compensated.push(step.name)
                } catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error))
                    errors.push({ stepName: step.name, error: err })
                    getLogger().error(`[Nevr] Compensation failed for step "${step.name}":`, error)
                }
            }
        }

        if (errors.length > 0) {
            getLogger().warn(
                `[Nevr] Compensation completed with ${errors.length} error(s) out of ${completedSteps.length} steps`
            )
        }

        return {
            compensated,
            errors,
            success: errors.length === 0
        }
    }

    // -----------------------------------------------------------------------------
    // Custom Routes Storage
    // -----------------------------------------------------------------------------

    const customRoutes: Route[] = []

    // -----------------------------------------------------------------------------
    // Instance
    // -----------------------------------------------------------------------------

    const instance = {
        config,
        entities,
        plugins,
        middleware,
        driver,
        handleRequest,

        // $Infer for E2E type safety - only used at compile time
        $Infer: {} as any,

        getEntity(name: string) {
            return entities.get(name)
        },

        getDriver() {
            return driver
        },

        // =========================================================================
        // Service Container
        // =========================================================================

        container: {
            initializeAll: () => container.initializeAll(),
            getServiceIds: () => container.getServiceIds(),
            getByTag: (tag: string) => container.getByTag(tag),
            clear: () => container.clear(),
            unregister: (id: string) => container.unregister(id),
        },

        resolve: <T = unknown>(id: string) => container.resolve<T>(id),
        resolveAsync: <T = unknown>(id: string) => container.resolveAsync<T>(id),

        registerService: <T>(
            id: string,
            factory: ((ctx: ServiceResolverContext) => T) | ((ctx: ServiceResolverContext) => Promise<T>) | T,
            options?: ServiceRegistrationOptions
        ) => {
            // Handle direct instance registration (non-function)
            if (typeof factory !== "function") {
                container.registerInstance(id, factory as T, options)
            } else {
                // Wrap factory to add driver to context for ServiceResolverContext compatibility
                const wrappedFactory = (ctx: { resolve: <U>(id: string) => U; resolveAsync: <U>(id: string) => Promise<U> }) => {
                    const extendedCtx = {
                        ...ctx,
                        driver,
                    }
                    return (factory as (ctx: typeof extendedCtx) => unknown)(extendedCtx)
                }
                container.register(id, wrappedFactory, options)
            }
        },

        hasService: (id: string) => container.has(id),

        // =========================================================================
        // Custom Routes & Middleware
        // =========================================================================

        addRoute(route: Route) {
            customRoutes.push(route)
            // Update plugin routes to include custom routes
            pluginRoutes.push(route)
        },

        addMiddleware(mw: Middleware) {
            middleware.push(mw)
        },

        getRoutes() {
            return [...customRoutes]
        },

        // =========================================================================
        // Entity Actions
        // =========================================================================

        executeAction: executeEntityAction,

        // =========================================================================
        // RAG Engine (AI-First Semantic Search)
        // =========================================================================

        // These methods will be populated if RAG config is provided
        rag: null as any,
        semanticSearch: undefined as any,
        generateEmbeddings: undefined as any,
    }

    // Collect plugin middleware and routes
    const pluginMiddleware = collectMiddleware(plugins, instance)
    middleware.push(...pluginMiddleware)

    pluginRoutes = collectRoutes(plugins, instance)

    // Collect entity action routes
    const actionRoutes = collectActionRoutes(entities, instance, executeEntityAction)
    pluginRoutes.push(...actionRoutes)

    routeOptions = { pluginRoutes, entityMeta, entityRoutes: config.entityRoutes }

    // Initialize plugins
    initializePlugins(plugins, instance as NevrInstance).catch((err) => {
        getLogger().error("[Nevr] Plugin initialization failed:", err)
    })

    return instance as TypedNevrInstance<TEntities>
}
