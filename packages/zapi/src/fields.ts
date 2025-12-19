// =============================================================================
// FIELD TYPES DSL
// Usage: string, string.optional(), text, int, bool, email, etc.
// =============================================================================

import type { FieldDef, FieldType, RelationDef, Entity } from "./types.js"
import type { EntityBuilder } from "./entity.js"
import { resolveEntity } from "./entity.js"

// -----------------------------------------------------------------------------
// Field Builder
// -----------------------------------------------------------------------------

export class FieldBuilder {
  private _type: FieldType
  private _optional: boolean = false
  private _unique: boolean = false
  private _default?: unknown
  private _min?: number
  private _max?: number
  private _isEmail: boolean = false
  private _relation?: RelationDef

  constructor(type: FieldType) {
    this._type = type
  }

  /** Mark field as optional (nullable) */
  optional(): FieldBuilder {
    const clone = this._clone()
    clone._optional = true
    return clone
  }

  /** Add unique constraint */
  unique(): FieldBuilder {
    const clone = this._clone()
    clone._unique = true
    return clone
  }

  /** Set default value */
  default(value: unknown): FieldBuilder {
    const clone = this._clone()
    clone._default = value
    return clone
  }

  /** Minimum length (string) or value (number) */
  min(value: number): FieldBuilder {
    const clone = this._clone()
    clone._min = value
    return clone
  }

  /** Maximum length (string) or value (number) */
  max(value: number): FieldBuilder {
    const clone = this._clone()
    clone._max = value
    return clone
  }

  private _clone(): FieldBuilder {
    const clone = new FieldBuilder(this._type)
    clone._optional = this._optional
    clone._unique = this._unique
    clone._default = this._default
    clone._min = this._min
    clone._max = this._max
    clone._isEmail = this._isEmail
    clone._relation = this._relation
    return clone
  }

  /** @internal Build the field definition */
  _build(): FieldDef {
    return {
      type: this._type,
      optional: this._optional,
      unique: this._unique,
      default: this._default,
      min: this._min,
      max: this._max,
      isEmail: this._isEmail,
      relation: this._relation,
    }
  }

  /** @internal Mark as email for validation */
  _setEmail(): FieldBuilder {
    const clone = this._clone()
    clone._isEmail = true
    return clone
  }
}

// -----------------------------------------------------------------------------
// Relation Builder
// -----------------------------------------------------------------------------

export class RelationBuilder {
  private _entityFn: () => Entity | EntityBuilder
  private _type: "belongsTo" | "hasMany" | "hasOne"
  private _foreignKey?: string
  private _onDelete?: "cascade" | "setNull" | "restrict"
  private _optional: boolean = false

  constructor(type: "belongsTo" | "hasMany" | "hasOne", entityFn: () => Entity | EntityBuilder) {
    this._type = type
    this._entityFn = entityFn
  }

  /** Custom foreign key name */
  foreignKey(key: string): RelationBuilder {
    const clone = this._clone()
    clone._foreignKey = key
    return clone
  }

  /** Delete behavior */
  onDelete(action: "cascade" | "setNull" | "restrict"): RelationBuilder {
    const clone = this._clone()
    clone._onDelete = action
    return clone
  }

  /** Mark relation as optional */
  optional(): RelationBuilder {
    const clone = this._clone()
    clone._optional = true
    return clone
  }

  private _clone(): RelationBuilder {
    const clone = new RelationBuilder(this._type, this._entityFn)
    clone._foreignKey = this._foreignKey
    clone._onDelete = this._onDelete
    clone._optional = this._optional
    return clone
  }

  /** @internal Build the field definition */
  _build(fieldName: string): FieldDef {
    const foreignKey = this._foreignKey || `${fieldName}Id`

    // Wrap entity function to resolve EntityBuilder to Entity
    const resolvedEntityFn = () => {
      const entityOrBuilder = this._entityFn()
      return resolveEntity(entityOrBuilder)
    }

    return {
      type: "string",
      optional: this._optional || this._type !== "belongsTo",
      unique: this._type === "hasOne",
      relation: {
        type: this._type,
        entity: resolvedEntityFn,
        foreignKey,
        references: "id",
        onDelete: this._onDelete,
      },
    }
  }
}

// -----------------------------------------------------------------------------
// Field Type Factories
// -----------------------------------------------------------------------------

/** Short string field */
export const string = new FieldBuilder("string")

/** Long text field */
export const text = new FieldBuilder("text")

/** Integer field */
export const int = new FieldBuilder("int")

/** Decimal/float field */
export const float = new FieldBuilder("float")

/** Boolean field */
export const bool = new FieldBuilder("boolean")

/** Alias for bool */
export const boolean = new FieldBuilder("boolean")

/** DateTime field */
export const datetime = new FieldBuilder("datetime")

/** JSON field */
export const json = new FieldBuilder("json")

/** Email field (string with email validation) */
export const email = new FieldBuilder("string")._setEmail()

// -----------------------------------------------------------------------------
// Relation Factories
// -----------------------------------------------------------------------------

/** Many-to-one relation */
export function belongsTo(entity: Entity | EntityBuilder | (() => Entity) | (() => EntityBuilder)): RelationBuilder {
  const entityFn = typeof entity === "function" ? entity : () => entity
  return new RelationBuilder("belongsTo", entityFn)
}

/** One-to-many relation */
export function hasMany(entity: Entity | EntityBuilder | (() => Entity) | (() => EntityBuilder)): RelationBuilder {
  const entityFn = typeof entity === "function" ? entity : () => entity
  return new RelationBuilder("hasMany", entityFn)
}

/** One-to-one relation */
export function hasOne(entity: Entity | EntityBuilder | (() => Entity) | (() => EntityBuilder)): RelationBuilder {
  const entityFn = typeof entity === "function" ? entity : () => entity
  return new RelationBuilder("hasOne", entityFn)
}

// -----------------------------------------------------------------------------
// Build Fields Helper
// -----------------------------------------------------------------------------

export function buildFields(
  fields: Record<string, FieldBuilder | RelationBuilder>
): Record<string, FieldDef> {
  const result: Record<string, FieldDef> = {}

  for (const [name, builder] of Object.entries(fields)) {
    if (builder instanceof FieldBuilder) {
      result[name] = builder._build()
    } else if (builder instanceof RelationBuilder) {
      result[name] = builder._build(name)
    }
  }

  return result
}
