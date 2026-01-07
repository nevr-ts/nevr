// =============================================================================
// NEVR API HELPERS
// Utilities for creating typed endpoints and middleware
// =============================================================================

import type { NevrRequest, NevrResponse, NevrInstance, Driver, User } from "../../types.js"
import type { NevrPlugin, PluginSchema } from "./contract.js"

// -----------------------------------------------------------------------------
// Request Hook Context
// Used by before/after hooks to intercept requests
// -----------------------------------------------------------------------------

export interface HookEndpointContext {
  /** The request path (e.g., "/auth/sign-in") */
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

  /** The authenticated user (if any) */
  user?: User | null

  /** The Nevr context with driver, plugins, etc. */
  context: NevrContext

  /** After hooks only: the response returned by the endpoint */
  returned?: unknown

  /** Headers to be added to the response */
  responseHeaders?: Headers | Record<string, string>
}

export interface NevrContext {
  /** The Nevr instance */
  nevr: NevrInstance

  /** Database driver */
  driver: Driver

  /** Secret key for crypto operations */
  secret?: string

  /** Internal adapter for database operations */
  internalAdapter: InternalAdapter

  /** Plugin options */
  options?: Record<string, unknown>

  /** New session created during request (for after hooks) */
  newSession?: { user: unknown; session: unknown }
}

// -----------------------------------------------------------------------------
// Internal Adapter
// Provides type-safe database operations for plugins
// -----------------------------------------------------------------------------

export interface InternalAdapter {
  // User operations
  createUser: (data: Record<string, unknown>) => Promise<Record<string, unknown>>
  findUserById: (id: string) => Promise<Record<string, unknown> | null>
  findUserByEmail: (email: string) => Promise<Record<string, unknown> | null>
  updateUser: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>
  deleteUser: (id: string) => Promise<void>

  // Session operations
  createSession: (data: Record<string, unknown>) => Promise<Record<string, unknown>>
  findSessionByToken: (token: string) => Promise<Record<string, unknown> | null>
  findSessionsByUserId: (userId: string) => Promise<Record<string, unknown>[]>
  updateSession: (token: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>
  deleteSession: (token: string) => Promise<void>
  deleteSessionsByUserId: (userId: string) => Promise<void>

  // Generic operations
  create: <T>(entity: string, data: Record<string, unknown>) => Promise<T>
  findOne: <T>(entity: string, where: Record<string, unknown>) => Promise<T | null>
  findMany: <T>(entity: string, where?: Record<string, unknown>) => Promise<T[]>
  update: <T>(entity: string, where: Record<string, unknown>, data: Record<string, unknown>) => Promise<T>
  delete: (entity: string, where: Record<string, unknown>) => Promise<void>
}

// -----------------------------------------------------------------------------
// Auth Middleware Type
// Function that intercepts requests
// -----------------------------------------------------------------------------

export type NevrMiddleware<TReturn = unknown> = (
  ctx: EndpointContext
) => Promise<TReturn | void>

// -----------------------------------------------------------------------------
// Endpoint Context
// Passed to endpoint handlers
// -----------------------------------------------------------------------------

export interface EndpointContext<
  TPath extends string = string,
  TOptions extends EndpointOptions = EndpointOptions
> {
  /** Request path */
  path: TPath

  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

  /** Validated request body */
  body: TOptions extends { body: infer B } ? B : Record<string, unknown>

  /** Query parameters */
  query: TOptions extends { query: infer Q } ? Q : Record<string, unknown>

  /** URL parameters */
  params: Record<string, string>

  /** Request headers */
  headers: Record<string, string | undefined>

  /** Raw request object */
  request: NevrRequest

  /** Nevr context */
  context: NevrContext

  /** Create JSON response */
  json: <T>(data: T, status?: number) => NevrResponse

  /** Set response header */
  setHeader: (name: string, value: string) => void

  /** Get response headers */
  getResponseHeaders: () => Record<string, string>

  /** Redirect response */
  redirect: (url: string, status?: 301 | 302 | 307 | 308) => NevrResponse
}

export interface EndpointOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  use?: NevrMiddleware[]
  metadata?: {
    openapi?: {
      summary?: string
      description?: string
      tags?: string[]
      responses?: Record<string, unknown>
    }
  }
}

export interface Endpoint<
  TPath extends string = string,
  TOptions extends EndpointOptions = EndpointOptions,
  TReturn = unknown
> {
  path: TPath
  options: TOptions
  handler: (ctx: EndpointContext<TPath, TOptions>) => Promise<TReturn>
}

// -----------------------------------------------------------------------------
// API Error
// Standardized error type for endpoints
// -----------------------------------------------------------------------------

export class APIError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details?: Record<string, unknown>

  constructor(
    type: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR",
    options: { message: string; code?: string; details?: Record<string, unknown> }
  ) {
    super(options.message)
    this.name = "APIError"
    this.code = options.code || type
    this.details = options.details

    switch (type) {
      case "BAD_REQUEST":
        this.status = 400
        break
      case "UNAUTHORIZED":
        this.status = 401
        break
      case "FORBIDDEN":
        this.status = 403
        break
      case "NOT_FOUND":
        this.status = 404
        break
      case "CONFLICT":
        this.status = 409
        break
      case "INTERNAL_ERROR":
      default:
        this.status = 500
    }
  }

  toResponse(): NevrResponse {
    return {
      status: this.status,
      body: {
        error: this.message,
        code: this.code,
        ...(this.details && { details: this.details }),
      },
    }
  }
}

