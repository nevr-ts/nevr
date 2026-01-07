// =============================================================================
// SHORTHAND API FOR PLUGINS
// Simple add/extend/remove operations for entity manipulation
// =============================================================================

import type { Entity, FieldDef } from "../../types.js"
import type { PluginSchema, PluginEntityDef, PluginFieldDef, PluginFieldDefObject } from "./contract.js"
import { FieldBuilder } from "../../fields.js"

// -----------------------------------------------------------------------------
// Shorthand Types
// -----------------------------------------------------------------------------

export interface AddEntityOptions {
  /** Entity name */
  name: string

  /** Entity fields (using FieldBuilder or raw PluginFieldDef) */
  fields: Record<string, FieldBuilder | PluginFieldDef>

  /** Description for documentation */
  description?: string

  /** If true, no CRUD routes are generated */
  internal?: boolean

  /** Custom route path */
  routePath?: string

  /** If true, entity cannot be removed */
  required?: boolean
}

export interface ExtendEntityOptions {
  /** Target entity name */
  entity: string

  /** Fields to add */
  fields: Record<string, FieldBuilder | PluginFieldDef>
}

export interface RemoveEntityOptions {
  /** Entity name to remove */
  entity: string
}

export interface RemoveFieldOptions {
  /** Target entity name */
  entity: string

  /** Field name to remove */
  field: string
}

// -----------------------------------------------------------------------------
// Schema Builder with Shorthand API
// -----------------------------------------------------------------------------

export class SchemaShorthand {
  private _entities: Map<string, PluginEntityDef> = new Map()
  private _extensions: Map<string, Record<string, PluginFieldDef>> = new Map()
  private _removedEntities: Set<string> = new Set()
  private _removedFields: Map<string, Set<string>> = new Map()

  /**
   * Add a new entity
   *
   * @example
   * ```typescript
   * schema.add({
   *   entity: "subscription",
   *   fields: {
   *     userId: string,
   *     plan: string.default("free"),
   *     expiresAt: datetime.optional(),
   *   },
   * })
   * ```
   */
  add(options: AddEntityOptions): this {
    const fields = this._convertFields(options.fields)

    this._entities.set(options.name, {
      fields,
      description: options.description,
      internal: options.internal,
      routePath: options.routePath,
      required: options.required,
    })

    return this
  }

  /**
   * Extend an existing entity with new fields
   * If entity doesn't exist, creates it
   *
   * @example
   * ```typescript
   * schema.extend({
   *   entity: "user",
   *   fields: {
   *     role: { type: "string", default: "user", input: false },
   *     stripeCustomerId: { type: "string", input: false },
   *   },
   * })
   * ```
   */
  extend(options: ExtendEntityOptions): this {
    const fields = this._convertFields(options.fields)

    const existing = this._extensions.get(options.entity) || {}
    this._extensions.set(options.entity, { ...existing, ...fields })

    return this
  }

  /**
   * Remove an entity (if not required/locked)
   *
   * @example
   * ```typescript
   * schema.remove({ entity: "temporaryEntity" })
   * ```
   */
  remove(options: RemoveEntityOptions): this {
    this._removedEntities.add(options.entity)
    return this
  }

  /**
   * Remove a field from an entity (if not locked)
   *
   * @example
   * ```typescript
   * schema.removeField({ entity: "user", field: "legacyField" })
   * ```
   */
  removeField(options: RemoveFieldOptions): this {
    if (!this._removedFields.has(options.entity)) {
      this._removedFields.set(options.entity, new Set())
    }
    this._removedFields.get(options.entity)!.add(options.field)
    return this
  }

  /**
   * Build the final schema
   */
  build(): PluginSchema {
    const entities: Record<string, PluginEntityDef> = {}
    const extend: Record<string, Record<string, PluginFieldDef>> = {}

    // Add entities
    for (const [name, def] of this._entities) {
      if (!this._removedEntities.has(name)) {
        entities[name] = def
      }
    }

    // Add extensions
    for (const [entity, fields] of this._extensions) {
      const removedFieldsForEntity = this._removedFields.get(entity)
      const filteredFields: Record<string, PluginFieldDef> = {}

      for (const [fieldName, field] of Object.entries(fields)) {
        if (!removedFieldsForEntity?.has(fieldName)) {
          filteredFields[fieldName] = field
        }
      }

      if (Object.keys(filteredFields).length > 0) {
        extend[entity] = filteredFields
      }
    }

    return {
      entities: Object.keys(entities).length > 0 ? entities : undefined,
      extend: Object.keys(extend).length > 0 ? extend : undefined,
    }
  }

