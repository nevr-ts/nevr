// =============================================================================
// ENTITY-FIRST PLUGIN SCHEMA
// Allows plugins to define schema using the same entity DSL
// =============================================================================

import type { Entity, FieldDef, FieldType } from "../../types.js"
import type { PluginSchema, PluginFieldDef, PluginEntityDef } from "./contract.js"
import { EntityBuilder } from "../../entity.js"
import { FieldBuilder, RelationBuilder, buildFields } from "../../fields.js"

// -----------------------------------------------------------------------------
// Convert Entity to Plugin Schema
// -----------------------------------------------------------------------------

/**
 * Convert a FieldDef to PluginFieldDef
 */
function fieldDefToPluginField(field: FieldDef): PluginFieldDef {
  return {
    type: field.type,
    required: !field.optional,
    unique: field.unique,
    default: field.default,
    ...(field.relation && {
      references: {
        entity: field.relation.entity().name,
        field: field.relation.references,
      },
    }),
  }
}

/**
 * Convert an Entity to PluginEntityDef
 * Now carries over actions, rules, and validators for unified architecture
 */
function entityToPluginEntity(entity: Entity, options?: { internal?: boolean }): PluginEntityDef {
  const fields: Record<string, PluginFieldDef> = {}

  for (const [name, field] of Object.entries(entity.config.fields)) {
    fields[name] = fieldDefToPluginField(field)
  }

  return {
    fields,
    // Carry over actions for unified entity actions architecture
    actions: entity.config.actions,
    // Carry over authorization rules
    rules: Object.keys(entity.config.rules).length > 0 ? entity.config.rules : undefined,
    // Carry over cross-field validators
    validators: entity.config.validators,
    internal: options?.internal,
    description: undefined,
  }
}

/**
 * Convert entities to PluginSchema
 */
export function entitiesToSchema(
  entities: Entity[],
  options?: { internal?: string[] }
): PluginSchema {
  const internalSet = new Set(options?.internal || [])
  const result: PluginSchema = { entities: {} }

  for (const entity of entities) {
    result.entities![entity.name] = entityToPluginEntity(entity, {
      internal: internalSet.has(entity.name),
    })
  }

  return result
}

// -----------------------------------------------------------------------------
// Plugin Entity Builder
// Same as entity() but for plugins with additional features
// -----------------------------------------------------------------------------

export interface PluginEntityOptions {
  /**
   * If true, no CRUD routes are generated (plugin manages routes)
   */
  internal?: boolean

  /**
   * If true, developer cannot remove this entity
   */
  required?: boolean

  /**
   * Custom route path (relative to plugin basePath)
   */
  routePath?: string

  /**
   * Entity description for documentation
   */
  description?: string
}

export class PluginEntityBuilder extends EntityBuilder {
  private _pluginOptions: PluginEntityOptions = {}

  /**
   * Mark entity as internal (no CRUD routes generated)
   */
  internal(): this {
    this._pluginOptions.internal = true
    return this
  }

  /**
   * Mark entity as required (cannot be removed by developer)
   */
  required(): this {
    this._pluginOptions.required = true
    return this
  }

  /**
   * Set custom route path
   */
  routePath(path: string): this {
    this._pluginOptions.routePath = path
    return this
  }

  /**
   * Add description
   */
  describe(description: string): this {
    this._pluginOptions.description = description
    return this
  }

  /**
   * Get plugin options
   */
  getPluginOptions(): PluginEntityOptions {
    return this._pluginOptions
  }
}

/**
 * Create a plugin entity using the same DSL as regular entities
 *
 * @example
 * ```typescript
 * import { pluginEntity, string, datetime, belongsTo } from "nevr"
 *
 * const session = pluginEntity("session", {
 *   token: string.unique(),
 *   userId: string,
 *   expiresAt: datetime,
 * })
 *   .internal()  // No CRUD routes
 *   .required()  // Cannot be removed
 *   .build()
 * ```
 */
