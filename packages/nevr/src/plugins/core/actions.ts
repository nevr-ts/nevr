// =============================================================================
// ENTITY ACTIONS
// Non-CRUD operations that can be attached to entities
// Entity-first approach to custom operations
// =============================================================================

import type { NevrRequest, NevrResponse, NevrInstance, Driver, User } from "../../types.js"
import type { EndpointContext, NevrContext } from "./api.js"
import { APIError } from "./api.js"

// -----------------------------------------------------------------------------
// Action Types
// -----------------------------------------------------------------------------

export type ActionMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface ActionContext<TInput = unknown> {
  /** The input data (body for POST/PUT/PATCH, query for GET) */
  input: TInput
  /** URL parameters */
  params: Record<string, string>
  /** Query parameters */
  query: Record<string, string | string[] | undefined>
  /** Request headers */
  headers: Record<string, string | undefined>
  /** Authenticated user (if any) */
  user: User | null
  /** Database driver */
  driver: Driver
  /** Entity name this action belongs to */
  entity: string
  /** Full Nevr context */
  context: NevrContext
  /** Raw request */
  request: NevrRequest
}

export interface ActionResult<TOutput = unknown> {
  /** Response data */
  data?: TOutput
  /** HTTP status code */
  status?: number
  /** Response headers */
  headers?: Record<string, string>
  /** Redirect URL */
  redirect?: string
}

export type ActionHandler<TInput = unknown, TOutput = unknown> = (
  ctx: ActionContext<TInput>
) => Promise<TOutput | ActionResult<TOutput>>

// -----------------------------------------------------------------------------
// Action Definition
// -----------------------------------------------------------------------------

export interface ActionDefinition<TInput = unknown, TOutput = unknown> {
  /** HTTP method */
  method?: ActionMethod
  /** Action path (relative to entity, e.g., "/:id/activate") */
  path?: string
  /** Action description */
  description?: string
  /** Whether authentication is required */
  requireAuth?: boolean
  /** Allowed roles (if requireAuth is true) */
  roles?: string[]
  /** Input validation */
  validate?: (input: unknown) => { valid: boolean; errors?: string[] }
  /** The action handler */
  handler: ActionHandler<TInput, TOutput>
  /** Metadata for type inference */
  $input?: TInput
  $output?: TOutput
}

// -----------------------------------------------------------------------------
// Action Builder (Fluent API)
// -----------------------------------------------------------------------------

export class ActionBuilder<TInput = unknown, TOutput = unknown> {
  private _method: ActionMethod = "POST"
  private _path?: string
  private _description?: string
  private _requireAuth = false
  private _roles?: string[]
  private _validate?: (input: unknown) => { valid: boolean; errors?: string[] }
  private _handler?: ActionHandler<TInput, TOutput>

  /**
   * Set HTTP method
   */
  method(method: ActionMethod): this {
    this._method = method
    return this
  }

  /**
   * Set action path
   */
  path(path: string): this {
    this._path = path
    return this
  }

  /**
   * Set description
   */
  describe(description: string): this {
    this._description = description
    return this
  }

  /**
   * Require authentication
   */
  auth(roles?: string[]): this {
    this._requireAuth = true
    this._roles = roles
    return this
  }

  /**
   * Add input validation
   */
  validate(fn: (input: unknown) => { valid: boolean; errors?: string[] }): this {
    this._validate = fn
    return this
  }

  /**
   * Set the handler
   * Uses type assertion to preserve fluent API with changing generics
   */
  handle<I = TInput, O = TOutput>(
    handler: ActionHandler<I, O>
  ): ActionBuilder<I, O> {
    // Type assertion needed for fluent API pattern with changing generics
    (this._handler as unknown) = handler
    return this as unknown as ActionBuilder<I, O>
  }

  /**
   * Build the action definition
   */
  build(): ActionDefinition<TInput, TOutput> {
    if (!this._handler) {
      throw new Error("Action handler is required")
    }

    return {
      method: this._method,
      path: this._path,
      description: this._description,
      requireAuth: this._requireAuth,
      roles: this._roles,
      validate: this._validate,
      handler: this._handler,
    }
  }
}

// -----------------------------------------------------------------------------
// Action Factory Functions
// -----------------------------------------------------------------------------

/**
 * Create a new action builder
 */
export function action<TInput = unknown, TOutput = unknown>(): ActionBuilder<TInput, TOutput> {
  return new ActionBuilder<TInput, TOutput>()
}

/**
 * Create a GET action
 */
export function getAction<TOutput = unknown>(
  handler: ActionHandler<Record<string, string>, TOutput>
): ActionDefinition<Record<string, string>, TOutput> {
  return {
    method: "GET",
    handler,
  }
}

