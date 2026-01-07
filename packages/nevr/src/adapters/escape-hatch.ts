// =============================================================================
// ADAPTER SYSTEM
// HTTP framework abstraction layer
// =============================================================================

import type { NevrInstance, NevrRequest, NevrResponse, User } from "../types.js"
import { getLogger } from "../logger.js"

// -----------------------------------------------------------------------------
// Adapter Types
// -----------------------------------------------------------------------------

export interface AdapterConfig {
  /**
   * Unique identifier for the adapter
   */
  adapterId: string

  /**
   * Human-readable name
   */
  adapterName?: string | undefined

  /**
   * API base path prefix
   * @default "/api"
   */
  basePath?: string | undefined

  /**
   * Enable debug logs
   * @default false
   */
  debugLogs?: boolean | undefined
}

export interface AdapterRequest {
  method: string
  path: string
  query: Record<string, string | string[] | undefined>
  body: unknown
  headers: Record<string, string | undefined>
}

export interface AdapterResponse {
  status: number
  body: unknown
  headers: Record<string, string>
}

// -----------------------------------------------------------------------------
// Adapter Context
// -----------------------------------------------------------------------------

export interface AdapterContext {
  /**
   * Get user from the native request
   */
  getUser: (nativeRequest: unknown) => User | null | Promise<User | null>

  /**
   * Convert native request to Nevr request format
   */
  toNevrRequest: (nativeRequest: unknown) => Promise<NevrRequest>

  /**
   * Convert Nevr response to native response format
   */
  fromNevrResponse: (response: NevrResponse, nativeResponse: unknown) => void
}

// -----------------------------------------------------------------------------
// Adapter Interface
// -----------------------------------------------------------------------------

export interface Adapter<THandler = unknown> {
  /**
   * Unique identifier
   */
  id: string

  /**
   * Human-readable name
   */
  name: string

  /**
   * Create a request handler for the framework
   */
  createHandler(nevr: NevrInstance): THandler

  /**
   * Mount the handler on a native app/router
   */
  mount?(app: unknown, handler: THandler): void
}

// -----------------------------------------------------------------------------
// Custom Adapter Creator Interface
// -----------------------------------------------------------------------------

export interface CustomAdapterMethods<TNativeRequest, TNativeResponse> {
  /**
   * Parse method from native request
   */
  getMethod(req: TNativeRequest): string

  /**
   * Parse path from native request
   */
  getPath(req: TNativeRequest): string

  /**
   * Parse query params from native request
   */
  getQuery(req: TNativeRequest): Record<string, string | string[] | undefined>

  /**
   * Parse body from native request
   */
  getBody(req: TNativeRequest): unknown

  /**
   * Parse headers from native request
   */
  getHeaders(req: TNativeRequest): Record<string, string | undefined>

  /**
   * Get user from native request (for auth middleware integration)
   */
  getUser(req: TNativeRequest): User | null | Promise<User | null>

  /**
   * Send response through native response object
   */
  sendResponse(res: TNativeResponse, response: NevrResponse): void
}

// -----------------------------------------------------------------------------
// Adapter Factory
// -----------------------------------------------------------------------------

export interface AdapterFactoryOptions<TNativeRequest, TNativeResponse, THandler> {
  config: AdapterConfig
  methods: CustomAdapterMethods<TNativeRequest, TNativeResponse>
  createHandler: (
    handleRequest: (req: TNativeRequest, res: TNativeResponse) => Promise<void>
  ) => THandler
}

/**
 * Create an adapter using the factory pattern
 * This allows consistent adapter creation across different frameworks
 */
export function createAdapterFactory<TNativeRequest, TNativeResponse, THandler>(
  options: AdapterFactoryOptions<TNativeRequest, TNativeResponse, THandler>
): (nevr: NevrInstance) => Adapter<THandler> {
  const { config, methods, createHandler } = options

  return (nevr: NevrInstance): Adapter<THandler> => {
    const basePath = config.basePath || "/api"

    const log = (message: string, data?: unknown): void => {
      if (config.debugLogs) {
        getLogger().debug(`[${config.adapterName || config.adapterId}] ${message}`, data || "")
      }
    }

    const toNevrRequest = async (req: TNativeRequest): Promise<NevrRequest<TNativeRequest>> => {
      const user = await methods.getUser(req)
      const path = methods.getPath(req)

      // Remove base path prefix if present
      const apiPath = path.startsWith(basePath)
        ? path.slice(basePath.length) || "/"
        : path

      return {
        method: methods.getMethod(req) as NevrRequest["method"],
        path: apiPath,
        params: {},
        query: methods.getQuery(req),
        body: methods.getBody(req),
        headers: methods.getHeaders(req),
        user,
        context: {},
        native: req,
      }
    }

    const handleRequest = async (req: TNativeRequest, res: TNativeResponse): Promise<void> => {
      try {
        log("Incoming request", { method: methods.getMethod(req), path: methods.getPath(req) })

        const nevrRequest = await toNevrRequest(req)
        const nevrResponse = await nevr.handleRequest(nevrRequest)

        log("Response", { status: nevrResponse.status })

        methods.sendResponse(res, nevrResponse)
      } catch (error) {
        log("Error", error)
        methods.sendResponse(res, {
          status: 500,
          body: { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    const handler = createHandler(handleRequest)

    return {
      id: config.adapterId,
      name: config.adapterName || config.adapterId,
      createHandler: () => handler,
    }
  }
}

// -----------------------------------------------------------------------------
// Re-exports
// -----------------------------------------------------------------------------

export type { NevrRequest, NevrResponse, User } from "../types.js"
