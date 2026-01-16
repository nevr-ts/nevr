// =============================================================================
// ENTITY DSL
// Usage: entity("post", { title: string }).ownedBy("author").actions({...})
//
// Entity-First Architecture:
// - Entity is the source of truth for schema, API, and client types
// - Actions define custom operations and workflows on entities
// - Workflows support saga pattern with compensation
// =============================================================================

import type { Entity, EntityConfig, Operation, RuleDef, FieldDef, EntityAction, EntityActionContext, EntityWorkflowStep, EntityValidator, EntityValidatorFn, EntityOperation, OperationContext, ActionReturnConfig } from "./types.js"
import type { ActionDefinition, ActionMethod } from "./plugins/core/actions.js"
import { buildFields, FieldBuilder, RelationBuilder, SelfRefBuilder } from "./fields.js"

// -----------------------------------------------------------------------------
// Action Builder Types
// -----------------------------------------------------------------------------

/**
 * Action definition for fluent API
 */
export interface ActionDef<TInput = any, TOutput = any> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path?: string
  requiresId?: boolean
  rules?: RuleDef[]
  input?: Record<string, FieldBuilder<any, any>>
  handler?: (ctx: EntityActionContext<TInput>) => Promise<TOutput>
  workflow?: {
    useTransaction?: boolean
    steps: EntityWorkflowStep<any>[]
  }
  metadata?: {
    summary?: string
    description?: string
    tags?: string[]
  }
}

/**
 * Action builder for fluent action definition
 * Supports both simple handlers and multi-entity operations
 */
export class ActionBuilder<TInput = any, TOutput = any> {
  private _def: ActionDef<TInput, TOutput> = {
    method: "POST",
    requiresId: false,
  }
  private _operations: EntityOperation<TInput>[] = []
  private _returns?: ActionReturnConfig

  constructor(name: string) {
    this._def.path = name
  }

  /** Set HTTP method */
  method(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"): this {
    this._def.method = method
    return this
  }

  /** GET method shorthand */
  get(): this {
    this._def.method = "GET"
    return this
  }

  /** POST method shorthand */
  post(): this {
    this._def.method = "POST"
    return this
  }

  /** Require resource ID (action on specific resource) */
  onResource(): this {
    this._def.requiresId = true
    return this
  }

  /** Set authorization rules */
  rules(...rules: RuleDef[]): this {
    this._def.rules = rules
    return this
  }

  /** Define input schema */
  input(schema: Record<string, FieldBuilder<any, any>>): this {
    this._def.input = schema
    return this
  }

  /** Set action handler */
  handler<T = TOutput>(fn: (ctx: EntityActionContext<TInput>) => Promise<T>): ActionBuilder<TInput, T> {
    this._def.handler = fn as any
    return this as any
  }

  /** Define as workflow with steps */
  workflow(steps: EntityWorkflowStep<any>[], options?: { useTransaction?: boolean }): this {
    this._def.workflow = {
      useTransaction: options?.useTransaction ?? false,
      steps,
    }
    return this
  }

  /** Add metadata */
  meta(metadata: { summary?: string; description?: string; tags?: string[] }): this {
    this._def.metadata = metadata
    return this
  }

  // ===========================================================================
  // Multi-Entity Operations (Zero API Pattern)
  // ===========================================================================

  /**
   * Create a record in an entity
   * If no data function provided, auto-maps from input to entity fields
   *
   * @example
   * ```typescript
   * // Auto-map: input fields matching entity fields are used
   * .creates("user")
   *
   * // Custom mapping: access previous results
   * .creates("session", ctx => ({
   *   userId: ctx.results.user.id,
   *   token: generateToken(),
   * }))
   * ```
   */
  creates(
    entity: string,
    data?: (ctx: OperationContext<TInput>) => Record<string, unknown> | Promise<Record<string, unknown>>
  ): this {
    this._operations.push({
      entity,
      operation: "create",
      data: data || "auto",
    })
    return this
  }

  /**
   * Update a record in an entity
   *
   * @example
   * ```typescript
   * // Update current resource (uses resourceId)
   * .updates("user", ctx => ({ verified: true }))
   *
   * // Update with custom where clause
   * .updates("order", ctx => ({ status: "paid" }), ctx => ({ id: ctx.input.orderId }))
   * ```
   */
  updates(
    entity: string,
    data: (ctx: OperationContext<TInput>) => Record<string, unknown> | Promise<Record<string, unknown>>,
    where?: (ctx: OperationContext<TInput>) => Record<string, unknown> | Promise<Record<string, unknown>>
  ): this {
    this._operations.push({
      entity,
      operation: "update",
      data,
      where: where || (ctx => ({ id: ctx.resourceId })),
    })
    return this
  }

