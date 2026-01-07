// =============================================================================
// ENDPOINT ABSTRACTION LAYER
// Custom endpoints that map to entities (entity-first approach)
// =============================================================================

import type { NevrRequest, NevrResponse, NevrInstance, Driver, Entity } from "../../types.js"
import type { EndpointDefinition, PluginFieldDef, PluginFieldDefObject } from "./contract.js"
import { resolvePluginFieldDef } from "./resolver.js"
import type { NevrContext, EndpointContext, EndpointOptions } from "./api.js"
import { APIError } from "./api.js"

// -----------------------------------------------------------------------------
// Entity Operation Types
// Single endpoint can perform multiple entity operations
// -----------------------------------------------------------------------------

export type EntityOperationType = "create" | "update" | "delete" | "read" | "list"

export interface EntityOperation<TEntity extends string = string> {
  /** Target entity name */
  entity: TEntity

  /** Operation type */
  operation: EntityOperationType

  /** Data for the operation (for create/update) */
  data?: Record<string, unknown> | ((ctx: EndpointContext) => Record<string, unknown> | Promise<Record<string, unknown>>)

  /** Where clause (for update/delete/read) */
  where?: Record<string, unknown> | ((ctx: EndpointContext) => Record<string, unknown> | Promise<Record<string, unknown>>)

  /** Optional: Transform the result */
  transform?: (result: unknown, ctx: EndpointContext) => unknown | Promise<unknown>

  /** Optional: Condition to run this operation */
  condition?: (ctx: EndpointContext) => boolean | Promise<boolean>
}

// -----------------------------------------------------------------------------
// Multi-Entity Transaction
// Execute multiple entity operations atomically
// -----------------------------------------------------------------------------

export interface TransactionConfig {
  /** Operations to execute in order */
  operations: EntityOperation[]

  /** If true, all operations must succeed or all fail */
  atomic?: boolean

  /** Custom error handler */
  onError?: (error: Error, ctx: EndpointContext) => void | Promise<void>

  /** Called after all operations complete successfully */
  onSuccess?: (results: Record<string, unknown>, ctx: EndpointContext) => void | Promise<void>
}

/**
 * Execute multiple entity operations in a transaction
 *
 * @example
 * ```typescript
 * // /sign-up endpoint that creates User + Profile
 * const signUpTransaction = transaction({
 *   atomic: true,
 *   operations: [
 *     {
 *       entity: "user",
 *       operation: "create",
 *       data: (ctx) => ({
 *         email: ctx.body.email,
 *         password: hashPassword(ctx.body.password),
 *       }),
 *     },
 *     {
 *       entity: "profile",
 *       operation: "create",
 *       data: (ctx) => ({
 *         userId: ctx.results.user.id,
 *         displayName: ctx.body.name,
 *       }),
 *     },
 *   ],
 * })
 * ```
 */
