// =============================================================================
// CROSS-FIELD VALIDATION
// Entity-level validators that can access multiple fields
// =============================================================================

import type { Entity, EntityValidator, EntityValidatorContext, User } from "../types.js"

// -----------------------------------------------------------------------------
// Cross-Field Validation Error
// -----------------------------------------------------------------------------

/**
 * Error thrown when cross-field validation fails
 */
export class CrossFieldValidationError extends Error {
  constructor(
    public readonly message: string,
    public readonly fields?: string[]
  ) {
    super(message)
    this.name = "CrossFieldValidationError"
  }
}

/**
 * Collection of cross-field validation errors
 */
export class CrossFieldValidationErrors extends Error {
  constructor(public readonly errors: CrossFieldValidationError[]) {
    const messages = errors.map((e) => e.message).join("; ")
    super(`Cross-field validation failed: ${messages}`)
    this.name = "CrossFieldValidationErrors"
  }
}

// -----------------------------------------------------------------------------
// Cross-Field Validation Functions
// -----------------------------------------------------------------------------

/**
 * Run a single validator
 */
export async function runValidator(
  validator: EntityValidator,
  data: Record<string, unknown>,
  ctx?: EntityValidatorContext
): Promise<CrossFieldValidationError | null> {
  try {
    const result = await validator.fn(data, ctx)
    if (!result) {
      return new CrossFieldValidationError(validator.message, validator.fields)
    }
    return null
  } catch (error) {
    // If the validator throws, treat it as a failure
    const message = error instanceof Error ? error.message : validator.message
    return new CrossFieldValidationError(message, validator.fields)
  }
}

/**
 * Validate data against all entity validators
 * Throws CrossFieldValidationErrors if any validators fail
 */
export async function validateCrossFields(
  data: Record<string, unknown>,
  entity: Entity,
  operation: "create" | "update",
  options?: {
    existingData?: Record<string, unknown>
    user?: User | null
  }
): Promise<void> {
  const validators = entity.config.validators
  if (!validators || validators.length === 0) {
    return
  }

  const ctx: EntityValidatorContext = {
    operation,
    existingData: options?.existingData,
    user: options?.user,
  }

  const errors: CrossFieldValidationError[] = []

  for (const validator of validators) {
    // Skip if validator is for specific operations and current operation doesn't match
    if (validator.operations && !validator.operations.includes(operation)) {
      continue
    }

    // For updates, skip if validator has specific fields and none of them are being updated
    if (operation === "update" && validator.fields && validator.fields.length > 0) {
      const hasRelevantField = validator.fields.some((field) => field in data)
      if (!hasRelevantField) {
        continue
      }
    }

    // Merge existing data with new data for updates
    const mergedData = operation === "update" && options?.existingData
      ? { ...options.existingData, ...data }
      : data

    const error = await runValidator(validator, mergedData, ctx)
    if (error) {
      errors.push(error)
    }
  }

  if (errors.length > 0) {
    throw new CrossFieldValidationErrors(errors)
  }
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Check if entity has any cross-field validators
 */
export function hasCrossFieldValidators(entity: Entity): boolean {
  return (entity.config.validators?.length ?? 0) > 0
}

/**
 * Get all validators for an entity
 */
export function getValidators(entity: Entity): EntityValidator[] {
  return entity.config.validators ?? []
}

/**
 * Get validators that apply to a specific operation
 */
export function getValidatorsForOperation(
  entity: Entity,
  operation: "create" | "update"
): EntityValidator[] {
  const validators = entity.config.validators ?? []
  return validators.filter((v) => !v.operations || v.operations.includes(operation))
}

/**
 * Get fields that are validated by cross-field validators
 */
export function getCrossFieldValidatedFields(entity: Entity): string[] {
  const validators = entity.config.validators ?? []
  const fields = new Set<string>()

  for (const validator of validators) {
    if (validator.fields) {
      for (const field of validator.fields) {
        fields.add(field)
      }
    }
  }

  return Array.from(fields)
}
