// =============================================================================
// ENHANCEMENTS
// Field-level enhancements for validation, transformation, and security
// Attribute system for field-level enhancements
// =============================================================================

import type { Entity, User } from "../types.js"
import { transformData, hasTransforms } from "./transform.js"
import { validateData, FieldValidationError, FieldValidationErrors } from "./validation.js"
import {
  processWriteData,
  processReadData,
  processReadDataArray,
  hasSecurityFields,
  initEncryption,
  generateEncryptionKey,
  hashPassword,
  verifyPassword,
} from "./security.js"
import {
  validateCrossFields,
  hasCrossFieldValidators,
} from "./cross-field-validation.js"
import {
  filterReadableFields,
  filterWritableFields,
  hasFieldAccessPolicies,
} from "./field-access.js"

// Re-export everything
export * from "./validation.js"
export * from "./transform.js"
export * from "./security.js"
export * from "./cross-field-validation.js"
export * from "./field-access.js"

// -----------------------------------------------------------------------------
// Enhancement Pipeline
// -----------------------------------------------------------------------------

export interface EnhancementOptions extends NevrEnhancementConfig {
  /** Skip validation */
  skipValidation?: boolean
  /** Skip transforms */
  skipTransforms?: boolean
  /** Skip security processing */
  skipSecurity?: boolean
  /** Skip cross-field validation */
  skipCrossFieldValidation?: boolean
  /** Skip field access policies */
  skipFieldAccess?: boolean
  /** Current user for access policy evaluation */
  user?: User | null
  /** Existing data for updates */
  existingData?: Record<string, unknown>
  /** Resource ID for access policy evaluation */
  resourceId?: string
}

/**
 * Process data before writing to database
 * Pipeline: Field Access -> Transform -> Validate -> Cross-Field Validate -> Security (hash/encrypt)
 */
export async function enhanceWriteData(
  data: Record<string, unknown>,
  entity: Entity,
  operation: "create" | "update" = "create",
  options: EnhancementOptions = {}
): Promise<Record<string, unknown>> {
  let result = data

  // Step 0: Filter writable fields (field-level access policies)
  if (!options.skipFieldAccess && hasFieldAccessPolicies(entity)) {
    result = await filterWritableFields(result, entity, {
      user: options.user ?? null,
      resourceId: options.resourceId,
      existingData: options.existingData,
      crudOperation: operation,
    }, { throwOnDenied: true })
  }

  // Step 1: Apply transforms (trim, lower, upper)
  if (!options.skipTransforms && hasTransforms(entity)) {
    result = transformData(result, entity)
  }

  // Step 2: Validate individual fields
  if (!options.skipValidation) {
    validateData(result, entity, operation)
  }

  // Step 3: Cross-field validation
  if (!options.skipCrossFieldValidation && hasCrossFieldValidators(entity)) {
    await validateCrossFields(result, entity, operation, {
      existingData: options.existingData,
      user: options.user,
    })
  }

  // Step 4: Apply security (hash passwords, encrypt fields)
  if (!options.skipSecurity && hasSecurityFields(entity)) {
    result = await processWriteData(result, entity)
  }

  return result
}

/**
 * Process data after reading from database
 * Pipeline: Security (decrypt, omit) -> Field Access (filter readable)
 */
export async function enhanceReadData(
  data: Record<string, unknown> | null,
  entity: Entity,
  options: EnhancementOptions = {}
): Promise<Record<string, unknown> | null> {
  if (!data) return null

  let result = data

  // Step 1: Apply security (omit fields, decrypt)
  if (!options.skipSecurity && hasSecurityFields(entity)) {
    result = await processReadData(result, entity)
  }

  // Step 2: Filter readable fields (field-level access policies)
  if (!options.skipFieldAccess && hasFieldAccessPolicies(entity)) {
    result = await filterReadableFields(result, entity, {
      user: options.user ?? null,
      resourceId: options.resourceId,
    })
  }

  return result
}

/**
 * Process array of data after reading from database
 */
export async function enhanceReadDataArray(
  data: Record<string, unknown>[],
  entity: Entity,
  options: EnhancementOptions = {}
): Promise<Record<string, unknown>[]> {
  let result = data

  // Step 1: Apply security processing
  if (!options.skipSecurity && hasSecurityFields(entity)) {
    result = await processReadDataArray(result, entity)
  }

  // Step 2: Filter readable fields for each item
  if (!options.skipFieldAccess && hasFieldAccessPolicies(entity)) {
    result = await Promise.all(
      result.map((item) =>
        filterReadableFields(item, entity, {
          user: options.user ?? null,
          resourceId: options.resourceId,
        })
      )
    )
  }

  return result
}

// -----------------------------------------------------------------------------
// Enhancement Utilities
// -----------------------------------------------------------------------------

/**
 * Check if entity has any enhancements
 */
export function hasEnhancements(entity: Entity): boolean {
  // Check field-level enhancements
  const hasFieldEnhancements = Object.values(entity.config.fields).some((field) => {
    const hasValidation = field.validation && Object.keys(field.validation).length > 0
    const hasTransforms = field.transforms && Object.keys(field.transforms).length > 0
    const hasSecurity = field.security && Object.keys(field.security).length > 0
    const hasAccess = field.access && Object.keys(field.access).length > 0
    return hasValidation || hasTransforms || hasSecurity || hasAccess
  })

  // Check entity-level enhancements
  const hasEntityEnhancements = hasCrossFieldValidators(entity)

  return hasFieldEnhancements || hasEntityEnhancements
}

/**
 * Get enhancement summary for an entity
 */
export function getEnhancementSummary(entity: Entity): {
  validation: string[]
  transforms: string[]
  security: { password: string[]; omit: string[]; encrypted: string[] }
  access: { read: string[]; write: string[] }
  crossFieldValidators: number
} {
  const validation: string[] = []
  const transforms: string[] = []
  const password: string[] = []
  const omit: string[] = []
  const encrypted: string[] = []
  const readAccess: string[] = []
  const writeAccess: string[] = []

  for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
    if (fieldDef.validation && Object.keys(fieldDef.validation).length > 0) {
      validation.push(fieldName)
    }
    if (fieldDef.transforms && Object.keys(fieldDef.transforms).length > 0) {
      transforms.push(fieldName)
    }
    if (fieldDef.security?.password) {
      password.push(fieldName)
    }
    if (fieldDef.security?.omit) {
      omit.push(fieldName)
    }
    if (fieldDef.security?.encrypted) {
      encrypted.push(fieldName)
    }
    if (fieldDef.access?.read) {
      readAccess.push(fieldName)
    }
    if (fieldDef.access?.write) {
      writeAccess.push(fieldName)
    }
  }

  return {
    validation,
    transforms,
    security: { password, omit, encrypted },
    access: { read: readAccess, write: writeAccess },
    crossFieldValidators: entity.config.validators?.length ?? 0,
  }
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

export interface NevrEnhancementConfig {
  /** Encryption key for @encrypted fields (base64 or Uint8Array) */
  encryptionKey?: string | Uint8Array
}

/**
 * Initialize enhancements with configuration
 */
export async function initEnhancements(config: NevrEnhancementConfig): Promise<void> {
  if (config.encryptionKey) {
    await initEncryption(config.encryptionKey)
  }
}

// Re-export utility functions for external use
export {
  initEncryption,
  generateEncryptionKey,
  hashPassword,
  verifyPassword,
}

// Enhanced Driver
export {
  createEnhancedDriver,
  isEnhancedDriver,
  getBaseDriver,
  type EnhancedDriverOptions,
} from "./enhanced-driver.js"
