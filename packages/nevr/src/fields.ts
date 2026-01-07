// =============================================================================
// FIELD TYPES DSL
// Usage: string, string.optional(), text, int, bool, email, etc.
// =============================================================================

import type { FieldDef, FieldType, RelationDef, Entity, FieldAccessPolicy } from "./types.js"
import type { EntityBuilder } from "./entity.js"
import { resolveEntity } from "./entity.js"

// -----------------------------------------------------------------------------
// Validation Types
// -----------------------------------------------------------------------------

interface ValidationConfig {
  email?: { message?: string }
  url?: { message?: string }
  regex?: { pattern: RegExp; message?: string }
  startsWith?: { value: string; message?: string }
  endsWith?: { value: string; message?: string }
  contains?: { value: string; message?: string }
  datetime?: { message?: string }
  min?: { value: number; message?: string }
  max?: { value: number; message?: string }
  gt?: { value: number; message?: string }
  gte?: { value: number; message?: string }
  lt?: { value: number; message?: string }
  lte?: { value: number; message?: string }
  custom?: { fn: (value: unknown) => boolean; message?: string }
  /** Escape hatch: Zod schema */
  zodSchema?: any
}

interface TransformConfig {
  trim?: boolean
  lower?: boolean
  upper?: boolean
}

interface SecurityConfig {
  password?: { cost?: number }
  omit?: boolean
  encrypted?: boolean
}

interface AccessConfig {
  read?: FieldAccessPolicy
  write?: FieldAccessPolicy
}

// -----------------------------------------------------------------------------
// Field Builder
// -----------------------------------------------------------------------------

export class FieldBuilder<
  TType extends FieldType = FieldType,
  TOptional extends boolean = false,
  THasDefault extends boolean = false
