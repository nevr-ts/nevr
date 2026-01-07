// =============================================================================
// PLUGIN ENDPOINT HELPER
// Define typed endpoints for plugins
// Unified endpoint system with Zod validation and middleware support
// =============================================================================

import type { FieldDef, NevrRequest, NevrResponse, Driver, User, RuleDef } from "../../types.js"

// Re-export Zod for convenience (users don't need to import separately)
export { z } from "zod"
import type { ZodType, ZodOptional, ZodAny } from "zod"

// -----------------------------------------------------------------------------
// Endpoint Context
// -----------------------------------------------------------------------------

/**
 * Context passed to endpoint handlers
 * Unified context that works for all plugin types
 */
export interface EndpointContext<
    TBody = unknown,
    TQuery = unknown,
    TParams extends Record<string, string> = Record<string, string>
> {
    /** Validated body data (from Zod schema) */
    body: TBody

    /** Legacy alias for body (for backward compatibility) */
    input: TBody

    /** Raw request */
    request: NevrRequest

    /** Current user (if authenticated) */
    user: User | null

    /** Database driver */
    driver: Driver

    /** Request headers */
    headers: Record<string, string | undefined>

    /** URL parameters (e.g., :id) */
    params: TParams

    /** Query parameters (parsed) */
    query: TQuery

    /** Plugin context (set by plugin.init) */
    context: EndpointPluginContext

    /** Set a response header */
    setHeader: (name: string, value: string) => void

    /** Get all response headers */
    getResponseHeaders: () => Record<string, string>

    /** Create a JSON response */
    json: <T>(data: T, status?: number) => EndpointResponse<T>

    /** Create a redirect response */
    redirect: (url: string, status?: 301 | 302 | 307 | 308) => EndpointResponse<void>
}

export interface EndpointPluginContext {
    /** Database driver */
    driver: Driver
    /** Resolved options */
    options?: Record<string, unknown>
    /** Additional context from plugin init */
    [key: string]: unknown
}

// -----------------------------------------------------------------------------
// Endpoint Response
// -----------------------------------------------------------------------------

export interface EndpointResponse<T = unknown> {
    status: number
    body: T
    headers?: Record<string, string>
}

// -----------------------------------------------------------------------------
// Middleware Type
// -----------------------------------------------------------------------------

/**
 * Middleware function that can add to context or short-circuit
 * If returns a value, that value is returned as the response
 * If returns void/undefined, continue to next middleware or handler
 */
export type EndpointMiddleware<TResult = unknown> = (
    ctx: EndpointContext
) => Promise<TResult | void> | TResult | void

/**
 * Create a reusable middleware
 * 
 * @example
 * ```typescript
 * const requireAuth = createMiddleware(async (ctx) => {
 *     if (!ctx.user) {
 *         throw new EndpointError("UNAUTHORIZED", { message: "Authentication required" })
 *     }
 *     return { user: ctx.user } // Add to context
 * })
 * ```
 */
export function createMiddleware<TResult>(
    handler: (ctx: EndpointContext) => Promise<TResult | void> | TResult | void
): EndpointMiddleware<TResult> {
    return handler
}

// -----------------------------------------------------------------------------
// Endpoint Error (Unified - replaces both APIError and AuthError)
// -----------------------------------------------------------------------------

export type ErrorType =
    | "BAD_REQUEST"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "VALIDATION_ERROR"
    | "INTERNAL_ERROR"
    | string  // Custom error codes

/**
 * Unified endpoint error class
 * Use this for all plugin errors - replaces APIError and AuthError
 */
export class EndpointError extends Error {
    readonly code: string
    readonly status: number
    readonly data?: Record<string, unknown>

    constructor(type: ErrorType, options?: { message?: string; code?: string; data?: Record<string, unknown> }) {
        super(options?.message || type)
        this.code = options?.code || type
        this.name = "EndpointError"
        this.data = options?.data

        // Map type to status code
        switch (type) {
            case "BAD_REQUEST":
            case "VALIDATION_ERROR":
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
                this.status = 500
                break
            default:
                this.status = 400 // Default for custom codes
        }
    }

    toJSON() {
        return {
            error: this.code,
            message: this.message,
            ...(this.data && { data: this.data }),
        }
    }

    toResponse(): EndpointResponse {
        return {
            status: this.status,
            body: this.toJSON(),
        }
    }
}