// -----------------------------------------------------------------------------
// Create Nevr Middleware
// Create Nevr Middleware
// -----------------------------------------------------------------------------

export function createNevrMiddleware<TReturn = unknown>(
  handler: (ctx: EndpointContext) => Promise<TReturn | void>
): NevrMiddleware<TReturn> {
  return handler
}

// -----------------------------------------------------------------------------
// Create Nevr Endpoint
// Create Nevr Endpoint
// -----------------------------------------------------------------------------

export function createNevrEndpoint<
  TPath extends string,
  TOptions extends EndpointOptions,
  TReturn
>(
  path: TPath,
  options: TOptions,
  handler: (ctx: EndpointContext<TPath, TOptions>) => Promise<TReturn>
): Endpoint<TPath, TOptions, TReturn> {
  return {
    path,
    options,
    handler: async (ctx) => {
      // Execute middleware chain
      if (options.use && options.use.length > 0) {
        for (const middleware of options.use) {
          const result = await middleware(ctx)
          // If middleware returns a response, stop the chain
          if (result !== undefined) {
            return result as TReturn
          }
        }
      }

      // Execute handler
      return handler(ctx)
    },
  }
}

// -----------------------------------------------------------------------------
// Request Hooks
// Before/after hooks for intercepting endpoint execution
// -----------------------------------------------------------------------------

export interface RequestHook {
  /** Function to determine if this hook applies to the request */
  matcher: (context: HookEndpointContext) => boolean

  /** Handler function to execute if matcher returns true */
  handler: NevrMiddleware
}

export interface RequestHooks {
  /** Hooks executed before the endpoint handler */
  before?: RequestHook[]

  /** Hooks executed after the endpoint handler */
  after?: RequestHook[]
}

// -----------------------------------------------------------------------------
// Database Hooks
// Hooks for entity operations
// -----------------------------------------------------------------------------

export interface EntityHookContext<T = Record<string, unknown>> {
  data: T
  context: NevrContext
}

export interface EntityHook<T = Record<string, unknown>> {
  before?: (ctx: EntityHookContext<T>) => Promise<{ data: T } | void>
  after?: (ctx: EntityHookContext<T>) => Promise<{ data: T } | void>
}

export interface DatabaseHooks {
  user?: {
    create?: EntityHook
    update?: EntityHook
    delete?: EntityHook
  }
  session?: {
    create?: EntityHook
    update?: EntityHook
    delete?: EntityHook
  }
  [entity: string]: {
    create?: EntityHook
    update?: EntityHook
    delete?: EntityHook
  } | undefined
}

// -----------------------------------------------------------------------------
// Plugin Init Return
// What plugins can return from their init function
// -----------------------------------------------------------------------------

export interface PluginInitReturn {
  /** Modify the Nevr context */
  context?: Partial<NevrContext>

  /** Modify plugin options */
  options?: Record<string, unknown>

  /** Database hooks to be merged */
  databaseHooks?: DatabaseHooks
}

// -----------------------------------------------------------------------------
// Schema Helpers
// -----------------------------------------------------------------------------

/**
 * Merge two schemas together
 * Useful for plugins that allow schema extension
 */
export function mergeSchema(
  base: PluginSchema | undefined,
  extension: PluginSchema | undefined
): PluginSchema {
  if (!base && !extension) return {}
  if (!base) return extension!
  if (!extension) return base

  return {
    entities: {
      ...base.entities,
      ...extension.entities,
    },
    extend: {
      ...base.extend,
      ...extension.extend,
    },
  }
}

// -----------------------------------------------------------------------------
// Endpoint Response Helpers
// -----------------------------------------------------------------------------

/**
 * Get the response data from a hook context
 * Used in after hooks to access the endpoint response
 */
export async function getEndpointResponse<T>(ctx: EndpointContext): Promise<T | null> {
  const hookCtx = ctx as unknown as HookEndpointContext
  if (hookCtx.returned === undefined) return null
  return hookCtx.returned as T
}

// -----------------------------------------------------------------------------
// Create Internal Adapter
// Creates the internal adapter from a driver
// -----------------------------------------------------------------------------

export function createInternalAdapter(driver: Driver): InternalAdapter {
  return {
    // User operations
    createUser: (data) => driver.create("user", data),
    findUserById: (id) => driver.findOne("user", { id }),
    findUserByEmail: (email) => driver.findOne("user", { email }),
    updateUser: (id, data) => driver.update("user", { id }, data),
    deleteUser: (id) => driver.delete("user", { id }),

    // Session operations
    createSession: (data) => driver.create("session", data),
    findSessionByToken: (token) => driver.findOne("session", { token }),
    findSessionsByUserId: (userId) => driver.findMany("session", { where: { userId } }),
    updateSession: (token, data) => driver.update("session", { token }, data),
    deleteSession: (token) => driver.delete("session", { token }),
    deleteSessionsByUserId: (userId) => driver.delete("session", { userId }),

    // Generic operations
    create: (entity, data) => driver.create(entity, data),
    findOne: (entity, where) => driver.findOne(entity, where),
    findMany: (entity, where) => driver.findMany(entity, where ? { where } : undefined),
    update: (entity, where, data) => driver.update(entity, where, data),
    delete: (entity, where) => driver.delete(entity, where),
  }
}
