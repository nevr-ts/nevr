// =============================================================================
// ENTITY DSL
// Usage: entity("post", { title: string }).ownedBy("author")
// =============================================================================

import type { Entity, EntityConfig, Operation, RuleDef, FieldDef } from "./types.js"
import { buildFields, FieldBuilder, RelationBuilder } from "./fields.js"

// -----------------------------------------------------------------------------
// Entity Builder
// -----------------------------------------------------------------------------

export class EntityBuilder {
  private _name: string
  private _fields: Record<string, FieldDef>
  private _rules: Partial<Record<Operation, RuleDef[]>> = {}
  private _ownerField?: string
  private _timestamps: boolean = true

  constructor(name: string, fields: Record<string, FieldBuilder | RelationBuilder>) {
    // Validate entity name
    if (!name || !/^[a-z][a-zA-Z0-9]*$/.test(name)) {
      throw new Error(
        `Invalid entity name: "${name}". Must start with lowercase letter and contain only alphanumeric characters.`
      )
    }

    this._name = name
    this._fields = buildFields(fields)
  }

  /**
   * Set authorization rules for operations
   *
   * @example
   * entity("post", { ... }).rules({
   *   create: ["authenticated"],
   *   read: ["everyone"],
   *   update: ["owner"],
   *   delete: ["owner", "admin"],
   * })
   */
  rules(config: Partial<Record<Operation, RuleDef[]>>): EntityBuilder {
    this._rules = { ...this._rules, ...config }
    return this
  }

  /**
   * Shorthand for owned resources
   * Sets owner field and default rules:
   * - create: ["authenticated"]
   * - read: ["everyone"]
   * - update: ["owner"]
   * - delete: ["owner"]
   * - list: ["everyone"]
   *
   * @example
   * entity("post", { author: belongsTo(user) }).ownedBy("author")
   */
  ownedBy(relationField: string): EntityBuilder {
    const field = this._fields[relationField]

    if (!field?.relation) {
      throw new Error(
        `Field "${relationField}" is not a relation. ownedBy requires a belongsTo relation.`
      )
    }

    this._ownerField = field.relation.foreignKey

    // Set default rules (can be overridden with .rules())
    this._rules = {
      create: ["authenticated"],
      read: ["everyone"],
      update: ["owner"],
      delete: ["owner"],
      list: ["everyone"],
      ...this._rules,
    }

    return this
  }

  /**
   * Disable automatic timestamps (createdAt, updatedAt)
   */
  noTimestamps(): EntityBuilder {
    this._timestamps = false
    return this
  }

  /**
   * Build the entity definition
   */
  build(): Entity {
    return {
      name: this._name,
      config: {
        fields: this._fields,
        rules: this._rules,
        ownerField: this._ownerField,
        timestamps: this._timestamps,
      },
    }
  }
}

// -----------------------------------------------------------------------------
// Entity Factory
// -----------------------------------------------------------------------------

/**
 * Create an entity definition
 *
 * @example
 * const post = entity("post", {
 *   title: string.min(1).max(200),
 *   body: text,
 *   published: bool.default(false),
 *   author: belongsTo(user),
 * }).ownedBy("author")
 */
export function entity(
  name: string,
  fields: Record<string, FieldBuilder | RelationBuilder>
): EntityBuilder {
  return new EntityBuilder(name, fields)
}

// -----------------------------------------------------------------------------
// Helper: Resolve Entity (handle lazy loading)
// -----------------------------------------------------------------------------

export function resolveEntity(entityOrBuilder: Entity | EntityBuilder | undefined): Entity {
  if (!entityOrBuilder) {
    throw new Error("[Zapi] Cannot resolve undefined entity. Make sure all entity references are properly defined.")
  }
  if ("build" in entityOrBuilder && typeof entityOrBuilder.build === "function") {
    return entityOrBuilder.build()
  }
  return entityOrBuilder as Entity
}
