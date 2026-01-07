// =============================================================================
// FIELD-LEVEL ACCESS POLICIES
// Controls read/write access to individual fields
// =============================================================================

import type {
  Entity,
  FieldDef,
  FieldAccessPolicy,
  FieldAccessContext,
  User,
} from "../types.js"

// -----------------------------------------------------------------------------
// Field Access Error
// -----------------------------------------------------------------------------

/**
 * Error thrown when field access is denied
 */
export class FieldAccessDeniedError extends Error {
  constructor(
    public readonly field: string,
    public readonly operation: "read" | "write",
    public readonly reason?: string
  ) {
    super(`Access denied: cannot ${operation} field "${field}"${reason ? `: ${reason}` : ""}`)
    this.name = "FieldAccessDeniedError"
  }
}

// -----------------------------------------------------------------------------
// Policy Evaluation
// -----------------------------------------------------------------------------

/**
 * Evaluate a field access policy
 */
export async function evaluatePolicy(
  policy: FieldAccessPolicy,
  ctx: FieldAccessContext
): Promise<boolean> {
  // String-based policies
  if (typeof policy === "string") {
    switch (policy) {
      case "everyone":
        return true
      case "none":
        return false
      case "authenticated":
        return ctx.user !== null
      case "admin":
        return ctx.user !== null && (
          (ctx.user as Record<string, unknown>).role === "admin" ||
          (ctx.user as Record<string, unknown>).isAdmin === true
        )
      case "owner":
        // Must be authenticated for owner access
        if (!ctx.user) {
          return false
        }

        // During CREATE (no resourceId), allow authenticated users
        // They are about to become the owner of the new resource
        if (!ctx.resourceId && ctx.crudOperation === "create") {
          return true
        }

        // For existing resources, compare user ID with owner field
        if (!ctx.data) {
          return false
        }

        // Try common owner field patterns
        const userId = ctx.user.id
        const ownerId = ctx.data.userId || ctx.data.ownerId || ctx.data.authorId || ctx.data.createdBy
        return userId === ownerId
      default:
        // Unknown policy, deny by default
        return false
    }
  }

  // Function-based policies
  if (typeof policy === "function") {
    try {
      return await policy(ctx)
    } catch {
      // If policy function throws, deny access
      return false
    }
  }

  // Unknown policy type, deny by default
  return false
}

/**
 * Check if a field can be read
 */
export async function canReadField(
  fieldName: string,
  fieldDef: FieldDef,
  ctx: Omit<FieldAccessContext, "field" | "operation">
): Promise<boolean> {
  // If no read policy, field is readable by everyone
  if (!fieldDef.access?.read) {
    return true
  }

  const fullCtx: FieldAccessContext = {
    ...ctx,
    field: fieldName,
    operation: "read",
  }

  return evaluatePolicy(fieldDef.access.read, fullCtx)
}

/**
 * Check if a field can be written
 */
export async function canWriteField(
  fieldName: string,
  fieldDef: FieldDef,
  ctx: Omit<FieldAccessContext, "field" | "operation"> & { crudOperation?: "create" | "update" }
): Promise<boolean> {
  // If no write policy, field is writable by everyone
  if (!fieldDef.access?.write) {
    return true
  }

  const fullCtx: FieldAccessContext = {
    ...ctx,
    field: fieldName,
    operation: "write",
    crudOperation: ctx.crudOperation,
  }

  return evaluatePolicy(fieldDef.access.write, fullCtx)
}

// -----------------------------------------------------------------------------
// Data Filtering
// -----------------------------------------------------------------------------

/**
 * Filter read data based on field access policies
 * Removes fields the user cannot read
 */
export async function filterReadableFields(
  data: Record<string, unknown>,
  entity: Entity,
  ctx: { user: User | null; resourceId?: string }
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}

  for (const [fieldName, value] of Object.entries(data)) {
    const fieldDef = entity.config.fields[fieldName]

    // If field is not in entity definition, include it (might be computed/virtual)
    if (!fieldDef) {
      result[fieldName] = value
      continue
    }

    const canRead = await canReadField(fieldName, fieldDef, {
      user: ctx.user,
      entity: entity.name,
      data,
      resourceId: ctx.resourceId,
    })

    if (canRead) {
      result[fieldName] = value
    }
  }

  return result
}

/**
 * Filter and validate write data based on field access policies
 * Throws FieldAccessDeniedError if trying to write protected fields
 */
export async function filterWritableFields(
  data: Record<string, unknown>,
  entity: Entity,
  ctx: { user: User | null; resourceId?: string; existingData?: Record<string, unknown>; crudOperation?: "create" | "update" },
  options?: { throwOnDenied?: boolean }
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}
  const deniedFields: string[] = []

  for (const [fieldName, value] of Object.entries(data)) {
    const fieldDef = entity.config.fields[fieldName]

    // If field is not in entity definition, skip it
    if (!fieldDef) {
      continue
    }

    const canWrite = await canWriteField(fieldName, fieldDef, {
      user: ctx.user,
      entity: entity.name,
      data: ctx.existingData ? { ...ctx.existingData, ...data } : data,
      resourceId: ctx.resourceId,
      crudOperation: ctx.crudOperation,
    })

    if (canWrite) {
      result[fieldName] = value
    } else {
      deniedFields.push(fieldName)
    }
  }

  if (options?.throwOnDenied && deniedFields.length > 0) {
    throw new FieldAccessDeniedError(
      deniedFields.join(", "),
      "write",
      `${deniedFields.length} field(s) are not writable`
    )
  }

  return result
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Check if entity has any field access policies
 */
export function hasFieldAccessPolicies(entity: Entity): boolean {
  return Object.values(entity.config.fields).some(
    (field) => field.access && (field.access.read || field.access.write)
  )
}

/**
 * Get fields with read access policies
 */
export function getReadPolicyFields(entity: Entity): string[] {
  return Object.entries(entity.config.fields)
    .filter(([_, field]) => field.access?.read)
    .map(([name]) => name)
}

/**
 * Get fields with write access policies
 */
export function getWritePolicyFields(entity: Entity): string[] {
  return Object.entries(entity.config.fields)
    .filter(([_, field]) => field.access?.write)
    .map(([name]) => name)
}

/**
 * Get all fields with any access policy
 */
export function getAccessPolicyFields(entity: Entity): string[] {
  return Object.entries(entity.config.fields)
    .filter(([_, field]) => field.access && (field.access.read || field.access.write))
    .map(([name]) => name)
}

/**
 * Get field access summary for an entity
 */
export function getFieldAccessSummary(entity: Entity): {
  readPolicies: Record<string, FieldAccessPolicy>
  writePolicies: Record<string, FieldAccessPolicy>
} {
  const readPolicies: Record<string, FieldAccessPolicy> = {}
  const writePolicies: Record<string, FieldAccessPolicy> = {}

  for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
    if (fieldDef.access?.read) {
      readPolicies[fieldName] = fieldDef.access.read
    }
    if (fieldDef.access?.write) {
      writePolicies[fieldName] = fieldDef.access.write
    }
  }

  return { readPolicies, writePolicies }
}