export function pluginEntity(
  name: string,
  fields: Record<string, FieldBuilder | RelationBuilder>
): PluginEntityBuilder {
  const builtFields = buildFields(fields)
  return new PluginEntityBuilder(name, builtFields) as PluginEntityBuilder
}

// -----------------------------------------------------------------------------
// Schema Builder
// Build plugin schema from entities
// -----------------------------------------------------------------------------

export interface SchemaBuilderOptions {
  /**
   * Entities owned by this plugin
   */
  entities?: Entity[]

  /**
   * Fields to add to existing entities
   */
  extend?: Record<string, Record<string, FieldBuilder>>
}

export class PluginSchemaBuilder {
  private _entities: Map<string, { entity: Entity; options: PluginEntityOptions }> = new Map()
  private _extend: Map<string, Record<string, PluginFieldDef>> = new Map()

  /**
   * Add an entity to the schema
   */
  entity(entity: Entity, options?: PluginEntityOptions): this {
    this._entities.set(entity.name, { entity, options: options || {} })
    return this
  }

  /**
   * Add multiple entities
   */
  entities(entities: Entity[], options?: PluginEntityOptions): this {
    for (const entity of entities) {
      this.entity(entity, options)
    }
    return this
  }

  /**
   * Extend an existing entity with additional fields
   */
  extend(entityName: string, fields: Record<string, FieldBuilder>): this {
    const converted: Record<string, PluginFieldDef> = {}

    for (const [name, builder] of Object.entries(fields)) {
      // Use _build() which is the internal method
      const field = builder._build()
      converted[name] = fieldDefToPluginField(field)
    }

    this._extend.set(entityName, { ...this._extend.get(entityName), ...converted })
    return this
  }

  /**
   * Build the plugin schema
   */
  build(): PluginSchema {
    const schema: PluginSchema = {
      entities: {},
      extend: {},
    }

    // Convert entities
    for (const [name, { entity, options }] of this._entities) {
      schema.entities![name] = {
        ...entityToPluginEntity(entity, options),
        internal: options.internal,
        required: options.required,
        routePath: options.routePath,
        description: options.description,
      }
    }

    // Add extensions
    for (const [name, fields] of this._extend) {
      schema.extend![name] = fields
    }

    return schema
  }
}

/**
 * Create a plugin schema using the entity DSL
 *
 * @example
 * ```typescript
 * import { defineSchema, entity, string, datetime } from "nevr"
 *
 * const user = entity("user", { email: string.unique() }).build()
 * const session = entity("session", { token: string, expiresAt: datetime }).build()
 *
 * const schema = defineSchema()
 *   .entity(user)
 *   .entity(session, { internal: true })
 *   .extend("user", { username: string.optional() })
 *   .build()
 * ```
 */
export function defineSchema(): PluginSchemaBuilder {
  return new PluginSchemaBuilder()
}

// -----------------------------------------------------------------------------
// Quick Schema Helper
// For simple plugins that just need entities
// -----------------------------------------------------------------------------

/**
 * Create plugin schema from entities array
 *
 * @example
 * ```typescript
 * import { schemaFromEntities, entity, string } from "nevr"
 *
 * const user = entity("user", { email: string }).build()
 * const session = entity("session", { token: string }).build()
 *
 * const schema = schemaFromEntities([user, session], {
 *   internal: ["session"]  // Mark session as internal
 * })
 * ```
 */
export function schemaFromEntities(
  entities: Entity[],
  options?: {
    internal?: string[]
    required?: string[]
  }
): PluginSchema {
  const internalSet = new Set(options?.internal || [])
  const requiredSet = new Set(options?.required || [])

  const schema: PluginSchema = { entities: {} }

  for (const entity of entities) {
    schema.entities![entity.name] = {
      ...entityToPluginEntity(entity),
      internal: internalSet.has(entity.name),
      required: requiredSet.has(entity.name),
    }
  }

  return schema
}
