// =============================================================================
// VALIDATION ENHANCEMENT
// Validates field values based on field definitions
// Uses shared validation utilities for consistency
// =============================================================================

import type { FieldDef, Entity } from "../types.js"
import {
    VALIDATION_PATTERNS,
    FieldValidationError,
    FieldValidationErrors,
    validateType,
} from "../validation-utils.js"

// Re-export error classes for convenience
export { FieldValidationError, FieldValidationErrors } from "../validation-utils.js"

// -----------------------------------------------------------------------------
// Field Validation
// -----------------------------------------------------------------------------

/**
 * Validate a single field value against its definition
 * Supports both direct field properties (min, max, isEmail) and
 * validation object properties (validation.email, validation.regex, etc.)
 */
export function validateField(
    fieldName: string,
    value: unknown,
    fieldDef: FieldDef
): FieldValidationError | null {
    // Skip validation for null/undefined optional fields
    if ((value === null || value === undefined) && fieldDef.optional) {
        return null
    }

    // Required field check
    if ((value === null || value === undefined) && !fieldDef.optional && fieldDef.default === undefined) {
        return new FieldValidationError(fieldName, "Field is required", value, "REQUIRED")
    }

    // If value is null/undefined after required check, skip further validation
    if (value === null || value === undefined) {
        return null
    }

    // Type validation
    const typeError = validateType(fieldName, value, fieldDef.type)
    if (typeError) return typeError

    // Direct field property validation (legacy support: field.min, field.max, field.isEmail)
    if (typeof value === "string") {
        // Email via direct property
        if (fieldDef.isEmail && !VALIDATION_PATTERNS.EMAIL.test(value)) {
            return new FieldValidationError(fieldName, "Invalid email format", value, "INVALID_EMAIL")
        }
        // Min length via direct property
        if (fieldDef.min !== undefined && value.length < fieldDef.min) {
            return new FieldValidationError(
                fieldName,
                `Must be at least ${fieldDef.min} characters`,
                value,
                "MIN_LENGTH"
            )
        }
        // Max length via direct property
        if (fieldDef.max !== undefined && value.length > fieldDef.max) {
            return new FieldValidationError(
                fieldName,
                `Must be at most ${fieldDef.max} characters`,
                value,
                "MAX_LENGTH"
            )
        }
    }

    if (typeof value === "number") {
        // Min value via direct property
        if (fieldDef.min !== undefined && value < fieldDef.min) {
            return new FieldValidationError(
                fieldName,
                `Must be at least ${fieldDef.min}`,
                value,
                "MIN_VALUE"
            )
        }
        // Max value via direct property
        if (fieldDef.max !== undefined && value > fieldDef.max) {
            return new FieldValidationError(
                fieldName,
                `Must be at most ${fieldDef.max}`,
                value,
                "MAX_VALUE"
            )
        }
    }

    // Validation object
    const validation = fieldDef.validation
    if (!validation) return null

    // String validations
    if (typeof value === "string") {
        // Email
        if (validation.email && !VALIDATION_PATTERNS.EMAIL.test(value)) {
            return new FieldValidationError(
                fieldName,
                validation.email.message || "Invalid email format",
                value,
                "INVALID_EMAIL"
            )
        }

        // URL
        if (validation.url && !VALIDATION_PATTERNS.URL.test(value)) {
            return new FieldValidationError(
                fieldName,
                validation.url.message || "Invalid URL format",
                value,
                "INVALID_URL"
            )
        }

        // Regex
        if (validation.regex && !validation.regex.pattern.test(value)) {
            return new FieldValidationError(
                fieldName,
                validation.regex.message || `Does not match pattern ${validation.regex.pattern}`,
                value,
                "PATTERN_MISMATCH"
            )
        }

        // startsWith
        if (validation.startsWith && !value.startsWith(validation.startsWith.value)) {
            return new FieldValidationError(
                fieldName,
                validation.startsWith.message || `Must start with "${validation.startsWith.value}"`,
                value,
                "STARTS_WITH"
            )
        }

        // endsWith
        if (validation.endsWith && !value.endsWith(validation.endsWith.value)) {
            return new FieldValidationError(
                fieldName,
                validation.endsWith.message || `Must end with "${validation.endsWith.value}"`,
                value,
                "ENDS_WITH"
            )
        }

        // contains
        if (validation.contains && !value.includes(validation.contains.value)) {
            return new FieldValidationError(
                fieldName,
                validation.contains.message || `Must contain "${validation.contains.value}"`,
                value,
                "CONTAINS"
            )
        }

        // datetime
        if (validation.datetime && !VALIDATION_PATTERNS.ISO_DATETIME.test(value)) {
            return new FieldValidationError(
                fieldName,
                validation.datetime.message || "Invalid ISO datetime format",
                value,
                "INVALID_DATETIME"
            )
        }

        // min length (validation object takes precedence)
        if (validation.min && value.length < validation.min.value) {
            return new FieldValidationError(
                fieldName,
                validation.min.message || `Must be at least ${validation.min.value} characters`,
                value,
                "MIN_LENGTH"
            )
        }

        // max length (validation object takes precedence)
        if (validation.max && value.length > validation.max.value) {
            return new FieldValidationError(
                fieldName,
                validation.max.message || `Must be at most ${validation.max.value} characters`,
                value,
                "MAX_LENGTH"
            )
        }
    }

    // Number validations
    if (typeof value === "number") {
        // min value (validation object)
        if (validation.min && value < validation.min.value) {
            return new FieldValidationError(
                fieldName,
                validation.min.message || `Must be at least ${validation.min.value}`,
                value,
                "MIN_VALUE"
            )
        }

        // max value (validation object)
        if (validation.max && value > validation.max.value) {
            return new FieldValidationError(
                fieldName,
                validation.max.message || `Must be at most ${validation.max.value}`,
                value,
                "MAX_VALUE"
            )
        }

        // gt
        if (validation.gt && value <= validation.gt.value) {
            return new FieldValidationError(
                fieldName,
                validation.gt.message || `Must be greater than ${validation.gt.value}`,
                value,
                "GREATER_THAN"
            )
        }

        // gte
        if (validation.gte && value < validation.gte.value) {
            return new FieldValidationError(
                fieldName,
                validation.gte.message || `Must be greater than or equal to ${validation.gte.value}`,
                value,
                "GREATER_THAN_OR_EQUAL"
            )
        }

        // lt
        if (validation.lt && value >= validation.lt.value) {
            return new FieldValidationError(
                fieldName,
                validation.lt.message || `Must be less than ${validation.lt.value}`,
                value,
                "LESS_THAN"
            )
        }

        // lte
        if (validation.lte && value > validation.lte.value) {
            return new FieldValidationError(
                fieldName,
                validation.lte.message || `Must be less than or equal to ${validation.lte.value}`,
                value,
                "LESS_THAN_OR_EQUAL"
            )
        }
    }

    // Zod schema escape hatch
    if (validation.zodSchema) {
        const schema = validation.zodSchema as { safeParse: (v: unknown) => any }
        if (schema && typeof schema.safeParse === "function") {
            const result = schema.safeParse(value)
            if (!result.success) {
                const message = result.error?.errors?.[0]?.message || "Validation failed"
                return new FieldValidationError(fieldName, message, value, "ZOD_VALIDATION")
            }
        }
    }

    // Custom validation function
    if (validation.custom && !validation.custom.fn(value)) {
        return new FieldValidationError(
            fieldName,
            validation.custom.message || "Custom validation failed",
            value,
            "CUSTOM_VALIDATION"
        )
    }

    return null
}

