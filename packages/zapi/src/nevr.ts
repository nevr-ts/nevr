// =============================================================================
// NEVR CORE
// Main entry point - creates nevr instance
// =============================================================================

import type {
  ZapiConfig,
  ZapiInstance,
  ZapiRequest,
  ZapiResponse,
  Entity,
  Plugin,
  Middleware,
  MiddlewareContext,
  HookContext,
  Route,
} from "./types.js"

import { resolveEntity } from "./entity.js"
import { validateInput, validateQueryParams } from "./validation.js"
import { checkRules } from "./rules.js"
import {
  applyPluginFields,
  applyPluginEntities,
  collectMiddleware,
  collectRoutes,
  initializePlugins,
  executeHook,
  createHookContext,
} from "./plugin.js"
import { matchRoute, pluralize } from "./router.js"
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  handleError,
} from "./error.js"

// -----------------------------------------------------------------------------
// Default Middleware
// -----------------------------------------------------------------------------

function createCorsMiddleware(options: ZapiConfig["cors"]): Middleware | null {
  if (options === false) return null

  const corsOptions = options === undefined ? {} : options
  const origin = corsOptions.origin ?? "*"
  const credentials = corsOptions.credentials ?? false
  const methods = corsOptions.methods ?? ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  const allowedHeaders = corsOptions.allowedHeaders ?? ["Content-Type", "Authorization"]

  return {
    name: "cors",
    handler: async (ctx, next) => {
      // Set CORS headers
      const originValue = Array.isArray(origin) ? origin.join(", ") : String(origin)
      ctx.response.headers = ctx.response.headers || {}
      ctx.response.headers["Access-Control-Allow-Origin"] = originValue
      ctx.response.headers["Access-Control-Allow-Methods"] = methods.join(", ")
      ctx.response.headers["Access-Control-Allow-Headers"] = allowedHeaders.join(", ")

      if (credentials) {
        ctx.response.headers["Access-Control-Allow-Credentials"] = "true"
      }

      // Handle preflight
      if (ctx.request.method === "OPTIONS" as any) {
        ctx.end(null, 204)
        return
      }

      await next()
    },
  }
}

function createSecurityMiddleware(options: ZapiConfig["security"]): Middleware | null {
  if (options === false) return null

  return {
    name: "security",
    handler: async (ctx, next) => {
      ctx.response.headers = ctx.response.headers || {}

      // Basic security headers
      ctx.response.headers["X-Content-Type-Options"] = "nosniff"
      ctx.response.headers["X-Frame-Options"] = "DENY"
      ctx.response.headers["X-XSS-Protection"] = "1; mode=block"

      await next()
    },
  }
}

// -----------------------------------------------------------------------------
// Zapi Factory
// -----------------------------------------------------------------------------