  /**
   * Convert FieldBuilder to PluginFieldDef
   */
  private _convertFields(
    fields: Record<string, FieldBuilder | PluginFieldDef>
  ): Record<string, PluginFieldDef> {
    const result: Record<string, PluginFieldDef> = {}

    for (const [name, field] of Object.entries(fields)) {
      if (field instanceof FieldBuilder) {
        const built = field._build()
        result[name] = {
          type: built.type,
          required: !built.optional,
          unique: built.unique,
          default: built.default,
        }
      } else {
        result[name] = field as PluginFieldDef
      }
    }

    return result
  }
}

/**
 * Create a schema using shorthand API
 *
 * @example
 * ```typescript
 * import { schema, string, datetime } from "nevr"
 *
 * const paymentSchema = schema()
 *   .add({
 *     entity: "subscription",
 *     fields: {
 *       userId: string,
 *       plan: string.default("free"),
 *       expiresAt: datetime.optional(),
 *     },
 *   })
 *   .extend({
 *     entity: "user",
 *     fields: {
 *       stripeCustomerId: { type: "string", input: false },
 *     },
 *   })
 *   .build()
 * ```
 */
export function schema(): SchemaShorthand {
  return new SchemaShorthand()
}

// -----------------------------------------------------------------------------
// Standalone Functions
// For even simpler usage
// -----------------------------------------------------------------------------

/**
 * Create a new entity definition
 *
 * @example
 * ```typescript
 * const subscriptionEntity = addEntity({
 *   name: "subscription",
 *   fields: {
 *     userId: string,
 *     plan: string.default("free"),
 *   },
 * })
 * ```
 */
export function addEntity(options: AddEntityOptions): { name: string; def: PluginEntityDef } {
  const builder = new SchemaShorthand()
  builder.add(options)
  const schema = builder.build()
  return {
    name: options.name,
    def: schema.entities![options.name],
  }
}

/**
 * Create field extension for an entity
 *
 * @example
 * ```typescript
 * const userExtensions = extendEntity({
 *   entity: "user",
 *   fields: {
 *     role: { type: "string", input: false, default: "user" },
 *   },
 * })
 * ```
 */
export function extendEntity(options: ExtendEntityOptions): Record<string, PluginFieldDef> {
  const builder = new SchemaShorthand()
  builder.extend(options)
  const schema = builder.build()
  return schema.extend![options.entity]
}

// -----------------------------------------------------------------------------
// Field Helpers with Safety Attributes
// Convenient field definitions with input/returned
// -----------------------------------------------------------------------------

/**
 * Create a protected field (input: false)
 * Can only be set by server-side code
 */
export function protectedField(
  type: PluginFieldDefObject["type"],
  options?: Omit<PluginFieldDefObject, "type" | "input">
): PluginFieldDefObject {
  return {
    type,
    input: false,
    ...options,
  }
}

/**
 * Create a hidden field (returned: false)
 * Never sent to client
 */
export function hiddenField(
  type: PluginFieldDefObject["type"],
  options?: Omit<PluginFieldDefObject, "type" | "returned">
): PluginFieldDefObject {
  return {
    type,
    returned: false,
    ...options,
  }
}

/**
 * Create a protected AND hidden field
 * Can't be set by client, not returned to client
 */
export function secretField(
  type: PluginFieldDefObject["type"],
  options?: Omit<PluginFieldDefObject, "type" | "input" | "returned">
): PluginFieldDefObject {
  return {
    type,
    input: false,
    returned: false,
    ...options,
  }
}

// -----------------------------------------------------------------------------
// Common Field Definitions
// Pre-built field definitions for common use cases
// -----------------------------------------------------------------------------

export const commonFields = {
  /** User role (protected - can't be set by client) */
  role: (defaultValue = "user"): PluginFieldDef => ({
    type: "string",
    input: false,
    default: defaultValue,
  }),

  /** Stripe customer ID (protected) */
  stripeCustomerId: (): PluginFieldDef => ({
    type: "string",
    input: false,
    required: false,
  }),

  /** Password hash (hidden - never returned) */
  password: (): PluginFieldDef => ({
    type: "string",
    returned: false,
    required: false,
  }),

  /** Email verified flag (protected) */
  emailVerified: (defaultValue = false): PluginFieldDef => ({
    type: "boolean",
    input: false,
    default: defaultValue,
  }),

  /** Banned status (protected) */
  banned: (defaultValue = false): PluginFieldDef => ({
    type: "boolean",
    input: false,
    default: defaultValue,
  }),

  /** Last login timestamp (protected) */
  lastLoginAt: (): PluginFieldDef => ({
    type: "datetime",
    input: false,
    required: false,
  }),

  /** API key (protected + hidden) */
  apiKey: (): PluginFieldDef => ({
    type: "string",
    input: false,
    returned: false,
    required: false,
  }),
}