> {
  protected _type: TType
  protected _optional: TOptional = false as TOptional
  protected _hasDefault: THasDefault = false as THasDefault
  protected _unique: boolean = false
  protected _default?: unknown
  protected _min?: number
  protected _max?: number
  protected _isEmail: boolean = false
  protected _relation?: RelationDef
  protected _validation: ValidationConfig = {}
  protected _transforms: TransformConfig = {}
  protected _security: SecurityConfig = {}
  protected _access: AccessConfig = {}
  // Rich Metadata
  protected _meta: { label?: string; description?: string; placeholder?: string; example?: unknown; icon?: string } = {}
  protected _options?: string[]
  protected _ui: { component?: string; hidden?: boolean | ("list" | "detail" | "form" | "create" | "edit")[]; readonly?: boolean; order?: number; width?: string | number; group?: string } = {}
  protected _semantic: { searchable?: boolean; embedding?: { provider?: string; model?: string; dimensions?: number }; sensitive?: boolean } = {}

  constructor(type: TType) {
    this._type = type
  }

  // ===========================================================================
  // Base Field Modifiers
  // ===========================================================================

  /** Mark field as optional (nullable) */
  optional(): FieldBuilder<TType, true, THasDefault> {
    const clone = this._clone() as unknown as FieldBuilder<TType, true, THasDefault>
      ; (clone as any)._optional = true
    return clone
  }

  /** Add unique constraint */
  unique(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._unique = true
    return clone
  }

  /** Set default value - makes field optional in create input */
  default(value: unknown): FieldBuilder<TType, TOptional, true> {
    const clone = this._clone() as unknown as FieldBuilder<TType, TOptional, true>
      ; (clone as any)._hasDefault = true
    clone._default = value
    return clone
  }

  // ===========================================================================
  // Validation Attributes
  // ===========================================================================

  /**
   * Validate as email format
   * @example string.email("Invalid email format")
   */
  email(message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.email = { message }
    clone._isEmail = true
    return clone
  }

  /**
   * Validate as URL format
   * @example string.url("Invalid URL")
   */
  url(message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.url = { message }
    return clone
  }

  /**
   * Validate against regex pattern
   * @example string.regex(/^[a-z0-9_]+$/, "Only lowercase alphanumeric and underscore")
   */
  regex(pattern: RegExp, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.regex = { pattern, message }
    return clone
  }

  /**
   * Validate string starts with value
   * @example string.startsWith("@", "Must start with @")
   */
  startsWith(value: string, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.startsWith = { value, message }
    return clone
  }

  /**
   * Validate string ends with value
   * @example string.endsWith("@company.com", "Must be a company email")
   */
  endsWith(value: string, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.endsWith = { value, message }
    return clone
  }

  /**
   * Validate string contains value
   * @example string.contains("@", "Must contain @")
   */
  contains(value: string, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.contains = { value, message }
    return clone
  }

  /**
   * Validate as ISO datetime format
   * @example string.datetime("Invalid datetime format")
   */
  datetimeFormat(message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.datetime = { message }
    return clone
  }

  /**
   * Minimum length (string) or value (number)
   * @example string.min(3, "Must be at least 3 characters")
   * @example int.min(0, "Must be non-negative")
   */
  min(value: number, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._min = value
    clone._validation.min = { value, message }
    return clone
  }

  /**
   * Maximum length (string) or value (number)
   * @example string.max(100, "Must be at most 100 characters")
   * @example int.max(1000, "Must be at most 1000")
   */
  max(value: number, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._max = value
    clone._validation.max = { value, message }
    return clone
  }

  /**
   * Length constraint (min and max)
   * @example string.length(3, 100, "Must be between 3 and 100 characters")
   */
  length(minValue: number, maxValue: number, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._min = minValue
    clone._max = maxValue
    clone._validation.min = { value: minValue, message }
    clone._validation.max = { value: maxValue, message }
    return clone
  }

  /**
   * Greater than (numbers only)
   * @example int.gt(0, "Must be positive")
   */
  gt(value: number, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.gt = { value, message }
    return clone
  }

  /**
   * Greater than or equal (numbers only)
   * @example int.gte(0, "Must be non-negative")
   */
  gte(value: number, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.gte = { value, message }
    return clone
  }

  /**
   * Less than (numbers only)
   * @example int.lt(100, "Must be less than 100")
   */
  lt(value: number, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.lt = { value, message }
    return clone
  }

  /**
   * Less than or equal (numbers only)
   * @example int.lte(100, "Must be at most 100")
   */
  lte(value: number, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.lte = { value, message }
    return clone
  }

  /**
   * Validate using a Zod schema
   * @example
   * string.zod(z.string().email())
   */
  zod(schema: any): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.zodSchema = schema
    return clone
  }

  /**
   * Custom validation function
   * @example string.validate((v) => v.includes("@"), "Must contain @")
   */
  validate(fn: (value: unknown) => boolean, message?: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._validation.custom = { fn, message }
    return clone
  }

  // ===========================================================================
  // Transform Attributes
  // ===========================================================================

  /**
   * Trim whitespace from start and end
   * @example string.trim()
   */
  trim(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._transforms.trim = true
    return clone
  }

  /**
   * Convert to lowercase
   * @example string.lower()
   */
  lower(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._transforms.lower = true
    return clone
  }

  /**
   * Convert to uppercase
   * @example string.upper()
   */
  upper(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._transforms.upper = true
    return clone
  }

  // ===========================================================================
  // Security Attributes
  // ===========================================================================

  /**
   * Hash password before storing (scrypt)
   * Automatically hashes the value on create/update
   * 
   * @param options.cost - Cost factor (1-4). Higher = more secure but slower.
   *   - 1: N=16384 (fast, ~200ms) - development
   *   - 2: N=32768 (default, ~400ms) - production
   *   - 3: N=65536 (~800ms) - high security
   *   - 4: N=131072 (~1.6s) - maximum security
   * 
   * @example string.password() // default cost 2
   * @example string.password({ cost: 1 }) // fast, for development
   * @example string.password({ cost: 3 }) // high security
   */
  password(options?: { cost?: number }): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._security.password = { cost: options?.cost ?? 2 }
    return clone
  }

  /**
   * Omit field from API responses
   * Field is never returned in read operations
   * @example string.password().omit() // hash password and hide from responses
   */
  omit(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._security.omit = true
    return clone
  }

  /**
   * Encrypt field value at rest
   * Uses AES-256-GCM encryption
   * @example string.encrypted()
   */
  encrypted(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._security.encrypted = true
    return clone
  }

  // ===========================================================================
  // Field-Level Access Policies
  // ===========================================================================

  /**
   * Set read access policy for this field
   * Controls who can see this field in responses
   * @example string.readable("authenticated") - only authenticated users
   * @example string.readable("admin") - only admins
   * @example string.readable("none") - never readable via API
   * @example string.readable((ctx) => ctx.user?.role === "admin")
   */
  readable(policy: FieldAccessPolicy): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._access.read = policy
    return clone
  }

  /**
   * Set write access policy for this field
   * Controls who can modify this field
   * @example string.writable("owner") - only owner can write
   * @example string.writable("admin") - only admins can write
   * @example string.writable("none") - read-only field
   * @example string.writable((ctx) => ctx.user?.role === "admin")
   */
  writable(policy: FieldAccessPolicy): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._access.write = policy
    return clone
  }

  /**
   * Make field read-only (writable by none)
   * Shorthand for .writable("none")
   * @example string.readOnly()
   */
  readOnly(): FieldBuilder<TType, TOptional, THasDefault> {
    return this.writable("none")
  }

  /**
   * Make field admin-only (readable and writable by admin)
   * Shorthand for .readable("admin").writable("admin")
   * @example string.adminOnly()
   */
  adminOnly(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._access.read = "admin"
    clone._access.write = "admin"
    return clone
  }

  /**
   * Make field owner-only (readable by everyone, writable by owner)
   * @example string.ownerWritable()
   */
  ownerWritable(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._access.write = "owner"
    return clone
  }

  // ===========================================================================
  // Rich Metadata Methods (OpenAPI, Admin UI, AI)
  // ===========================================================================

  /**
   * Set human-readable label for forms, tables, and API docs
   * @example string.label("Email Address")
   */
  label(value: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._meta.label = value
    return clone
  }

  /**
   * Set detailed description for tooltips and API documentation
   * @example string.description("Primary email used for notifications")
   */
  description(value: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._meta.description = value
    return clone
  }

  /**
   * Set placeholder text for form inputs
   * @example string.placeholder("Enter your email...")
   */
  placeholder(value: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._meta.placeholder = value
    return clone
  }

  /**
   * Set example value for API documentation (OpenAPI)
   * @example string.example("user@example.com")
   */
  example(value: unknown): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._meta.example = value
    return clone
  }

  /**
   * Set icon for Admin UI display
   * @example string.icon("📧")
   */
  icon(value: string): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._meta.icon = value
    return clone
  }

  /**
   * Define allowed values (creates enum in OpenAPI and TypeScript)
   * @example string.options(["pending", "active", "closed"])
   */
  options(values: string[]): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._options = values
    return clone
  }

  /**
   * Set UI rendering hints for Admin UI generation
   * @example string.ui({ component: "RichTextEditor", hidden: ["list"] })
   */
  ui(config: { component?: string; hidden?: boolean | ("list" | "detail" | "form" | "create" | "edit")[]; readonly?: boolean; order?: number; width?: string | number; group?: string }): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._ui = { ...clone._ui, ...config }
    return clone
  }

  /**
   * Mark field as searchable (full-text search index)
   * @example string.searchable()
   */
  searchable(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._semantic.searchable = true
    return clone
  }

  /**
   * Enable vector embedding for semantic search (RAG)
   * @example text.embedding({ provider: "openai" })
   */
  embedding(config?: { provider?: "openai" | "cohere" | "huggingface" | string; model?: string; dimensions?: number }): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._semantic.embedding = config || { provider: "openai" }
    return clone
  }

  /**
   * Mark as PII/sensitive data for GDPR compliance
   * @example string.sensitive()
   */
  sensitive(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._semantic.sensitive = true
    return clone
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  protected _clone(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = new FieldBuilder<TType, TOptional, THasDefault>(this._type)
    clone._optional = this._optional
    clone._hasDefault = this._hasDefault
    clone._unique = this._unique
    clone._default = this._default
    clone._min = this._min
    clone._max = this._max
    clone._isEmail = this._isEmail
    clone._relation = this._relation
    clone._validation = { ...this._validation }
    clone._transforms = { ...this._transforms }
    clone._security = { ...this._security }
    clone._access = { ...this._access }
    // Rich Metadata
    clone._meta = { ...this._meta }
    clone._options = this._options
    clone._ui = { ...this._ui }
    clone._semantic = { ...this._semantic }
    return clone
  }

  /** @internal Build the field definition */
  _build(): FieldDef<TType, TOptional, THasDefault> {
    const hasValidation = Object.keys(this._validation).length > 0
    const hasTransforms = Object.keys(this._transforms).length > 0
    const hasSecurity = Object.keys(this._security).length > 0
    const hasAccess = Object.keys(this._access).length > 0

    return {
      type: this._type,
      optional: this._optional,
      hasDefault: this._hasDefault,
      unique: this._unique,
      default: this._default,
      min: this._min,
      max: this._max,
      isEmail: this._isEmail,
      relation: this._relation,
      validation: hasValidation ? this._validation : undefined,
      transforms: hasTransforms ? this._transforms : undefined,
      security: hasSecurity ? this._security : undefined,
      access: hasAccess ? this._access : undefined,
      // Rich Metadata
      meta: Object.keys(this._meta).length > 0 ? this._meta : undefined,
      options: this._options,
      ui: Object.keys(this._ui).length > 0 ? this._ui : undefined,
      semantic: Object.keys(this._semantic).length > 0 ? this._semantic : undefined,
    }
  }

  /** @internal Mark as email for validation (legacy) */
  _setEmail(): FieldBuilder<TType, TOptional, THasDefault> {
    const clone = this._clone()
    clone._isEmail = true
    clone._validation.email = {}
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
  private _references?: string
  private _onDelete?: "cascade" | "setNull" | "restrict"
  private _optional: boolean = false
  private _remote: boolean = false
  private _remoteService?: string

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

  /**
   * Mark as remote relation - joined at API level instead of database level
   * This enables true domain isolation for plugins (e.g., Stripe, Auth)
   *
   * @example
   * ```typescript
   * export const post = entity("post", {
   *   title: string,
   *   // Linked in-memory via the API layer, not the DB
   *   subscription: belongsTo(() => stripeSubscription, { remote: true })
   * })
   * ```
   */
  remote(serviceId?: string): RelationBuilder {
    const clone = this._clone()
    clone._remote = true
    clone._remoteService = serviceId
    return clone
  }

  /**
   * Specify which field on the remote entity to match against
   * Defaults to "id" if not specified
   *
   * @example
   * ```typescript
   * subscription: belongsTo(() => Subscription)
   *   .remote("stripeService")
   *   .foreignKey("stripeCustomerId")
   *   .references("customerId")  // Match against customerId on remote entity
   * ```
   */
  references(field: string): RelationBuilder {
    const clone = this._clone()
    clone._references = field
    return clone
  }

  private _clone(): RelationBuilder {
    const clone = new RelationBuilder(this._type, this._entityFn)
    clone._foreignKey = this._foreignKey
    clone._references = this._references
    clone._onDelete = this._onDelete
    clone._optional = this._optional
    clone._remote = this._remote
    clone._remoteService = this._remoteService
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
      hasDefault: false,
      relation: {
        type: this._type,
        entity: resolvedEntityFn,
        foreignKey,
        references: this._references || "id",
        onDelete: this._onDelete,
        remote: this._remote,
        remoteService: this._remoteService,
      },
    }
  }
}