export function transaction(config: TransactionConfig) {
  return async (ctx: EndpointContext): Promise<Record<string, unknown>> => {
    const results: Record<string, unknown> = {}
    const driver = ctx.context.driver as Driver

    // If atomic, use transaction if driver supports it
    const executeOps = async (txDriver: Driver) => {
      for (const op of config.operations) {
        // Check condition
        if (op.condition) {
          const shouldRun = await op.condition(ctx)
          if (!shouldRun) continue
        }

        let result: unknown

        switch (op.operation) {
          case "create": {
            const data = typeof op.data === "function"
              ? await op.data({ ...ctx, results } as EndpointContext)
              : op.data || {}
            result = await txDriver.create(op.entity, data)
            break
          }

          case "update": {
            const where = typeof op.where === "function"
              ? await op.where({ ...ctx, results } as EndpointContext)
              : op.where || {}
            const data = typeof op.data === "function"
              ? await op.data({ ...ctx, results } as EndpointContext)
              : op.data || {}
            result = await txDriver.update(op.entity, where, data)
            break
          }

          case "delete": {
            const where = typeof op.where === "function"
              ? await op.where({ ...ctx, results } as EndpointContext)
              : op.where || {}
            await txDriver.delete(op.entity, where)
            result = { deleted: true }
            break
          }

          case "read": {
            const where = typeof op.where === "function"
              ? await op.where({ ...ctx, results } as EndpointContext)
              : op.where || {}
            result = await txDriver.findOne(op.entity, where)
            break
          }

          case "list": {
            const where = typeof op.where === "function"
              ? await op.where({ ...ctx, results } as EndpointContext)
              : op.where
            result = await txDriver.findMany(op.entity, where ? { where } : undefined)
            break
          }
        }

        // Apply transform if provided
        if (op.transform) {
          result = await op.transform(result, { ...ctx, results } as EndpointContext)
        }

        // Store result by entity name
        results[op.entity] = result
      }

      return results
    }

    try {
      let finalResults: Record<string, unknown>

      if (config.atomic && driver.transaction) {
        finalResults = await driver.transaction(async (tx) => {
          return executeOps(tx)
        })
      } else {
        finalResults = await executeOps(driver)
      }

      // Call success handler
      if (config.onSuccess) {
        await config.onSuccess(finalResults, ctx)
      }

      return finalResults
    } catch (error) {
      if (config.onError) {
        await config.onError(error as Error, ctx)
      }
      throw error
    }
  }
}

// -----------------------------------------------------------------------------
// Route Mapping
// Map public routes to entity operations
// -----------------------------------------------------------------------------

export interface RouteMapping {
  /** Public endpoint path (e.g., "/sign-up") */
  path: string

  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

  /** Description for documentation */
  description?: string

  /**
   * Entity operations this route performs
   * Can be single or multiple (transaction)
   */
  operations: EntityOperation | EntityOperation[]

  /**
   * If true, wrap operations in a transaction
   * @default true for multiple operations
   */
  atomic?: boolean

  /**
   * Validation for request body
   */
  validate?: (body: unknown) => { valid: boolean; errors?: string[] }

  /**
   * Fields to include in response
   * By default, returns the result of all operations
   */
  response?: {
    /** Which entity result to return */
    entity?: string
    /** Fields to pick */
    pick?: string[]
    /** Fields to omit */
    omit?: string[]
    /** Custom transform */
    transform?: (results: Record<string, unknown>) => unknown
  }
}

/**
 * Create a route that maps to entity operations
 *
 * @example
 * ```typescript
 * // Simple: /sign-up creates a user
 * const signUp = mapRoute({
 *   path: "/sign-up",
 *   method: "POST",
 *   operations: {
 *     entity: "user",
 *     operation: "create",
 *     data: (ctx) => ({
 *       email: ctx.body.email,
 *       password: hashPassword(ctx.body.password),
 *     }),
 *   },
 *   response: {
 *     entity: "user",
 *     omit: ["password"],
 *   },
 * })
 *
 * // Complex: /sign-up creates user + profile + settings
 * const signUpFull = mapRoute({
 *   path: "/sign-up",
 *   method: "POST",
 *   atomic: true,
 *   operations: [
 *     { entity: "user", operation: "create", data: (ctx) => ({ ... }) },
 *     { entity: "profile", operation: "create", data: (ctx) => ({ ... }) },
 *     { entity: "settings", operation: "create", data: (ctx) => ({ ... }) },
 *   ],
 * })
 * ```
 */
