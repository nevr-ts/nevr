// =============================================================================
// INPUT VALIDATION
// Validates input data against entity field definitions
// Delegates field-level validation to enhancements/validation.ts
// =============================================================================

import type { Entity, FieldDef, Operation } from "./types.js"
import { parseValue, type ValidationError, type ValidationResult } from "./validation-utils.js"
import { validateField as validateFieldEnhanced, FieldValidationError } from "./enhancements/validation.js"

// Re-export types for backwards compatibility
export type { ValidationError, ValidationResult } from "./validation-utils.js"

// -----------------------------------------------------------------------------
// Input Validation
// -----------------------------------------------------------------------------

/**
 * Validate input data against entity definition
 * Uses the unified field validation from enhancements
 */
export function validateInput(
    entity: Entity,
    input: Record<string, unknown>,
    operation: Operation
): ValidationResult {
    const errors: ValidationError[] = []
    const data: Record<string, unknown> = {}

    // Get allowed fields (exclude relations for hasMany)
    const allowedFields = new Set<string>()
    const foreignKeys = new Set<string>()

    for (const [name, field] of Object.entries(entity.config.fields)) {
        if (field.relation?.type === "hasMany") {
            // Skip hasMany relations in input
            continue
        }

        if (field.relation) {
            // For belongsTo, allow the foreign key
            foreignKeys.add(field.relation.foreignKey)
            allowedFields.add(name)
        } else {
            allowedFields.add(name)
        }
    }

    // Add foreign keys to allowed fields
    for (const fk of foreignKeys) {
        allowedFields.add(fk)
    }

    // Validate each field in input
    for (const [key, value] of Object.entries(input)) {
        // Skip unknown fields (mass assignment protection)
        if (!allowedFields.has(key)) {
            continue
        }

        // Find field definition
        let field = entity.config.fields[key]

        // Check if it's a foreign key
        if (!field) {
            // Find the relation that uses this foreign key
            for (const [, f] of Object.entries(entity.config.fields)) {
                if (f.relation?.foreignKey === key) {
                    // Treat as string field for validation
                    field = { type: "string", optional: f.optional, unique: false, hasDefault: false }
                    break
                }
            }
        }

        if (field) {
            // Use the unified field validation from enhancements
            const fieldError = validateFieldEnhanced(key, value, field)
            if (fieldError) {
                errors.push({
                    field: fieldError.field,
                    message: fieldError.message.replace(`Validation failed for field "${fieldError.field}": `, ""),
                    code: fieldError.code,
                })
            }

            if (!fieldError && value !== undefined) {
                data[key] = value
            }
        }
    }

    // For create, check required fields and apply defaults
    if (operation === "create") {
        for (const [name, field] of Object.entries(entity.config.fields)) {
            // Skip relations (hasMany) and auto-generated
            if (field.relation?.type === "hasMany") continue

            // Skip owner field (auto-set)
            if (entity.config.ownerField && field.relation?.foreignKey === entity.config.ownerField) {
                continue
            }

            // Determine the field name (use foreign key for relations)
            const fieldName = field.relation ? field.relation.foreignKey : name

            // Apply default value if field is missing and has a default
            if (!(fieldName in data) && field.default !== undefined) {
                data[fieldName] = field.default
            }

            // Check if required field is missing (after applying defaults)
            if (!field.optional && field.default === undefined && !(fieldName in data)) {
                errors.push({ field: fieldName, message: "Required", code: "REQUIRED" })
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        data,
    }
}

// -----------------------------------------------------------------------------
// Query Parameter Validation
// -----------------------------------------------------------------------------

/**
 * Validate query parameters for list endpoints
 *
 * Supported query parameters:
 * - filter[field]=value         Exact match
 * - filter[field][eq]=value     Equals
 * - filter[field][ne]=value     Not equals
 * - filter[field][gt]=value     Greater than
 * - filter[field][gte]=value    Greater than or equal
 * - filter[field][lt]=value     Less than
 * - filter[field][lte]=value    Less than or equal
 * - filter[field][contains]=value    String contains
 * - filter[field][startsWith]=value  String starts with
 * - filter[field][endsWith]=value    String ends with
 * - filter[field][in]=a,b,c     In array
 * - sort=field,-field2          Sort (prefix with - for desc)
 * - limit=20                    Max results (default: 20, max: 100)
 * - offset=0                    Skip results
 * - page=1                      Page number (alternative to offset)
 * - include=relation1,relation2 Include relations
 */
export function validateQueryParams(query: Record<string, unknown>): {
    filter: Record<string, unknown>
    sort: Record<string, "asc" | "desc">
    take: number
    skip: number
    include: Record<string, boolean>
    select: Record<string, boolean> | null
} {
    let filter: Record<string, unknown> = {}
    let sort: Record<string, "asc" | "desc"> = {}
    let take = 20
    let skip = 0
    const include: Record<string, boolean> = {}
    let select: Record<string, boolean> | null = null

    // -------------------------------------------------------------------------
    // JSON Format Support (from client entity.ts)
    // Handles: ?filter={"status":"active"}&sort={"createdAt":"desc"}
    // -------------------------------------------------------------------------

    // Parse JSON filter if present
    if (typeof query.filter === "string") {
        try {
            const parsed = JSON.parse(query.filter)
            if (typeof parsed === "object" && parsed !== null) {
                filter = parsed
            }
        } catch {
            // Not JSON, will try bracket notation below
        }
    }

    // Parse JSON sort if present
    if (typeof query.sort === "string" && query.sort.startsWith("{")) {
        try {
            const parsed = JSON.parse(query.sort)
            if (typeof parsed === "object" && parsed !== null) {
                for (const [field, direction] of Object.entries(parsed)) {
                    if (direction === "asc" || direction === "desc") {
                        sort[field] = direction
                    }
                }
            }
        } catch {
            // Not JSON, will try comma-separated format below
        }
    }

    // Parse select parameter (for field selection)
    // Supports: ?select=id,name,email OR ?select={"id":true,"name":true}
    if (typeof query.select === "string") {
        try {
            // Try JSON format first
            if (query.select.startsWith("{")) {
                const parsed = JSON.parse(query.select)
                if (typeof parsed === "object" && parsed !== null) {
                    select = parsed
                }
            } else {
                // Comma-separated format: select=id,name,email
                const fields = query.select.split(",").map(f => f.trim()).filter(Boolean)
                if (fields.length > 0) {
                    select = {}
                    for (const field of fields) {
                        select[field] = true
                    }
                }
            }
        } catch {
            // Invalid format, ignore
        }
    }

    // -------------------------------------------------------------------------
    // Bracket Notation Support (legacy/alternative)
    // Handles: ?filter[status]=active&filter[price][gte]=100
    // -------------------------------------------------------------------------

    // Parse filter - support both simple and operator syntax
    for (const [key, value] of Object.entries(query)) {
        // Simple filter: filter[field]=value
        if (key.startsWith("filter[") && key.endsWith("]") && !key.includes("][")) {
            const fieldName = key.slice(7, -1)
            filter[fieldName] = parseValue(value)
        }

        // Operator filter: filter[field][operator]=value
        const operatorMatch = key.match(/^filter\[(\w+)\]\[(\w+)\]$/)
        if (operatorMatch) {
            const [, fieldName, operator] = operatorMatch
            const parsedValue = parseValue(value)

            // Map operators to Prisma-style where clause
            switch (operator) {
                case "eq":
                case "equals":
                    filter[fieldName] = { equals: parsedValue }
                    break
                case "ne":
                case "not":
                    filter[fieldName] = { not: parsedValue }
                    break
                case "gt":
                    filter[fieldName] = { gt: parsedValue }
                    break
                case "gte":
                    filter[fieldName] = { gte: parsedValue }
                    break
                case "lt":
                    filter[fieldName] = { lt: parsedValue }
                    break
                case "lte":
                    filter[fieldName] = { lte: parsedValue }
                    break
                case "contains":
                    filter[fieldName] = { contains: parsedValue }
                    break
                case "startsWith":
                    filter[fieldName] = { startsWith: parsedValue }
                    break
                case "endsWith":
                    filter[fieldName] = { endsWith: parsedValue }
                    break
                case "in":
                    // Handle comma-separated values
                    const inValues =
                        typeof value === "string"
                            ? value.split(",").map((v) => parseValue(v.trim()))
                            : Array.isArray(value)
                                ? value.map(parseValue)
                                : [parsedValue]
                    filter[fieldName] = { in: inValues }
                    break
                case "notIn":
                    const notInValues =
                        typeof value === "string"
                            ? value.split(",").map((v) => parseValue(v.trim()))
                            : Array.isArray(value)
                                ? value.map(parseValue)
                                : [parsedValue]
                    filter[fieldName] = { notIn: notInValues }
                    break
            }
        }
    }

    // Parse sort - support comma-separated, prefix with - for desc
    if (typeof query.sort === "string") {
        const sortFields = query.sort.split(",")
        for (const field of sortFields) {
            const trimmed = field.trim()
            if (trimmed.startsWith("-")) {
                sort[trimmed.slice(1)] = "desc"
            } else if (trimmed.startsWith("+")) {
                sort[trimmed.slice(1)] = "asc"
            } else {
                sort[trimmed] = "asc"
            }
        }
    }

    // Also support orderBy as alias for sort
    if (typeof query.orderBy === "string") {
        const sortFields = query.orderBy.split(",")
        for (const field of sortFields) {
            const trimmed = field.trim()
            if (trimmed.startsWith("-")) {
                sort[trimmed.slice(1)] = "desc"
            } else {
                sort[trimmed] = "asc"
            }
        }
    }

    // Parse pagination
    if (typeof query.limit === "string") {
        take = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100)
    }
    if (typeof query.take === "string") {
        take = Math.min(Math.max(1, parseInt(query.take, 10) || 20), 100)
    }

    if (typeof query.offset === "string") {
        skip = Math.max(0, parseInt(query.offset, 10) || 0)
    }
    if (typeof query.skip === "string") {
        skip = Math.max(0, parseInt(query.skip, 10) || 0)
    }

    // Support page-based pagination
    if (typeof query.page === "string") {
        const page = Math.max(1, parseInt(query.page, 10) || 1)
        skip = (page - 1) * take
    }

    // Parse include - comma-separated relation names
    if (typeof query.include === "string") {
        const includes = query.include.split(",")
        for (const inc of includes) {
            const trimmed = inc.trim()
            if (trimmed) {
                include[trimmed] = true
            }
        }
    }

    return { filter, sort, take, skip, include, select }
}