// -----------------------------------------------------------------------------
// Field Type Factories
// -----------------------------------------------------------------------------

/** Short string field */
export const string = new FieldBuilder<"string", false, false>("string")

/** Long text field */
export const text = new FieldBuilder<"text", false, false>("text")

/** Integer field */
export const int = new FieldBuilder<"int", false, false>("int")

/** Decimal/float field */
export const float = new FieldBuilder<"float", false, false>("float")

/** Boolean field */
export const bool = new FieldBuilder<"boolean", false, false>("boolean")

/** Alias for bool */
export const boolean = new FieldBuilder<"boolean", false, false>("boolean")

/** DateTime field */
export const datetime = new FieldBuilder<"datetime", false, false>("datetime")

/** JSON field (untyped - use jsonTyped<T>() for typed JSON) */
export const json = new FieldBuilder<"json", false, false>("json")

/**
 * Typed JSON field - preserves TypeScript type for E2E type safety
 *
 * @example
 * ```typescript
 * interface OrderItem {
 *   productId: string
 *   quantity: number
 *   price: number
 * }
 *
 * interface ShippingAddress {
 *   street: string
 *   city: string
 *   country: string
 * }
 *
 * const order = entity("order", {
 *   items: jsonTyped<OrderItem[]>(),
 *   shippingAddress: jsonTyped<ShippingAddress>().optional(),
 * })
 *
 * // Now client types are fully typed:
 * // order.items: OrderItem[]
 * // order.shippingAddress: ShippingAddress | null
 * ```
 */
