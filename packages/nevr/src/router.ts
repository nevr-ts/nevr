// =============================================================================
// REQUEST ROUTER
// Routes requests to appropriate handlers
// =============================================================================

import type { NevrRequest, NevrResponse, Entity, Plugin, Route } from "./types.js"
import type { ResolvedEntityMeta, RouteHandler } from "./plugins/core/contract.js"

// -----------------------------------------------------------------------------
// Route Matching
// -----------------------------------------------------------------------------

export interface RouteMatch {
  type: "entity" | "plugin" | "health" | "notFound"
  entity?: Entity
  entityName?: string
  resourceId?: string
  operation?: "list" | "read" | "create" | "update" | "delete"
  pluginRoute?: Route
  /** Plugin ID that owns this entity (if any) */
  pluginId?: string
  /** Custom route handler (if entity route is overridden) */
  customHandler?: RouteHandler
  /** Whether the route is disabled */
  disabled?: boolean
}

/**
 * Pluralize entity name for URL
 */
export function pluralize(str: string): string {
  if (str.endsWith("y") && !/[aeiou]y$/.test(str)) {
    return str.slice(0, -1) + "ies"
  }
  if (/[sxz]$/.test(str) || /[cs]h$/.test(str)) {
    return str + "es"
  }
  return str + "s"
}

/**
 * Get singular from plural
 */
export function singularize(str: string): string {
  if (str.endsWith("ies")) {
    return str.slice(0, -3) + "y"
  }
  if (str.endsWith("es") && /[sxz]es$|[cs]hes$/.test(str)) {
    return str.slice(0, -2)
  }
  if (str.endsWith("s")) {
    return str.slice(0, -1)
  }
  return str
}

/**
 * Get the route path for an entity with custom pluralization support
 */
export function getEntityRoutePath(entityName: string, options?: EntityRouteOptions): string {
  // Check custom route mapping first
  if (options?.routes?.[entityName]) {
    return options.routes[entityName]
  }

  // Disable pluralization if requested
  if (options?.disablePluralization) {
    return entityName
  }

  // Use custom pluralization function if provided
  if (options?.pluralize) {
    return options.pluralize(entityName)
  }

  // Default pluralization
  return pluralize(entityName)
}

/**
 * Entity routing options
 */
export interface EntityRouteOptions {
  /**
   * Custom pluralization function
   * @example (name) => name + 's' // simple pluralization
   */
  pluralize?: (entityName: string) => string
  /**
   * Disable auto-pluralization (use entity name as-is)
   * @default false
   */
  disablePluralization?: boolean
  /**
   * Custom route mappings per entity
   * @example { user: 'users', person: 'people' }
   */
  routes?: Record<string, string>
}

/**
 * Route matching options including plugin metadata
 */
export interface MatchRouteOptions {
  /** Plugin routes to check */
  pluginRoutes?: Route[]
  /** Entity metadata from plugins (for base paths and route configs) */
  entityMeta?: Map<string, ResolvedEntityMeta>
  /** Entity routing options */
  entityRoutes?: EntityRouteOptions
}

/**
 * Match a request to a route
 */
export function matchRoute(
  req: NevrRequest,
  entities: Map<string, Entity>,
  options?: MatchRouteOptions | Route[]
): RouteMatch {
  // Handle backwards compatibility (pluginRoutes passed directly)
  const opts: MatchRouteOptions = Array.isArray(options)
    ? { pluginRoutes: options }
    : options || {}

  const { pluginRoutes, entityMeta } = opts
  const path = req.path.replace(/^\/+|\/+$/g, "") // Remove leading/trailing slashes
  const parts = path.split("/").filter(Boolean)

  // Health check
  if (path === "health" || path === "_health") {
    return { type: "health" }
  }

  // Empty path
  if (parts.length === 0) {
    return { type: "notFound" }
  }

  // Check plugin routes first
  // Sort routes so static routes take precedence over parameterized routes
  // This ensures /sign-in/username matches before /sign-in/:provider
  if (pluginRoutes) {
    // Sort routes: static routes first, parameterized routes last
    const sortedRoutes = [...pluginRoutes].sort((a, b) => {
      const aHasParams = a.path.includes(":")
      const bHasParams = b.path.includes(":")
      if (aHasParams && !bHasParams) return 1  // a comes after b
      if (!aHasParams && bHasParams) return -1 // a comes before b
      // For equal param status, prefer more specific paths (more segments)
      return b.path.split("/").length - a.path.split("/").length
    })

    for (const route of sortedRoutes) {
      if (matchPluginRoute(req.method, `/${path}`, route.method, route.path)) {
        return { type: "plugin", pluginRoute: route }
      }
    }
  }

  // Try to match plugin entity routes (with base paths)
  if (entityMeta && entityMeta.size > 0) {
    const match = matchPluginEntityRoute(req, parts, entities, entityMeta)
    if (match) return match
  }

  // Fall back to standard entity routes (for non-plugin entities)
  const resourceName = parts[0]
  const resourceId = parts[1]

  // Find entity by plural name (only non-plugin entities)
  let entity: Entity | undefined

  for (const [name, e] of entities) {
    // Skip plugin entities - they use base paths
    if (entityMeta?.has(name)) continue

    const entityPath = getEntityRoutePath(name, opts.entityRoutes)
    if (entityPath === resourceName || name === resourceName) {
      entity = e
      break
    }
  }

  if (!entity) {
    return { type: "notFound" }
  }

  // Determine operation
  const method = req.method
  let operation: RouteMatch["operation"]

  if (method === "GET" && !resourceId) {
    operation = "list"
  } else if (method === "GET" && resourceId) {
    operation = "read"
  } else if (method === "POST" && !resourceId) {
    operation = "create"
  } else if ((method === "PUT" || method === "PATCH") && resourceId) {
    operation = "update"
  } else if (method === "DELETE" && resourceId) {
    operation = "delete"
  } else {
    return { type: "notFound" }
  }

  return {
    type: "entity",
    entity,
    entityName: entity.name,
    resourceId,
    operation,
  }
}

