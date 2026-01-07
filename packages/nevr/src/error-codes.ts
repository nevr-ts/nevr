// =============================================================================
// ERROR CODES
// Centralized error code definitions with HTTP status mappings
// =============================================================================

/**
 * All possible error codes in Nevr
 * Use these constants instead of string literals for type safety
 */
export const ErrorCodes = {
    // Client Errors (4xx)
    /** Input validation failed (400) */
    VALIDATION_ERROR: "VALIDATION_ERROR",
    /** Missing or invalid credentials (401) */
    UNAUTHORIZED: "UNAUTHORIZED",
    /** Insufficient permissions (403) */
    FORBIDDEN: "FORBIDDEN",
    /** Resource not found (404) */
    NOT_FOUND: "NOT_FOUND",
    /** HTTP method not allowed (405) */
    METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    /** Resource conflict (409) */
    CONFLICT: "CONFLICT",
    /** Rate limit exceeded (429) */
    RATE_LIMITED: "RATE_LIMITED",

    // Server Errors (5xx)
    /** Internal server error (500) */
    INTERNAL_ERROR: "INTERNAL_ERROR",
    /** Database operation failed (500) */
    DATABASE_ERROR: "DATABASE_ERROR",
    /** Plugin error (500) */
    PLUGIN_ERROR: "PLUGIN_ERROR",
    /** Configuration error (500) */
    CONFIG_ERROR: "CONFIG_ERROR",
    /** Workflow/action error (500) */
    ACTION_ERROR: "ACTION_ERROR",
    /** Compensation failed during saga rollback (500) */
    COMPENSATION_ERROR: "COMPENSATION_ERROR",
    /** External service unavailable (503) */
    SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const

/**
 * Error code type derived from ErrorCodes object
 */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * Map error codes to HTTP status codes
 */
export const ErrorCodeHttpStatus: Record<ErrorCode, number> = {
    // Client Errors
    [ErrorCodes.VALIDATION_ERROR]: 400,
    [ErrorCodes.UNAUTHORIZED]: 401,
    [ErrorCodes.FORBIDDEN]: 403,
    [ErrorCodes.NOT_FOUND]: 404,
    [ErrorCodes.METHOD_NOT_ALLOWED]: 405,
    [ErrorCodes.CONFLICT]: 409,
    [ErrorCodes.RATE_LIMITED]: 429,

    // Server Errors
    [ErrorCodes.INTERNAL_ERROR]: 500,
    [ErrorCodes.DATABASE_ERROR]: 500,
    [ErrorCodes.PLUGIN_ERROR]: 500,
    [ErrorCodes.CONFIG_ERROR]: 500,
    [ErrorCodes.ACTION_ERROR]: 500,
    [ErrorCodes.COMPENSATION_ERROR]: 500,
    [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
}

/**
 * Get HTTP status code for an error code
 */
export function getHttpStatus(code: ErrorCode): number {
    return ErrorCodeHttpStatus[code] ?? 500
}

/**
 * Check if an error code is a client error (4xx)
 */
export function isClientError(code: ErrorCode): boolean {
    const status = getHttpStatus(code)
    return status >= 400 && status < 500
}

/**
 * Check if an error code is a server error (5xx)
 */
export function isServerError(code: ErrorCode): boolean {
    const status = getHttpStatus(code)
    return status >= 500 && status < 600
}

/**
 * Default error messages for each code
 */
export const ErrorCodeDefaultMessages: Record<ErrorCode, string> = {
    [ErrorCodes.VALIDATION_ERROR]: "Validation failed",
    [ErrorCodes.UNAUTHORIZED]: "Authentication required",
    [ErrorCodes.FORBIDDEN]: "Permission denied",
    [ErrorCodes.NOT_FOUND]: "Resource not found",
    [ErrorCodes.METHOD_NOT_ALLOWED]: "Method not allowed",
    [ErrorCodes.CONFLICT]: "Resource already exists",
    [ErrorCodes.RATE_LIMITED]: "Too many requests",
    [ErrorCodes.INTERNAL_ERROR]: "Internal server error",
    [ErrorCodes.DATABASE_ERROR]: "Database operation failed",
    [ErrorCodes.PLUGIN_ERROR]: "Plugin error",
    [ErrorCodes.CONFIG_ERROR]: "Configuration error",
    [ErrorCodes.ACTION_ERROR]: "Action failed",
    [ErrorCodes.COMPENSATION_ERROR]: "Compensation failed during rollback",
    [ErrorCodes.SERVICE_UNAVAILABLE]: "Service temporarily unavailable",
}