export function jsonTyped<T>(): TypedFieldBuilder<T> {
  return new TypedFieldBuilder<T>("json")
}

/**
 * Typed field builder - carries type information for inference
 * Preserves TypeScript type through all chainable methods
 */
export class TypedFieldBuilder<T = unknown, TOptional extends boolean = false, THasDefault extends boolean = false> extends FieldBuilder<"json", TOptional, THasDefault> {
  /** @internal Phantom type for type inference */
  readonly _phantom!: T

  constructor(type: FieldType) {
    super(type as "json")
  }

  protected _clone(): TypedFieldBuilder<T, TOptional, THasDefault> {
    const clone = new TypedFieldBuilder<T, TOptional, THasDefault>(this._type)
      ; (clone as any)._optional = this._optional
      ; (clone as any)._hasDefault = this._hasDefault
    clone._unique = this._unique
    clone._default = this._default
    clone._min = this._min
    clone._max = this._max
    clone._isEmail = this._isEmail
    clone._relation = this._relation
    clone._validation = { ...this._validation }
    clone._transforms = { ...this._transforms }
    clone._security = { ...this._security }
    clone._access = { ...this._access }
    // Rich Metadata
    clone._meta = { ...this._meta }
    clone._options = this._options
    clone._ui = { ...this._ui }
    clone._semantic = { ...this._semantic }
    return clone
  }

