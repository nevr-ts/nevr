// =============================================================================
// ERROR HANDLING
// Consistent error responses with structured error hierarchy
// =============================================================================

import type { NevrResponse, NevrError, ValidationError } from "./types.js"
import { type ErrorCode, getHttpStatus, ErrorCodes } from "./error-codes.js"

// Re-export for convenience
export { ErrorCodes, getHttpStatus } from "./error-codes.js"
export type { ErrorCode } from "./error-codes.js"

// -----------------------------------------------------------------------------
// Base Error Class
// -----------------------------------------------------------------------------

/**
 * Base error class for all Nevr errors
 * Provides consistent error structure with code, status, and optional details
 */
export class NevrErrorClass extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: ValidationError[]
  readonly cause?: Error

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: ValidationError[]; cause?: Error }
  ) {
    super(message)
    this.name = "NevrError"
    this.code = code
    this.status = errorCodeToStatus(code)
    this.details = options?.details
    this.cause = options?.cause
  }

  /**
   * Convert to NevrResponse for HTTP response
   */
  toResponse(): NevrResponse {
    return createErrorResponse(this.code, this.message, this.details)
  }
}

// -----------------------------------------------------------------------------
// Specialized Error Classes
// -----------------------------------------------------------------------------

/**
 * Entity not found error (404)
 * Use when a specific entity cannot be found by ID or query
 */
export class EntityNotFoundError extends NevrErrorClass {
  readonly entityName: string
  readonly entityId?: string

  constructor(entityName: string, entityId?: string) {
    const message = entityId
      ? `${entityName} with id "${entityId}" not found`
      : `${entityName} not found`
    super("NOT_FOUND", message)
    this.name = "EntityNotFoundError"
    this.entityName = entityName
    this.entityId = entityId
  }
}

/**
 * Validation error (400)
 * Use when input validation fails
 */
export class ValidationFailedError extends NevrErrorClass {
  constructor(errors: ValidationError[]) {
    super("VALIDATION_ERROR", "Validation failed", { details: errors })
    this.name = "ValidationFailedError"
  }
}

/**
 * Authentication error (401)
 * Use when user is not authenticated
 */
export class AuthenticationError extends NevrErrorClass {
  constructor(message: string = "Authentication required") {
    super("UNAUTHORIZED", message)
    this.name = "AuthenticationError"
  }
}

/**
 * Authorization error (403)
 * Use when user lacks permission
 */
export class AuthorizationError extends NevrErrorClass {
  readonly requiredRole?: string
  readonly operation?: string

  constructor(message: string = "Permission denied", options?: { requiredRole?: string; operation?: string }) {
    super("FORBIDDEN", message)
    this.name = "AuthorizationError"
    this.requiredRole = options?.requiredRole
    this.operation = options?.operation
  }
}

/**
 * Conflict error (409)
 * Use when resource already exists or unique constraint is violated
 */
export class ConflictError extends NevrErrorClass {
  readonly field?: string

  constructor(message: string = "Resource already exists", field?: string) {
    super("CONFLICT", message)
    this.name = "ConflictError"
    this.field = field
  }
}

/**
 * Plugin error
 * Use when a plugin fails to initialize or execute
 */
export class PluginError extends NevrErrorClass {
  readonly pluginId: string
  readonly phase?: "register" | "initialize" | "execute" | "shutdown"

  constructor(
    pluginId: string,
    message: string,
    options?: { phase?: "register" | "initialize" | "execute" | "shutdown"; cause?: Error }
  ) {
    super(ErrorCodes.PLUGIN_ERROR, `[${pluginId}] ${message}`, { cause: options?.cause })
    this.name = "PluginError"
    this.pluginId = pluginId
    this.phase = options?.phase
  }
}

/**
 * Configuration error
 * Use when configuration is invalid or missing
 */
export class ConfigurationError extends NevrErrorClass {
  readonly configKey?: string

  constructor(message: string, configKey?: string) {
    super(ErrorCodes.CONFIG_ERROR, message)
    this.name = "ConfigurationError"
    this.configKey = configKey
  }
}

/**
 * Database error
 * Use when database operations fail
 */
export class DatabaseError extends NevrErrorClass {
  readonly operation?: string
  readonly entity?: string

  constructor(
    message: string,
    options?: { operation?: string; entity?: string; cause?: Error }
  ) {
    super(ErrorCodes.DATABASE_ERROR, message, { cause: options?.cause })
    this.name = "DatabaseError"
    this.operation = options?.operation
    this.entity = options?.entity
  }
}

// -----------------------------------------------------------------------------
// Status Code Mapping
// -----------------------------------------------------------------------------

// Use centralized getHttpStatus from error-codes.ts
function errorCodeToStatus(code: ErrorCode): number {
  return getHttpStatus(code)
}

// -----------------------------------------------------------------------------
// Error Response Builders
// -----------------------------------------------------------------------------

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: ValidationError[]
): NevrResponse {
  const error: NevrError = { code, message }

  if (details && details.length > 0) {
    error.details = details
  }

  return {
    status: errorCodeToStatus(code),
    body: { error },
  }
}

/** Validation error (400) */
export function validationError(errors: ValidationError[]): NevrResponse {
  return createErrorResponse("VALIDATION_ERROR", "Validation failed", errors)
}

/** Unauthorized error (401) */
export function unauthorizedError(message: string = "Authentication required"): NevrResponse {
  return createErrorResponse("UNAUTHORIZED", message)
}

/** Forbidden error (403) */
export function forbiddenError(message: string = "Permission denied"): NevrResponse {
  return createErrorResponse("FORBIDDEN", message)
}

/** Not found error (404) */
export function notFoundError(message: string = "Not found"): NevrResponse {
  return createErrorResponse("NOT_FOUND", message)
}

/** Conflict error (409) */
export function conflictError(message: string = "Resource already exists"): NevrResponse {
  return createErrorResponse("CONFLICT", message)
}

/** Internal error (500) */
export function internalError(message: string = "Internal server error"): NevrResponse {
  return createErrorResponse("INTERNAL_ERROR", message)
}

// -----------------------------------------------------------------------------
// Error Handler
// -----------------------------------------------------------------------------

/**
 * Convert any error to a NevrResponse
 */
export function handleError(error: unknown): NevrResponse {
  // Known Nevr error
  if (error instanceof NevrErrorClass) {
    return createErrorResponse(error.code, error.message, error.details)
  }

  // EndpointError from unified endpoint system (check by name since it might be from different module)
  if (error && typeof error === "object" && "name" in error && (error as any).name === "EndpointError") {
    const endpointError = error as unknown as { status: number; code: string; message: string; data?: Record<string, unknown>; toResponse?: () => NevrResponse }
    // Use toResponse if available
    if (typeof endpointError.toResponse === "function") {
      return endpointError.toResponse()
    }
    // Otherwise build response manually
    return {
      status: endpointError.status || 400,
      body: {
        error: endpointError.code || "ERROR",
        message: endpointError.message,
        ...(endpointError.data && { data: endpointError.data }),
      },
    }
  }

  // Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; message: string }

    // Unique constraint violation
    if (prismaError.code === "P2002") {
      return conflictError("Resource already exists")
    }

    // Record not found
    if (prismaError.code === "P2025") {
      return notFoundError()
    }

    // Foreign key constraint
    if (prismaError.code === "P2003") {
      return validationError([{ field: "relation", message: "Related resource not found" }])
    }
  }

  // Generic error
  if (error instanceof Error) {
    // Don't expose internal errors in production
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message

    return internalError(message)
  }

  return internalError("Unknown error")
}