/**
 * Match plugin entity routes with base paths
 * Example: /auth/users -> auth plugin's user entity
 */
function matchPluginEntityRoute(
  req: NevrRequest,
  parts: string[],
  entities: Map<string, Entity>,
  entityMeta: Map<string, ResolvedEntityMeta>
): RouteMatch | null {
  const method = req.method

  // Group entities by their base path for efficient matching
  const entityByPath = new Map<string, { entity: Entity; meta: ResolvedEntityMeta }>()

  for (const [name, meta] of entityMeta) {
    const entity = entities.get(name)
    if (!entity) continue

    // Build the full path for this entity
    const entityPath = meta.routePath || pluralize(name)
    const fullPath = meta.basePath
      ? `${meta.basePath.replace(/^\//, "")}/${entityPath}`
      : entityPath

    entityByPath.set(fullPath.toLowerCase(), { entity, meta })
  }

  // Try matching with 1 or 2 parts (collection or resource)
  // Format: /basePath/entityPath or /basePath/entityPath/:id
  for (let depth = 1; depth <= Math.min(parts.length, 3); depth++) {
    const pathParts = parts.slice(0, depth)
    const resourceId = parts[depth]

    // Check if this is a collection path (last part is entity path)
    const testPath = pathParts.join("/").toLowerCase()
    const match = entityByPath.get(testPath)

    if (match) {
      const { entity, meta } = match

      // Check if route is disabled (internal entity)
      if (meta.internal) {
        return { type: "notFound", disabled: true }
      }

      // Determine operation
      let operation: RouteMatch["operation"]

      if (method === "GET" && !resourceId) {
        operation = "list"
      } else if (method === "GET" && resourceId) {
        operation = "read"
      } else if (method === "POST" && !resourceId) {
        operation = "create"
      } else if ((method === "PUT" || method === "PATCH") && resourceId) {
        operation = "update"
      } else if (method === "DELETE" && resourceId) {
        operation = "delete"
      } else {
        continue // Try next depth
      }

      // Check if this specific operation is disabled
      const routeConfig = meta.routeConfig?.[operation]
      if (routeConfig === "disable" || (typeof routeConfig === "object" && routeConfig.disable)) {
        return { type: "notFound", disabled: true }
      }

      // Get custom handler if any
      let customHandler: RouteHandler | undefined
      if (typeof routeConfig === "function") {
        customHandler = routeConfig
      } else if (typeof routeConfig === "object" && routeConfig.handler) {
        customHandler = routeConfig.handler
      }

      return {
        type: "entity",
        entity,
        entityName: entity.name,
        resourceId,
        operation,
        pluginId: meta.pluginId,
        customHandler,
      }
    }
  }

  return null
}

/**
 * Match plugin route with path params
 */
function matchPluginRoute(
  reqMethod: string,
  reqPath: string,
  routeMethod: string,
  routePath: string
): boolean {
  if (reqMethod !== routeMethod) return false

  const reqParts = reqPath.split("/").filter(Boolean)
  const routeParts = routePath.split("/").filter(Boolean)

  if (reqParts.length !== routeParts.length) return false

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i]
    const reqPart = reqParts[i]

    // Path parameter (e.g., :id)
    if (routePart.startsWith(":")) {
      continue
    }

    // Exact match required
    if (routePart !== reqPart) {
      return false
    }
  }

  return true
}

/**
 * Extract path parameters
 */
export function extractParams(reqPath: string, routePath: string): Record<string, string> {
  const params: Record<string, string> = {}

  const reqParts = reqPath.split("/").filter(Boolean)
  const routeParts = routePath.split("/").filter(Boolean)

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i]
    const reqPart = reqParts[i]

    if (routePart.startsWith(":")) {
      const paramName = routePart.slice(1)
      params[paramName] = reqPart
    }
  }

  return params
}