  // Override all methods to return TypedFieldBuilder<T>
  optional(): TypedFieldBuilder<T, true, THasDefault> {
    const clone = this._clone() as unknown as TypedFieldBuilder<T, true, THasDefault>
      ; (clone as any)._optional = true
    return clone
  }
  unique(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.unique() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  default(value: T): TypedFieldBuilder<T, TOptional, true> {
    const result = super.default(value)
    return result as unknown as TypedFieldBuilder<T, TOptional, true>
  }
  email(message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.email(message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  url(message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.url(message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  regex(pattern: RegExp, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.regex(pattern, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  startsWith(value: string, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.startsWith(value, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  endsWith(value: string, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.endsWith(value, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  contains(value: string, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.contains(value, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  datetimeFormat(message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.datetimeFormat(message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  min(value: number, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.min(value, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  max(value: number, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.max(value, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  length(minValue: number, maxValue: number, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.length(minValue, maxValue, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  gt(value: number, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.gt(value, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  gte(value: number, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.gte(value, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  lt(value: number, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.lt(value, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  lte(value: number, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.lte(value, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  validate(fn: (value: unknown) => boolean, message?: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.validate(fn, message) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  trim(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.trim() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  lower(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.lower() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  upper(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.upper() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  password(options?: { cost?: number }): TypedFieldBuilder<T, TOptional, THasDefault> { return super.password(options) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  omit(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.omit() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  encrypted(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.encrypted() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  readable(policy: FieldAccessPolicy): TypedFieldBuilder<T, TOptional, THasDefault> { return super.readable(policy) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  writable(policy: FieldAccessPolicy): TypedFieldBuilder<T, TOptional, THasDefault> { return super.writable(policy) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  readOnly(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.readOnly() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  adminOnly(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.adminOnly() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  ownerWritable(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.ownerWritable() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  // Rich Metadata overrides
  label(value: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.label(value) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  description(value: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.description(value) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  placeholder(value: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.placeholder(value) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  example(value: unknown): TypedFieldBuilder<T, TOptional, THasDefault> { return super.example(value) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  icon(value: string): TypedFieldBuilder<T, TOptional, THasDefault> { return super.icon(value) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  options(values: string[]): TypedFieldBuilder<T, TOptional, THasDefault> { return super.options(values) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  ui(config: { component?: string; hidden?: boolean | ("list" | "detail" | "form" | "create" | "edit")[]; readonly?: boolean; order?: number; width?: string | number; group?: string }): TypedFieldBuilder<T, TOptional, THasDefault> { return super.ui(config) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  searchable(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.searchable() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  embedding(config?: { provider?: "openai" | "cohere" | "huggingface" | string; model?: string; dimensions?: number }): TypedFieldBuilder<T, TOptional, THasDefault> { return super.embedding(config) as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
  sensitive(): TypedFieldBuilder<T, TOptional, THasDefault> { return super.sensitive() as unknown as TypedFieldBuilder<T, TOptional, THasDefault> }
}

/** Email field (string with email validation) */
export const email = new FieldBuilder<"string", false, false>("string")._setEmail()

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
// Self-Reference Builder
// For self-referencing relations (e.g., category -> parent category)
// -----------------------------------------------------------------------------

/**
 * Self-reference builder that automatically references the current entity
 * Solves TypeScript circular reference issues with self-referencing relations
 */
export class SelfRefBuilder {
  private _type: "belongsTo" | "hasMany" | "hasOne"
  private _foreignKey?: string
  private _onDelete?: "cascade" | "setNull" | "restrict"
  private _optional: boolean = false
  private _entityRef?: () => Entity | EntityBuilder

  constructor(type: "belongsTo" | "hasMany" | "hasOne" = "belongsTo") {
    this._type = type
  }

  /** Custom foreign key name */
  foreignKey(key: string): SelfRefBuilder {
    const clone = this._clone()
    clone._foreignKey = key
    return clone
  }

  /** Delete behavior */
  onDelete(action: "cascade" | "setNull" | "restrict"): SelfRefBuilder {
    const clone = this._clone()
    clone._onDelete = action
    return clone
  }

  /** Mark relation as optional */
  optional(): SelfRefBuilder {
    const clone = this._clone()
    clone._optional = true
    return clone
  }

  private _clone(): SelfRefBuilder {
    const clone = new SelfRefBuilder(this._type)
    clone._foreignKey = this._foreignKey
    clone._onDelete = this._onDelete
    clone._optional = this._optional
    clone._entityRef = this._entityRef
    return clone
  }

  /** @internal Set the entity reference (called by entity builder) */
  _setEntityRef(entityRef: () => Entity | EntityBuilder): void {
    this._entityRef = entityRef
  }

  /** @internal Get the entity reference */
  _getEntityRef(): (() => Entity | EntityBuilder) | undefined {
    return this._entityRef
  }

  /** @internal Build the field definition */
  _build(fieldName: string, selfEntityRef?: () => Entity | EntityBuilder): FieldDef {
    const foreignKey = this._foreignKey || `${fieldName}Id`
    const entityRef = this._entityRef || selfEntityRef

    if (!entityRef) {
      throw new Error(
        `[Nevr] selfRef() requires an entity reference. ` +
        `Make sure to use selfRef() inside an entity() definition.`
      )
    }

    // Wrap entity function to resolve EntityBuilder to Entity
    const resolvedEntityFn = () => {
      const entityOrBuilder = entityRef()
      return resolveEntity(entityOrBuilder)
    }

    return {
      type: "string",
      optional: this._optional || this._type !== "belongsTo",
      unique: this._type === "hasOne",
      hasDefault: false,
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

/**
 * Create a self-referencing relation
 * Use this for relations where an entity references itself (e.g., parent-child)
 *
 * This solves the TypeScript circular reference issue that occurs when using:
 * `parent: belongsTo(() => category)` where `category` is defined in the same statement
 *
 * @example
 * ```typescript
 * // Instead of:
 * const category = entity("category", {
 *   parent: belongsTo(() => category).optional(), // TypeScript error: 'category' used before defined
 * })
 *
 * // Use selfRef():
 * const category = entity("category", {
 *   parent: selfRef().optional(), // Works correctly!
 * })
 *
 * // For hasMany self-reference:
 * const category = entity("category", {
 *   children: selfRef("hasMany"), // Creates hasMany self-reference
 * })
 * ```
 */
export function selfRef(type: "belongsTo" | "hasMany" | "hasOne" = "belongsTo"): SelfRefBuilder {
  return new SelfRefBuilder(type)
}

// -----------------------------------------------------------------------------
// Build Fields Helper
// -----------------------------------------------------------------------------

export function buildFields(
  fields: Record<string, FieldBuilder | RelationBuilder | SelfRefBuilder>,
  selfEntityRef?: () => Entity | EntityBuilder
): Record<string, FieldDef> {
  const result: Record<string, FieldDef> = {}

  for (const [name, builder] of Object.entries(fields)) {
    if (builder instanceof FieldBuilder) {
      result[name] = builder._build()
    } else if (builder instanceof RelationBuilder) {
      result[name] = builder._build(name)
    } else if (builder instanceof SelfRefBuilder) {
      result[name] = builder._build(name, selfEntityRef)
    }
  }

  return result
}