  /**
   * Delete a record in an entity
   *
   * @example
   * ```typescript
   * // Delete current resource
   * .deletes("session")
   *
   * // Delete with custom where clause
   * .deletes("session", ctx => ({ userId: ctx.resourceId }))
   * ```
   */
  deletes(
    entity: string,
    where?: (ctx: OperationContext<TInput>) => Record<string, unknown> | Promise<Record<string, unknown>>
  ): this {
    this._operations.push({
      entity,
      operation: "delete",
      where: where || (ctx => ({ id: ctx.resourceId })),
    })
    return this
  }

  /**
   * Configure what to return from the action
   *
   * @example
   * ```typescript
   * // Return user without password
   * .returns("user", { omit: ["password"] })
   *
   * // Return specific fields
   * .returns("user", { pick: ["id", "email", "name"] })
   * ```
   */
  returns(entity: string, options?: { pick?: string[]; omit?: string[] }): this {
    this._returns = { entity, ...options }
    return this
  }

  /** Build the action definition */
  _build(name: string): EntityAction<TInput, TOutput> {
    const inputFields: Record<string, FieldDef> = {}
    if (this._def.input) {
      for (const [key, builder] of Object.entries(this._def.input)) {
        inputFields[key] = builder._build()
      }
    }

    return {
      name,
      method: this._def.method || "POST",
      path: this._def.path,
      requiresId: this._def.requiresId,
      rules: this._def.rules,
      input: Object.keys(inputFields).length > 0 ? inputFields : undefined,
      handler: this._def.handler,
      workflow: this._def.workflow,
      operations: this._operations.length > 0 ? this._operations : undefined,
      returns: this._returns,
      metadata: this._def.metadata,
    }
  }
}

/**
 * Create an action definition
 */
export function action<TInput = any, TOutput = any>(name?: string): ActionBuilder<TInput, TOutput> {
  return new ActionBuilder<TInput, TOutput>(name || "")
}

/**
 * Create a workflow step
 */
export function step<TResult = any>(
  name: string,
  execute: EntityWorkflowStep<TResult>["execute"],
  compensate?: EntityWorkflowStep<TResult>["compensate"]
): EntityWorkflowStep<TResult> {
  return { name, execute, compensate }
}

// -----------------------------------------------------------------------------
// Entity Builder (Generic for E2E Type Safety)
// -----------------------------------------------------------------------------

/**
 * Generic EntityBuilder that preserves type information through method chaining
 * TName: String literal type for entity name
 * TFields: Record of field definitions for type inference
 */
export class EntityBuilder<
  TName extends string = string,
  TFields extends Record<string, FieldDef> = Record<string, FieldDef>
