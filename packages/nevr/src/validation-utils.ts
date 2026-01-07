// =============================================================================
// VALIDATION UTILITIES
// Shared validation patterns and helpers (single source of truth)
// =============================================================================

// -----------------------------------------------------------------------------
// Common Validation Patterns
// -----------------------------------------------------------------------------

export const VALIDATION_PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/.+/,
    ISO_DATETIME: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/,
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    PHONE: /^\+?[1-9]\d{1,14}$/,
} as const

// -----------------------------------------------------------------------------
// Type Checkers
// -----------------------------------------------------------------------------

export function isValidEmail(value: string): boolean {
    return VALIDATION_PATTERNS.EMAIL.test(value)
}

export function isValidUrl(value: string): boolean {
    return VALIDATION_PATTERNS.URL.test(value)
}

export function isValidIsoDateTime(value: string): boolean {
    return VALIDATION_PATTERNS.ISO_DATETIME.test(value)
}

export function isValidUuid(value: string): boolean {
    return VALIDATION_PATTERNS.UUID.test(value)
}

// -----------------------------------------------------------------------------
// Value Parsers
// -----------------------------------------------------------------------------

/**
 * Parse string value to correct type (for query params, etc.)
 */
export function parseValue(value: unknown): unknown {
    if (typeof value !== "string") return value

    // Boolean
    if (value === "true") return true
    if (value === "false") return false

    // Null
    if (value === "null") return null

    // Number
    if (/^-?\d+$/.test(value)) return parseInt(value, 10)
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value)

    // String
    return value
}

// -----------------------------------------------------------------------------
// Validation Error Types
// -----------------------------------------------------------------------------

/**
 * Simple validation error (for API responses)
 */
export interface ValidationError {
    field: string
    message: string
    code?: string
    value?: unknown
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean
    errors: ValidationError[]
    data: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// Validation Error Classes
// -----------------------------------------------------------------------------

/**
 * Field-level validation error with rich details
 */
export class FieldValidationError extends Error {
    constructor(
        public readonly field: string,
        message: string,
        public readonly value?: unknown,
        public readonly code?: string
    ) {
        super(`Validation failed for field "${field}": ${message}`)
        this.name = "FieldValidationError"
    }

    toJSON(): ValidationError {
        return {
            field: this.field,
            message: this.message.replace(`Validation failed for field "${this.field}": `, ""),
            code: this.code,
            value: this.value,
        }
    }
}

/**
 * Collection of field validation errors
 */
export class FieldValidationErrors extends Error {
    constructor(public readonly errors: FieldValidationError[]) {
        const messages = errors.map((e) => `${e.field}: ${e.message}`).join(", ")
        super(`Validation failed: ${messages}`)
        this.name = "FieldValidationErrors"
    }

    toJSON(): ValidationError[] {
        return this.errors.map((e) => e.toJSON())
    }
}

// -----------------------------------------------------------------------------
// Type Validation Helpers
// -----------------------------------------------------------------------------

export function validateType(
    fieldName: string,
    value: unknown,
    expectedType: string
): FieldValidationError | null {
    switch (expectedType) {
        case "string":
        case "text":
            if (typeof value !== "string") {
                return new FieldValidationError(fieldName, "Must be a string", value, "INVALID_TYPE")
            }
            break

        case "int":
            if (typeof value !== "number" || !Number.isInteger(value)) {
                return new FieldValidationError(fieldName, "Must be an integer", value, "INVALID_TYPE")
            }
            break

        case "float":
            if (typeof value !== "number") {
                return new FieldValidationError(fieldName, "Must be a number", value, "INVALID_TYPE")
            }
            break

        case "boolean":
            if (typeof value !== "boolean") {
                return new FieldValidationError(fieldName, "Must be a boolean", value, "INVALID_TYPE")
            }
            break

        case "datetime":
            if (!(value instanceof Date) && typeof value !== "string") {
                return new FieldValidationError(fieldName, "Must be a date", value, "INVALID_TYPE")
            }
            if (typeof value === "string") {
                const date = new Date(value)
                if (isNaN(date.getTime())) {
                    return new FieldValidationError(fieldName, "Invalid date format", value, "INVALID_DATE")
                }
            }
            break

        case "json":
            // JSON accepts any value
            break
    }
    return null
}
