// =============================================================================
// TRANSFORM ENHANCEMENT
// Transforms field values before validation/storage
// =============================================================================

import type { FieldDef, Entity } from "../types.js"

// -----------------------------------------------------------------------------
// Transform Functions
// -----------------------------------------------------------------------------

/**
 * Apply transforms to a single field value
 */
export function transformField(
  value: unknown,
  fieldDef: FieldDef
): unknown {
  // Only transform strings
  if (typeof value !== "string") {
    return value
  }

  const transforms = fieldDef.transforms
  if (!transforms) {
    return value
  }

  let result = value

  // Apply transforms in order: trim -> lower/upper
  if (transforms.trim) {
    result = result.trim()
  }

  if (transforms.lower) {
    result = result.toLowerCase()
  }

  if (transforms.upper) {
    result = result.toUpperCase()
  }

  return result
}

/**
 * Apply transforms to all fields in data
 * Returns a new object with transformed values
 */
export function transformData(
  data: Record<string, unknown>,
  entity: Entity
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data }

  for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
    if (fieldName in data) {
      result[fieldName] = transformField(data[fieldName], fieldDef)
    }
  }

  return result
}

/**
 * Check if entity has any transform fields
 */
export function hasTransforms(entity: Entity): boolean {
  return Object.values(entity.config.fields).some(
    (field) => field.transforms && Object.keys(field.transforms).length > 0
  )
}

/**
 * Get list of fields with transforms
 */
export function getTransformFields(entity: Entity): string[] {
  return Object.entries(entity.config.fields)
    .filter(([_, field]) => field.transforms && Object.keys(field.transforms).length > 0)
    .map(([name]) => name)
}