export function zapi(config: ZapiConfig): ZapiInstance {
  // Build entity map
  const entities = new Map<string, Entity>()

  for (const entityDef of config.entities) {
    const entity = resolveEntity(entityDef)
    entities.set(entity.name, entity)
  }

  // Initialize plugins
  const plugins = config.plugins || []

  // Apply plugin modifications
  applyPluginEntities(entities, plugins)
  applyPluginFields(entities, plugins)

  // Get driver
  const driver = config.driver

  // Build initial middleware stack (default only)
  const middleware: Middleware[] = []

  // Add default middleware
  const corsMiddleware = createCorsMiddleware(config.cors)
  if (corsMiddleware) middleware.push(corsMiddleware)

  const securityMiddleware = createSecurityMiddleware(config.security)
  if (securityMiddleware) middleware.push(securityMiddleware)

  // Plugin routes will be populated after instance is created
  let pluginRoutes: Route[] = []
  let pluginMiddlewareAdded = false

  // -----------------------------------------------------------------------------
  // Request Handler
  // -----------------------------------------------------------------------------

  async function processRequest(req: ZapiRequest): Promise<ZapiResponse> {
    // Create middleware context
    const state = new Map<string, unknown>()
    let ended = false
    let endResponse: ZapiResponse | null = null

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

    // If middleware ended the request, return early
    if (endResponse) {
      return endResponse
    }

    // Route the request
    const route = matchRoute(req, entities, pluginRoutes)

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

    // Entity CRUD operations
    const { entity, resourceId, operation } = route

    try {
      // Create hook context
      const hookCtx = createHookContext(
        entity.name,
        operation === "list" ? "list" : operation,
        req.user,
        (req.body as Record<string, unknown>) || {},
        null,
        driver
      )

      // LIST
      if (operation === "list") {
        // Check rules
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

        // Execute beforeList hook
        await executeHook("beforeList", hookCtx, plugins)
        if (hookCtx.stopped) {
          return { status: 200, body: hookCtx.resource || [], headers: ctx.response.headers }
        }

        // Parse query params
        const { filter, sort, take, skip, include } = validateQueryParams(
          req.query as Record<string, unknown>
        )

        // Merge with hook filters
        const where = { ...filter, ...hookCtx.filters }

        // Execute query
        const data = await driver.findMany(entity.name, {
          where,
          orderBy: Object.keys(sort).length > 0 ? sort : undefined,
          take,
          skip,
          include: Object.keys(include).length > 0 ? include : undefined,
        })

        const total = await driver.count(entity.name, where)

        return {
          status: 200,
          body: {
            data,
            pagination: { total, limit: take, offset: skip },
          },
          headers: ctx.response.headers,
        }
      }

      // CREATE
      if (operation === "create") {
        const input = (req.body as Record<string, unknown>) || {}

        // Validate input
        const validation = validateInput(entity, input, "create")
        if (!validation.valid) {
          return validationError(validation.errors)
        }

        // Check rules
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

        // Update hook context
        hookCtx.setInput(validation.data)

        // Auto-set owner field
        if (entity.config.ownerField && req.user) {
          hookCtx.setInput({ [entity.config.ownerField]: req.user.id })
        }

        // Execute beforeCreate hook
        await executeHook("beforeCreate", hookCtx, plugins)
        if (hookCtx.stopped) {
          return { status: 201, body: hookCtx.resource, headers: ctx.response.headers }
        }

        // Create resource
        const created = await driver.create(entity.name, hookCtx.input)

        // Execute afterCreate hook
        hookCtx.setResource(created as Record<string, unknown>)
        await executeHook("afterCreate", hookCtx, plugins)

        return { status: 201, body: created, headers: ctx.response.headers }
      }

      // READ
      if (operation === "read" && resourceId) {
        // Execute beforeRead hook
        await executeHook("beforeRead", hookCtx, plugins)

        // Build where clause
        const where = { id: resourceId, ...hookCtx.filters }

        // Find resource
        const resource = await driver.findOne<Record<string, unknown>>(entity.name, where)

        if (!resource) {
          return notFoundError(`${capitalize(entity.name)} not found`)
        }

        // Check rules
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

        // Parse includes
        const { include } = validateQueryParams(req.query as Record<string, unknown>)

        // Re-fetch with includes if needed
        let result = resource
        if (Object.keys(include).length > 0) {
          const withIncludes = await driver.findOne(entity.name, { id: resourceId })
          if (withIncludes) result = withIncludes as Record<string, unknown>
        }

        return { status: 200, body: result, headers: ctx.response.headers }
      }

      // UPDATE
      if (operation === "update" && resourceId) {
        // Find existing resource
        const existing = await driver.findOne<Record<string, unknown>>(entity.name, {
          id: resourceId,
        })

        if (!existing) {
          return notFoundError(`${capitalize(entity.name)} not found`)
        }

        const input = (req.body as Record<string, unknown>) || {}

        // Validate input
        const validation = validateInput(entity, input, "update")
        if (!validation.valid) {
          return validationError(validation.errors)
        }

        // Check rules
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

        // Update hook context
        hookCtx.setInput(validation.data)
        hookCtx.setResource(existing)

        // Execute beforeUpdate hook
        await executeHook("beforeUpdate", hookCtx, plugins)
        if (hookCtx.stopped) {
          return { status: 200, body: hookCtx.resource, headers: ctx.response.headers }
        }

        // Update resource
        const updated = await driver.update(entity.name, { id: resourceId }, hookCtx.input)

        // Execute afterUpdate hook
        hookCtx.setResource(updated as Record<string, unknown>)
        await executeHook("afterUpdate", hookCtx, plugins)

        return { status: 200, body: updated, headers: ctx.response.headers }
      }

      // DELETE
      if (operation === "delete" && resourceId) {
        // Find existing resource
        const existing = await driver.findOne<Record<string, unknown>>(entity.name, {
          id: resourceId,
        })

        if (!existing) {
          return notFoundError(`${capitalize(entity.name)} not found`)
        }

        // Check rules
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

        // Update hook context
        hookCtx.setResource(existing)

        // Execute beforeDelete hook
        await executeHook("beforeDelete", hookCtx, plugins)
        if (hookCtx.stopped) {
          return { status: 204, body: null, headers: ctx.response.headers }
        }

        // Delete resource
        await driver.delete(entity.name, { id: resourceId })

        // Execute afterDelete hook
        await executeHook("afterDelete", hookCtx, plugins)

        return { status: 204, body: null, headers: ctx.response.headers }
      }

      return notFoundError("Endpoint not found")
    } catch (error) {
      return handleError(error)
    }
  }

  async function handleRequest(req: ZapiRequest): Promise<ZapiResponse> {
    try {
      // Initialize context
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
  // Instance
  // -----------------------------------------------------------------------------

  const instance: ZapiInstance = {
    config,
    entities,
    plugins,
    middleware,
    driver,

    handleRequest,

    getEntity(name: string) {
      return entities.get(name)
    },

    getDriver() {
      return driver
    },
  }

  // Now collect plugin middleware and routes (they may need the instance)
  const pluginMiddleware = collectMiddleware(plugins, instance)
  middleware.push(...pluginMiddleware)

  pluginRoutes = collectRoutes(plugins, instance)

  // Initialize plugins (async, but we don't await here)
  initializePlugins(plugins, instance).catch(console.error)

  return instance
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