/**
 * Create a POST action
 */
export function postAction<TInput = unknown, TOutput = unknown>(
  handler: ActionHandler<TInput, TOutput>
): ActionDefinition<TInput, TOutput> {
  return {
    method: "POST",
    handler,
  }
}

// -----------------------------------------------------------------------------
// Common Actions (Pre-built)
// -----------------------------------------------------------------------------

/**
 * Soft delete action - sets deletedAt instead of hard delete
 */
export function softDeleteAction(
  fieldName = "deletedAt"
): ActionDefinition<{ id: string }, { success: boolean }> {
  return {
    method: "DELETE",
    path: "/:id/soft",
    description: "Soft delete a record",
    handler: async (ctx) => {
      const { id } = ctx.params
      await ctx.driver.update(ctx.entity, { id }, { [fieldName]: new Date() })
      return { success: true }
    },
  }
}

/**
 * Restore action - clears deletedAt
 */
export function restoreAction(
  fieldName = "deletedAt"
): ActionDefinition<{ id: string }, { success: boolean }> {
  return {
    method: "POST",
    path: "/:id/restore",
    description: "Restore a soft-deleted record",
    handler: async (ctx) => {
      const { id } = ctx.params
      await ctx.driver.update(ctx.entity, { id }, { [fieldName]: null })
      return { success: true }
    },
  }
}

/**
 * Archive action - sets archived flag
 */
export function archiveAction(): ActionDefinition<{ id: string }, { success: boolean }> {
  return {
    method: "POST",
    path: "/:id/archive",
    description: "Archive a record",
    handler: async (ctx) => {
      const { id } = ctx.params
      await ctx.driver.update(ctx.entity, { id }, { archived: true })
      return { success: true }
    },
  }
}

/**
 * Unarchive action
 */
export function unarchiveAction(): ActionDefinition<{ id: string }, { success: boolean }> {
  return {
    method: "POST",
    path: "/:id/unarchive",
    description: "Unarchive a record",
    handler: async (ctx) => {
      const { id } = ctx.params
      await ctx.driver.update(ctx.entity, { id }, { archived: false })
      return { success: true }
    },
  }
}

/**
 * Clone/duplicate action
 */
export function cloneAction<T = unknown>(
  fieldsToExclude = ["id", "createdAt", "updatedAt"]
): ActionDefinition<{ id: string }, T> {
  return {
    method: "POST",
    path: "/:id/clone",
    description: "Clone a record",
    handler: async (ctx) => {
      const { id } = ctx.params
      const original = await ctx.driver.findOne<Record<string, unknown>>(ctx.entity, { id })

      if (!original) {
        throw new APIError("NOT_FOUND", { message: "Record not found" })
      }

      // Remove excluded fields
      const cloneData: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(original)) {
        if (!fieldsToExclude.includes(key)) {
          cloneData[key] = value
        }
      }

      return ctx.driver.create<T>(ctx.entity, cloneData)
    },
  }
}

/**
 * Bulk update action
 */
export function bulkUpdateAction<T = unknown>(): ActionDefinition<
  { ids: string[]; data: Record<string, unknown> },
  { count: number }
> {
  return {
    method: "PUT",
    path: "/bulk",
    description: "Update multiple records",
    handler: async (ctx) => {
      const { ids, data } = ctx.input
      let count = 0

      // Use updateMany if available
      if (ctx.driver.updateMany) {
        const result = await ctx.driver.updateMany(ctx.entity, { id: { in: ids } }, data)
        count = result.count
      } else {
        // Fallback to individual updates
        for (const id of ids) {
          await ctx.driver.update(ctx.entity, { id }, data)
          count++
        }
      }

      return { count }
    },
  }
}

/**
 * Bulk delete action
 */
export function bulkDeleteAction(): ActionDefinition<{ ids: string[] }, { count: number }> {
  return {
    method: "DELETE",
    path: "/bulk",
    description: "Delete multiple records",
    handler: async (ctx) => {
      const { ids } = ctx.input
      let count = 0

      // Use deleteMany if available
      if (ctx.driver.deleteMany) {
        const result = await ctx.driver.deleteMany(ctx.entity, { id: { in: ids } })
        count = result.count
      } else {
        // Fallback to individual deletes
        for (const id of ids) {
          await ctx.driver.delete(ctx.entity, { id })
          count++
        }
      }

      return { count }
    },
  }
}

/**
 * Toggle field action (for boolean fields)
 */