// -----------------------------------------------------------------------------
// Endpoint Configuration (Enhanced with Zod)
// -----------------------------------------------------------------------------

/**
 * Endpoint configuration options
 * Supports Zod schemas for body/query validation
 */
export interface EndpointConfig<
    TBody = unknown,
    TQuery = unknown,
    TOutput = unknown
> {
    /** HTTP method */
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

    /**
     * Body validation schema (Zod)
     * The body will be validated and typed
     * 
     * @example
     * ```typescript
     * body: z.object({
     *     email: z.string().email(),
     *     password: z.string().min(8),
     * })
     * ```
     */
    body?: ZodType<TBody>

    /**
     * Query validation schema (Zod)
     * Query parameters will be validated and typed
     * 
     * @example
     * ```typescript
     * query: z.object({
     *     page: z.coerce.number().optional(),
     *     limit: z.coerce.number().optional(),
     * })
     * ```
     */
    query?: ZodType<TQuery>

    /**
     * Legacy input schema (for backward compatibility)
     * @deprecated Use `body` with Zod schema instead
     */
    input?: Record<string, any>

    /**
     * Middleware to run before handler
     * Middlewares run in order, can short-circuit by returning a response
     * 
     * @example
     * ```typescript
     * use: [sessionMiddleware, rateLimitMiddleware]
     * ```
     */
    use?: EndpointMiddleware[]

    /**
     * Authorization rules from rules.ts
     * Uses Nevr's built-in rule system
     * 
     * @example
     * ```typescript
     * rules: "authenticated"           // Single rule (string)
     * rules: ["authenticated", "admin"] // Multiple rules
     * rules: [authenticated, owner("userId")] // Rule functions
     * ```
     */
    rules?: RuleDef | RuleDef[]

    /**
     * Handler function
     */
    handler: (
        ctx: EndpointContext<TBody, TQuery>
    ) => Promise<EndpointResponse<TOutput> | TOutput> | EndpointResponse<TOutput> | TOutput

    /**
     * Metadata for OpenAPI and documentation
     */
    meta?: {
        summary?: string
        description?: string
        tags?: string[]
        deprecated?: boolean
        /** OpenAPI-specific metadata */
        openapi?: {
            operationId?: string
            requestBody?: Record<string, unknown>
            responses?: Record<string, unknown>
            parameters?: Record<string, unknown>[]
        }
    }

    /**
     * Type inference
     * Used for client SDK generation
     */
    $Infer?: {
        body?: TBody
        query?: TQuery
        returned?: TOutput
    }
}

// -----------------------------------------------------------------------------
// Endpoint Definition
// -----------------------------------------------------------------------------

/**
 * Complete endpoint definition (returned by endpoint())
 */
export interface EndpointDefinition<
    TBody = unknown,
    TQuery = unknown,
    TOutput = unknown
> extends EndpointConfig<TBody, TQuery, TOutput> {
    /** Route path (relative to plugin basePath) */
    path: string
}

// -----------------------------------------------------------------------------
// Endpoint Helper
// -----------------------------------------------------------------------------

/**
 * Define a typed endpoint for a plugin
 * 
 * This is the UNIFIED endpoint creator for all Nevr plugins.
 * Supports Zod validation, middleware, rules, and OpenAPI metadata.
 * 
 * @example
 * ```typescript
 * import { endpoint, z, EndpointError } from "../unified/endpoint.js"
 * import { authenticated, admin } from "../../rules.js"
 * 
 * const plugin = createPlugin({
 *   id: "payment",
 *   basePath: "/payment",
 *   endpoints: {
 *     // Simple endpoint
 *     getStatus: endpoint("/status", {
 *       method: "GET",
 *       handler: async (ctx) => ({ active: true }),
 *     }),
 *     
 *     // With Zod validation
 *     checkout: endpoint("/checkout", {
 *       method: "POST",
 *       body: z.object({
 *         amount: z.number().positive(),
 *         currency: z.string().length(3),
 *       }),
 *       rules: [authenticated],
 *       handler: async (ctx) => {
 *         const { amount, currency } = ctx.body // Typed!
 *         if (amount > 10000) {
 *           throw new EndpointError("BAD_REQUEST", { message: "Amount too large" })
 *         }
 *         return { success: true, orderId: "..." }
 *       },
 *       meta: { summary: "Process checkout", tags: ["Payments"] },
 *     }),
 *     
 *     // With middleware
 *     refund: endpoint("/:orderId/refund", {
 *       method: "POST",
 *       use: [requireAuth, requireAdmin],
 *       handler: async (ctx) => {
 *         const { orderId } = ctx.params
 *         return { refunded: true }
 *       },
 *     }),
 *   },
 * })
 * ```
 */