> {
  /** Entity name as readonly for type inference */
  readonly name: TName
  /** Fields as readonly for type inference */
  readonly config: {
    readonly fields: TFields
    rules: Partial<Record<Operation, RuleDef[]>>
    ownerField?: string
    timestamps: boolean | { createdAt?: string; updatedAt?: string }
    actions?: Record<string, EntityAction>
    namespace?: string
    validators?: EntityValidator[]
  }

  private _rules: Partial<Record<Operation, RuleDef[]>> = {}
  private _ownerField?: string
  private _timestamps: boolean | { createdAt?: string; updatedAt?: string } = true
  private _actions: Record<string, EntityAction> = {}
  private _namespace?: string
  private _validators: EntityValidator[] = []
  private _instruction?: string

  constructor(name: TName, fields: TFields) {
    // Validate entity name
    if (!name || !/^[a-z][a-zA-Z0-9]*$/.test(name)) {
      throw new Error(
        `Invalid entity name: "${name}". Must start with lowercase letter and contain only alphanumeric characters.`
      )
    }

    this.name = name
    this.config = {
      fields,
      rules: this._rules,
      timestamps: this._timestamps,
    }
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
  rules(config: Partial<Record<Operation, RuleDef[]>>): this {
    this._rules = { ...this._rules, ...config }
    this.config.rules = this._rules
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
  ownedBy(relationField: string): this {
    const field = this.config.fields[relationField]

    if (!field?.relation) {
      throw new Error(
        `Field "${relationField}" is not a relation. ownedBy requires a belongsTo relation.`
      )
    }

    this._ownerField = field.relation.foreignKey
    this.config.ownerField = this._ownerField

    // Set default rules (can be overridden with .rules())
    this._rules = {
      create: ["authenticated"],
      read: ["everyone"],
      update: ["owner"],
      delete: ["owner"],
      list: ["everyone"],
      ...this._rules,
    }
    this.config.rules = this._rules

    return this
  }

  /**
   * Configure timestamps
   * Pass `false` to disable.
   * Pass object to customize field names.
   */
  timestamps(config: boolean | { createdAt?: string; updatedAt?: string }): this {
    this._timestamps = config
    this.config.timestamps = config
    return this
  }

  /**
   * Disable automatic timestamps (createdAt, updatedAt)
   * @deprecated Use .timestamps(false) instead
   */
  noTimestamps(): this {
    return this.timestamps(false)
  }

  /**
   * Set namespace for schema splitting (for large codebases with 100+ entities)
   * Entities with the same namespace are grouped into separate schema files
   *
   * @example
   * entity("user", { ... }).namespace("auth")
   * entity("session", { ... }).namespace("auth")
   * entity("product", { ... }).namespace("catalog")
   * entity("order", { ... }).namespace("orders")
   */
  namespace(ns: string): this {
    this._namespace = ns
    this.config.namespace = ns
    return this
  }

  /**
   * Add AI instruction for context generation
   * Notes for AI agents about how to handle this entity
   * @example entity("order", {...}).instruction("Core business entity - handle with care")
   * @example entity("user", {...}).instruction("Contains PII, always verify permissions")
   */
  instruction(note: string): this {
    this._instruction = note
    return this
  }

  /**
   * Define entity actions (custom operations and workflows)
   *
   * @example
   * // Simple action
   * entity("user", { ... }).actions({
   *   verify: action()
   *     .onResource()
   *     .rules("authenticated")
   *     .handler(async (ctx) => {
   *       await ctx.driver.update("user", { id: ctx.resourceId }, { verified: true })
   *       return { success: true }
   *     })
   * })
   *
   * @example
   * // Workflow with compensation
   * entity("order", { ... }).actions({
   *   checkout: action()
   *     .input({ paymentMethod: string })
   *     .workflow([
   *       step("reserve-inventory", async (ctx) => {
   *         return await ctx.resolve("inventory").reserve(ctx.input)
   *       }, async (ctx, result) => {
   *         await ctx.resolve("inventory").release(result)
   *       }),
   *       step("charge-payment", async (ctx) => {
   *         return await ctx.resolve("payments").charge(ctx.input)
   *       }, async (ctx, result) => {
   *         await ctx.resolve("payments").refund(result)
   *       }),
   *     ], { useTransaction: true })
   * })
   */
  actions(actions: Record<string, ActionBuilder | ActionDefinition>): this {
    for (const [name, builderOrDef] of Object.entries(actions)) {
      if (builderOrDef instanceof ActionBuilder) {
        this._actions[name] = builderOrDef._build(name)
      } else {
        // Adapt ActionDefinition (internal) to EntityAction (public)
        const def = builderOrDef
        const rules: RuleDef[] = []

        if (def.requireAuth) {
          rules.push("authenticated")
        }
        if (def.roles && def.roles.length > 0) {
          // Assuming 'roles' maps to role-based rules if system supports it
          // For now, mapping to generic rule strings
          rules.push(...def.roles as any)
        }

        this._actions[name] = {
          name,
          method: (def.method as any) || "POST",
          path: def.path,
          // Infer requiresId from path if it contains :id
          requiresId: def.path?.includes(":id") || false,
          rules: rules.length > 0 ? rules : undefined,
          handler: def.handler as any,
          validateFn: def.validate,
          metadata: {
            description: def.description
          }
        }
      }
    }
    this.config.actions = Object.keys(this._actions).length > 0 ? this._actions : undefined
    return this
  }

  /**
   * Add a single action
   */
  action(name: string, builderOrDef: ActionBuilder | ActionDefinition): this {
    return this.actions({ [name]: builderOrDef })
  }

  /**
   * Add cross-field validation
   * Validates relationships between multiple fields
   *
   * @example
   * // Simple validation
   * entity("event", { startDate: datetime, endDate: datetime })
   *   .validate((data) => data.startDate < data.endDate, "Start date must be before end date")
   *
   * @example
   * // With options
   * entity("user", { password: string, confirmPassword: string })
   *   .validate(
   *     (data) => data.password === data.confirmPassword,
   *     "Passwords must match",
   *     { operations: ["create"], fields: ["password", "confirmPassword"] }
   *   )
   *
   * @example
   * // Multiple validators
   * entity("order", { quantity: int, maxQuantity: int, price: float })
   *   .validate((d) => d.quantity > 0, "Quantity must be positive")
   *   .validate((d) => d.quantity <= d.maxQuantity, "Quantity exceeds maximum")
   *   .validate((d) => d.price >= 0, "Price cannot be negative")
   */
  validate(
    fn: EntityValidatorFn,
    message: string,
    options?: {
      operations?: ("create" | "update")[]
      fields?: string[]
    }
  ): this {
    this._validators.push({
      fn,
      message,
      operations: options?.operations,
      fields: options?.fields,
    })
    this.config.validators = this._validators.length > 0 ? this._validators : undefined
    return this
  }

  /**
   * Build the entity definition
   * Returns a typed Entity that preserves field type information for E2E type inference
   */
  build(): Entity<TName, TFields> {
    return {
      name: this.name,
      config: {
        fields: this.config.fields,
        rules: this._rules,
        ownerField: this._ownerField,
        timestamps: this._timestamps,
        actions: Object.keys(this._actions).length > 0 ? this._actions : undefined,
        namespace: this._namespace,
        validators: this._validators.length > 0 ? this._validators : undefined,
        instruction: this._instruction,
      },
    }
  }
}

// -----------------------------------------------------------------------------
// Entity Factory
// -----------------------------------------------------------------------------

/**
 * Create an entity definition with full type inference
 *
 * @example
 * const post = entity("post", {
 *   title: string.min(1).max(200),
 *   body: text,
 *   published: bool.default(false),
 *   author: belongsTo(user),
 * }).ownedBy("author")
 *
 * // Type inference works!
 * type Post = typeof post["config"]["fields"]
 * // { title: FieldDef<"string", false>, body: FieldDef<"text", false>, ... }
 *
 * @example
 * // Self-referencing entities (e.g., category with parent)
 * const category = entity("category", {
 *   name: string,
 *   parent: selfRef().optional(), // Auto-references the current entity!
 * })
 */
export function entity<
  TName extends string,
  TFieldInput extends Record<string, FieldBuilder<any, any, any> | RelationBuilder | SelfRefBuilder>
>(
  name: TName,
  fields: TFieldInput
): EntityBuilder<TName, { [K in keyof TFieldInput]: InferFieldDef<TFieldInput[K]> }> {
  // Create a lazy reference to the entity for self-referencing fields
  let entityBuilderRef: EntityBuilder<TName, any> | undefined

  // Build fields with self-reference support
  const builtFields = buildFields(fields, () => {
    if (!entityBuilderRef) {
      throw new Error(`[Nevr] Self-reference accessed before entity was created`)
    }
    return entityBuilderRef
  }) as { [K in keyof TFieldInput]: InferFieldDef<TFieldInput[K]> }

  entityBuilderRef = new EntityBuilder(name, builtFields)
  return entityBuilderRef
}

/**
 * FieldDef with relation marker for type inference
 * This allows InferCreateInput to detect relations and use foreignKey
 */
type RelationFieldDef<TOptional extends boolean = false> = FieldDef<"string", TOptional, false> & {
  relation: import("./types.js").RelationDef
}

/**
 * Infer FieldDef type from FieldBuilder, RelationBuilder, or SelfRefBuilder
 * Relations are marked with a `relation` property so InferCreateInput can detect them
 */
type InferFieldDef<T> =
  T extends FieldBuilder<infer TType, infer TOptional, infer THasDefault>
  ? FieldDef<TType, TOptional, THasDefault>
  : T extends RelationBuilder
  ? RelationFieldDef<false>  // belongsTo relations are required by default
  : T extends SelfRefBuilder
  ? RelationFieldDef<true>  // self-refs are optional by default
  : FieldDef

// -----------------------------------------------------------------------------
// Helper: Resolve Entity (handle lazy loading)
// -----------------------------------------------------------------------------

export function resolveEntity(entityOrBuilder: Entity | EntityBuilder<any, any> | undefined): Entity {
  if (!entityOrBuilder) {
    throw new Error("[Nevr] Cannot resolve undefined entity. Make sure all entity references are properly defined.")
  }
  if ("build" in entityOrBuilder && typeof entityOrBuilder.build === "function") {
    return entityOrBuilder.build()
  }
  return entityOrBuilder as Entity
}