export function mapRoute(config: RouteMapping): EndpointDefinition {
  const operations = Array.isArray(config.operations)
    ? config.operations
    : [config.operations]

  const isAtomic = config.atomic ?? operations.length > 1

  return {
    method: config.method,
    path: config.path,
    handler: async (ctx: EndpointContext) => {
      // Validate if provided
      if (config.validate && ctx.body) {
        const validation = config.validate(ctx.body)
        if (!validation.valid) {
          throw new APIError("BAD_REQUEST", {
            message: "Validation failed",
            details: { errors: validation.errors },
          })
        }
      }

      // Execute operations
      const executor = transaction({
        operations,
        atomic: isAtomic,
      })

      const results = await executor(ctx)

      // Format response
      if (config.response) {
        if (config.response.transform) {
          return config.response.transform(results)
        }

        let data = config.response.entity
          ? results[config.response.entity]
          : results

        if (data && typeof data === "object") {
          if (config.response.pick) {
            const picked: Record<string, unknown> = {}
            for (const key of config.response.pick) {
              if (key in (data as Record<string, unknown>)) {
                picked[key] = (data as Record<string, unknown>)[key]
              }
            }
            data = picked
          }

          if (config.response.omit) {
            const result = { ...(data as Record<string, unknown>) }
            for (const key of config.response.omit) {
              delete result[key]
            }
            data = result
          }
        }

        return data
      }

      return results
    },
  }
}

// -----------------------------------------------------------------------------
// Entity Context Operations
// Used in endpoint handlers to work with entities
// -----------------------------------------------------------------------------

export interface EntityContext {
  /**
   * Create a record in an entity
   */
  create: <T = unknown>(entity: string, data: Record<string, unknown>) => Promise<T>

  /**
   * Find one record
   */
  findOne: <T = unknown>(entity: string, where: Record<string, unknown>) => Promise<T | null>

  /**
   * Find many records
   */
  findMany: <T = unknown>(entity: string, where?: Record<string, unknown>) => Promise<T[]>

  /**
   * Update a record
   */
  update: <T = unknown>(entity: string, where: Record<string, unknown>, data: Record<string, unknown>) => Promise<T>

  /**
   * Delete a record
   */
  delete: (entity: string, where: Record<string, unknown>) => Promise<void>

  /**
   * Run multiple operations in a transaction
   */
  transaction: <T>(fn: (ctx: EntityContext) => Promise<T>) => Promise<T>
}

/**
 * Create entity context from driver
 */
export function createEntityContext(driver: Driver): EntityContext {
  return {
    create: (entity, data) => driver.create(entity, data),
    findOne: (entity, where) => driver.findOne(entity, where),
    findMany: (entity, where) => driver.findMany(entity, where ? { where } : undefined),
    update: (entity, where, data) => driver.update(entity, where, data),
    delete: (entity, where) => driver.delete(entity, where),
    transaction: async (fn) => {
      if (driver.transaction) {
        return driver.transaction(async (tx) => {
          const txCtx = createEntityContext(tx)
          return fn(txCtx)
        })
      }
      // Fallback: run without transaction
      return fn(createEntityContext(driver))
    },
  }
}

// -----------------------------------------------------------------------------
// Input Filtering
// Remove protected fields (input: false) from client data
// -----------------------------------------------------------------------------

/**
 * Filter input data based on field definitions
 * Removes fields where input: false
 */
export function filterInput(
  data: Record<string, unknown>,
  fields: Record<string, PluginFieldDef>
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const rawField = fields[key]

    // If field is not defined in schema, skip it (security)
    if (!rawField) continue

    // Resolve FieldBuilder to plain object
    const field = resolvePluginFieldDef(rawField)

    // If input is explicitly false, skip it (protected)
    if (field.input === false) continue

    // Apply input transform if provided
    if (field.transform?.input) {
      filtered[key] = field.transform.input(value)
    } else {
      filtered[key] = value
    }
  }

  return filtered
}

/**
 * Filter output data based on field definitions
 * Removes fields where returned: false
 */
export function filterOutput(
  data: Record<string, unknown>,
  fields: Record<string, PluginFieldDef>
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const rawField = fields[key]

    // Resolve FieldBuilder to plain object if present
    const field = rawField ? resolvePluginFieldDef(rawField) : undefined

    // If returned is explicitly false, skip it
    if (field?.returned === false) continue

    // Apply output transform if provided
    if (field?.transform?.output) {
      filtered[key] = field.transform.output(value)
    } else {
      filtered[key] = value
    }
  }

  return filtered
}
