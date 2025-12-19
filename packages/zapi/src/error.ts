// =============================================================================
// ERROR HANDLING
// Consistent error responses
// =============================================================================

import type { ZapiResponse, ZapiError, ErrorCode, ValidationError } from "./types.js"

// -----------------------------------------------------------------------------
// Error Classes
// -----------------------------------------------------------------------------

export class NevrErrorClass extends Error {
  code: ErrorCode
  status: number
  details?: ValidationError[]

  constructor(code: ErrorCode, message: string, details?: ValidationError[]) {
    super(message)
    this.name = "NevrError"
    this.code = code
    this.status = errorCodeToStatus(code)
    this.details = details
  }
}

// Alias for backward compatibility
export { NevrErrorClass as ZapiErrorClass }

// -----------------------------------------------------------------------------
// Status Code Mapping
// -----------------------------------------------------------------------------

function errorCodeToStatus(code: ErrorCode): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400
    case "UNAUTHORIZED":
      return 401
    case "FORBIDDEN":
      return 403
    case "NOT_FOUND":
      return 404
    case "CONFLICT":
      return 409
    case "INTERNAL_ERROR":
      return 500
    default:
      return 500
  }
}

// -----------------------------------------------------------------------------
// Error Response Builders
// -----------------------------------------------------------------------------

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: ValidationError[]
): ZapiResponse {
  const error: ZapiError = { code, message }

  if (details && details.length > 0) {
    error.details = details
  }

  return {
    status: errorCodeToStatus(code),
    body: { error },
  }
}

/** Validation error (400) */
export function validationError(errors: ValidationError[]): ZapiResponse {
  return createErrorResponse("VALIDATION_ERROR", "Validation failed", errors)
}

/** Unauthorized error (401) */
export function unauthorizedError(message: string = "Authentication required"): ZapiResponse {
  return createErrorResponse("UNAUTHORIZED", message)
}

/** Forbidden error (403) */
export function forbiddenError(message: string = "Permission denied"): ZapiResponse {
  return createErrorResponse("FORBIDDEN", message)
}

/** Not found error (404) */
export function notFoundError(message: string = "Not found"): ZapiResponse {
  return createErrorResponse("NOT_FOUND", message)
}

/** Conflict error (409) */
export function conflictError(message: string = "Resource already exists"): ZapiResponse {
  return createErrorResponse("CONFLICT", message)
}

/** Internal error (500) */
export function internalError(message: string = "Internal server error"): ZapiResponse {
  return createErrorResponse("INTERNAL_ERROR", message)
}

// -----------------------------------------------------------------------------
// Error Handler
// -----------------------------------------------------------------------------

/**
 * Convert any error to a NevrResponse
 */
export function handleError(error: unknown): ZapiResponse {
  // Known Nevr error
  if (error instanceof NevrErrorClass) {
    return createErrorResponse(error.code, error.message, error.details)
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