/**
 * Validate all fields in data against entity definition
 * Throws FieldValidationErrors if any validation fails
 */
export function validateData(
    data: Record<string, unknown>,
    entity: Entity,
    operation: "create" | "update" = "create"
): void {
    const errors: FieldValidationError[] = []

    for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
        // Skip hasMany relations
        if (fieldDef.relation?.type === "hasMany") continue

        // Skip validation for fields not in data during update
        if (operation === "update" && !(fieldName in data)) {
            continue
        }

        const value = data[fieldName]
        const error = validateField(fieldName, value, fieldDef)
        if (error) {
            errors.push(error)
        }
    }

    if (errors.length > 0) {
        throw new FieldValidationErrors(errors)
    }
}

/**
 * Validate data without throwing - returns errors array
 */
export function validateDataSafe(
    data: Record<string, unknown>,
    entity: Entity,
    operation: "create" | "update" = "create"
): FieldValidationError[] {
    const errors: FieldValidationError[] = []

    for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
        if (fieldDef.relation?.type === "hasMany") continue
        if (operation === "update" && !(fieldName in data)) continue

        const value = data[fieldName]
        const error = validateField(fieldName, value, fieldDef)
        if (error) {
            errors.push(error)
        }
    }

    return errors
}

/**
 * Get validation schema as JSON (for client-side validation)
 */
export function getValidationSchema(entity: Entity): Record<string, unknown> {
    const schema: Record<string, unknown> = {}

    for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
        if (fieldDef.relation?.type === "hasMany") continue

        const fieldSchema: Record<string, unknown> = {
            type: fieldDef.type,
            optional: fieldDef.optional ?? false,
        }

        // Include direct field properties
        if (fieldDef.min !== undefined) fieldSchema.min = fieldDef.min
        if (fieldDef.max !== undefined) fieldSchema.max = fieldDef.max
        if (fieldDef.isEmail) fieldSchema.email = true

        // Include validation object
        if (fieldDef.validation) {
            fieldSchema.validation = fieldDef.validation
        }

        schema[fieldName] = fieldSchema
    }

    return schema
}