export function toggleAction(
  field: string
): ActionDefinition<{ id: string }, { [key: string]: boolean }> {
  return {
    method: "POST",
    path: `/:id/toggle-${field}`,
    description: `Toggle the ${field} field`,
    handler: async (ctx) => {
      const { id } = ctx.params
      const record = await ctx.driver.findOne<Record<string, unknown>>(ctx.entity, { id })

      if (!record) {
        throw new APIError("NOT_FOUND", { message: "Record not found" })
      }

      const newValue = !record[field]
      await ctx.driver.update(ctx.entity, { id }, { [field]: newValue })

      return { [field]: newValue }
    },
  }
}

/**
 * Export action - returns all records in specified format
 */
export function exportAction<T = unknown>(): ActionDefinition<
  { format?: "json" | "csv" },
  T[] | string
> {
  return {
    method: "GET",
    path: "/export",
    description: "Export all records",
    handler: async (ctx) => {
      const format = (ctx.query.format as string) || "json"
      const records = await ctx.driver.findMany<T>(ctx.entity)

      if (format === "csv") {
        // Simple CSV conversion
        if (records.length === 0) return ""
        const headers = Object.keys(records[0] as object)
        const rows = records.map(r =>
          headers.map(h => JSON.stringify((r as Record<string, unknown>)[h] ?? "")).join(",")
        )
        return [headers.join(","), ...rows].join("\n")
      }

      return records
    },
  }
}

/**
 * Count action - returns count with optional filters
 */
export function countAction(): ActionDefinition<Record<string, unknown>, { count: number }> {
  return {
    method: "GET",
    path: "/count",
    description: "Count records",
    handler: async (ctx) => {
      const where = ctx.query as Record<string, unknown>
      const count = await ctx.driver.count(ctx.entity, Object.keys(where).length > 0 ? where : undefined)
      return { count }
    },
  }
}

/**
 * Exists action - check if record exists
 */
export function existsAction(): ActionDefinition<{ id: string }, { exists: boolean }> {
  return {
    method: "GET",
    path: "/:id/exists",
    description: "Check if record exists",
    handler: async (ctx) => {
      const { id } = ctx.params

      if (ctx.driver.exists) {
        return { exists: await ctx.driver.exists(ctx.entity, { id }) }
      }

      const record = await ctx.driver.findOne(ctx.entity, { id })
      return { exists: record !== null }
    },
  }
}

// -----------------------------------------------------------------------------
// Entity Actions Registry
// -----------------------------------------------------------------------------

export interface EntityActions {
  [actionName: string]: ActionDefinition<any, any>
}

/**
 * Define actions for an entity
 *
 * @example
 * ```typescript
 * const userActions = defineActions({
 *   activate: action()
 *     .method("POST")
 *     .path("/:id/activate")
 *     .auth(["admin"])
 *     .handle(async (ctx) => {
 *       await ctx.driver.update("user", { id: ctx.params.id }, { active: true })
 *       return { success: true }
 *     })
 *     .build(),
 *
 *   deactivate: postAction(async (ctx) => {
 *     await ctx.driver.update("user", { id: ctx.params.id }, { active: false })
 *     return { success: true }
 *   }),
 *
 *   // Pre-built actions
 *   softDelete: softDeleteAction(),
 *   restore: restoreAction(),
 *   clone: cloneAction(),
 * })
 * ```
 */
export function defineActions<T extends EntityActions>(actions: T): T {
  return actions
}

// -----------------------------------------------------------------------------
// Action Executor
// -----------------------------------------------------------------------------

/**
 * Execute an action with full context
 */
export async function executeAction<TInput, TOutput>(
  action: ActionDefinition<TInput, TOutput>,
  ctx: ActionContext<TInput>
): Promise<ActionResult<TOutput>> {
  // Validate input if validator is provided
  if (action.validate) {
    const validation = action.validate(ctx.input)
    if (!validation.valid) {
      throw new APIError("BAD_REQUEST", {
        message: "Validation failed",
        details: { errors: validation.errors },
      })
    }
  }

  // Check authentication
  if (action.requireAuth && !ctx.user) {
    throw new APIError("UNAUTHORIZED", { message: "Authentication required" })
  }

  // Check roles
  if (action.roles && action.roles.length > 0) {
    const userRole = ctx.user?.role as string | undefined
    if (!userRole || !action.roles.includes(userRole)) {
      throw new APIError("FORBIDDEN", { message: "Insufficient permissions" })
    }
  }

  // Execute handler
  const result = await action.handler(ctx)

  // Normalize result
  if (
    result &&
    typeof result === "object" &&
    ("data" in result || "status" in result || "headers" in result || "redirect" in result)
  ) {
    return result as ActionResult<TOutput>
  }

  return { data: result as TOutput, status: 200 }
}