export function endpoint<
    TBody = unknown,
    TQuery = unknown,
    TOutput = unknown
>(
    path: string,
    config: EndpointConfig<TBody, TQuery, TOutput>
): EndpointDefinition<TBody, TQuery, TOutput> {
    return {
        path,
        ...config,
    }
}

// -----------------------------------------------------------------------------
// Zod Validation Helpers
// -----------------------------------------------------------------------------

/**
 * Validate data against a Zod schema
 * Returns typed result or throws EndpointError
 */
export function validateWithZod<T>(
    schema: ZodType<T>,
    data: unknown,
    fieldName = "body"
): T {
    const result = schema.safeParse(data)
    if (!result.success) {
        const errors: Record<string, string[]> = {}
        for (const issue of result.error.issues) {
            const path = issue.path.join(".") || fieldName
            if (!errors[path]) errors[path] = []
            errors[path].push(issue.message)
        }
        throw new EndpointError("VALIDATION_ERROR", {
            message: "Validation failed",
            data: { errors },
        })
    }
    return result.data
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: { issues: { path: (string | number)[]; message: string }[] }): Record<string, string[]> {
    const formatted: Record<string, string[]> = {}
    for (const issue of error.issues) {
        const path = issue.path.join(".") || "_root"
        if (!formatted[path]) formatted[path] = []
        formatted[path].push(issue.message)
    }
    return formatted
}

// -----------------------------------------------------------------------------
// Type Inference Helpers
// -----------------------------------------------------------------------------

/** Infer body type from endpoint */
export type InferEndpointBody<T> = T extends EndpointDefinition<infer B, any, any> ? B : unknown

/** Infer query type from endpoint */
export type InferEndpointQuery<T> = T extends EndpointDefinition<any, infer Q, any> ? Q : unknown

/** Infer output type from endpoint */
export type InferEndpointOutput<T> = T extends EndpointDefinition<any, any, infer O> ? O : unknown

/** Legacy alias for backward compatibility */
export type InferEndpointInput<T> = InferEndpointBody<T>

/** Infer endpoints record type */
export type EndpointsRecord = Record<string, EndpointDefinition>

/**
 * Convert endpoints to client methods
 */
export type InferClientMethods<T extends EndpointsRecord> = {
    [K in keyof T]: T[K]["method"] extends "GET"
    ? T[K] extends EndpointDefinition<any, infer Q, infer O>
    ? Q extends Record<string, any>
    ? (query?: Partial<Q>) => Promise<O>
    : () => Promise<O>
    : () => Promise<unknown>
    : T[K] extends EndpointDefinition<infer B, any, infer O>
    ? B extends Record<string, any>
    ? (input: B) => Promise<O>
    : () => Promise<O>
    : () => Promise<unknown>
}

// -----------------------------------------------------------------------------
// Pre-built Middleware (using rules.ts)
// -----------------------------------------------------------------------------

import { authenticated as authRule, admin as adminRule } from "../../rules.js"

/**
 * Require authenticated user
 * Uses rules.ts `authenticated` rule
 */
export const requireAuth = createMiddleware(async (ctx) => {
    if (!ctx.user) {
        throw new EndpointError("UNAUTHORIZED", { message: "Authentication required" })
    }
})

/**
 * Require admin role
 * Uses rules.ts `admin` rule
 */
export const requireAdmin = createMiddleware(async (ctx) => {
    if (!ctx.user) {
        throw new EndpointError("UNAUTHORIZED", { message: "Authentication required" })
    }
    if (ctx.user.role !== "admin") {
        throw new EndpointError("FORBIDDEN", { message: "Admin access required" })
    }
})

/**
 * Create a middleware that requires a specific role
 */
export function requireRole(role: string): EndpointMiddleware {
    return createMiddleware(async (ctx) => {
        if (!ctx.user) {
            throw new EndpointError("UNAUTHORIZED", { message: "Authentication required" })
        }
        if (ctx.user.role !== role) {
            throw new EndpointError("FORBIDDEN", { message: `Role '${role}' required` })
        }
    })
}
