// =============================================================================
// NEVR CORE TYPES
// Foundation types for the entire framework
// Framework & Database Agnostic Design
// =============================================================================

// -----------------------------------------------------------------------------
// Field Types
// -----------------------------------------------------------------------------

export type FieldType =
  | "string"
  | "text"
  | "int"
  | "float"
  | "boolean"
  | "datetime"
  | "json"

/**
 * Generic FieldDef that preserves the literal type and optional flag for type inference
 */
export interface FieldDef<
  TType extends FieldType = FieldType,
  TOptional extends boolean = boolean,
  THasDefault extends boolean = boolean
> {
  type: TType
  optional: TOptional
  unique: boolean
  /** Whether this field has a default value (for create input inference) */
  hasDefault: THasDefault
  default?: unknown
  min?: number
  max?: number
  isEmail?: boolean
  relation?: RelationDef

  // ==========================================================================
  // Validation Attributes
  // ==========================================================================

  /** String validation */
  validation?: {
    /** Email format validation */
    email?: { message?: string }
    /** URL format validation */
    url?: { message?: string }
    /** Regex pattern validation */
    regex?: { pattern: RegExp; message?: string }
    /** String starts with validation */
    startsWith?: { value: string; message?: string }
    /** String ends with validation */
    endsWith?: { value: string; message?: string }
    /** String contains validation */
    contains?: { value: string; message?: string }
    /** ISO datetime format validation */
    datetime?: { message?: string }
    /** Minimum length (string) or value (number) */
    min?: { value: number; message?: string }
    /** Maximum length (string) or value (number) */
    max?: { value: number; message?: string }
    /** Greater than (numbers only) */
    gt?: { value: number; message?: string }
    /** Greater than or equal (numbers only) */
    gte?: { value: number; message?: string }
    /** Less than (numbers only) */
    lt?: { value: number; message?: string }
    /** Less than or equal (numbers only) */
    lte?: { value: number; message?: string }
    /** Custom validation function */
    custom?: { fn: (value: unknown) => boolean; message?: string }
    /** 
     * Escape hatch: Zod schema for full custom validation
     * @example string.zod(z.string().email())
     */
    zodSchema?: any
  }

  // ==========================================================================
  // Transform Attributes
  // ==========================================================================

  /** String transforms applied before validation */
  transforms?: {
    /** Trim whitespace from start and end */
    trim?: boolean
    /** Convert to lowercase */
    lower?: boolean
    /** Convert to uppercase */
    upper?: boolean
  }

  // ==========================================================================
  // Security Attributes
  // ==========================================================================

  /** Security-related attributes */
  security?: {
    /** Hash password before storing (scrypt) */
    password?: { cost?: number }
    /** Omit field from API responses */
    omit?: boolean
    /** Encrypt field value at rest */
    encrypted?: boolean
  }

  // ==========================================================================
  // Field-Level Access Policies
  // ==========================================================================

  /** Field-level access control */
  access?: {
    /**
     * Read access policy - controls who can see this field
     * @example .readable("authenticated") - only authenticated users can read
     * @example .readable((ctx) => ctx.user?.role === "admin") - custom function
     */
    read?: FieldAccessPolicy
    /**
     * Write access policy - controls who can modify this field
     * @example .writable("owner") - only owner can write
     * @example .writable((ctx) => ctx.user?.role === "admin") - custom function
     */
    write?: FieldAccessPolicy
  }

  // ==========================================================================
  // Rich Metadata (OpenAPI, Admin UI, AI)
  // ==========================================================================

  /** Presentation metadata for documentation and UI generation */
  meta?: {
    /** Human-readable label for forms and tables */
    label?: string
    /** Detailed description for tooltips and API docs */
    description?: string
    /** Placeholder text for form inputs */
    placeholder?: string
    /** Example value for API documentation */
    example?: unknown
    /** Icon identifier (emoji or icon name) */
    icon?: string
  }

  /** Allowed values (creates enum in OpenAPI and TypeScript) */
  options?: string[]

  /** UI rendering hints for Admin UI generation */
  ui?: {
    /** Force specific component type */
    component?: "TextInput" | "TextArea" | "RichTextEditor" | "Select" | "Checkbox" | "DatePicker" | "FilePicker" | "ColorPicker" | "Badge" | string
    /** Hide in specific views */
    hidden?: boolean | ("list" | "detail" | "form" | "create" | "edit")[]
    /** Make read-only in UI */
    readonly?: boolean
    /** Display order (lower = first) */
    order?: number
    /** Column width for tables */
    width?: string | number
    /** Group fields together under a heading */
    group?: string
  }

  /** Semantic metadata for AI and search features */
  semantic?: {
    /** Include in full-text search index */
    searchable?: boolean
    /** Generate vector embedding for semantic search */
    embedding?: {
      provider?: "openai" | "cohere" | "huggingface" | string
      model?: string
      dimensions?: number
    }
    /** Mark as PII/sensitive data for compliance */
    sensitive?: boolean
  }
}

/**
 * Field access policy - can be a rule name or a function
 */
export type FieldAccessPolicy =
  | FieldAccessPolicyRule
  | FieldAccessPolicyFn

/** Built-in access policy rules */
export type FieldAccessPolicyRule =
  | "everyone"
  | "authenticated"
  | "owner"
  | "admin"
  | "none"

/** Custom access policy function */
export type FieldAccessPolicyFn = (ctx: FieldAccessContext) => boolean | Promise<boolean>

/** Context for field access policy evaluation */
export interface FieldAccessContext {
  /** Current user (null if not authenticated) */
  user: User | null
  /** The entity being accessed */
  entity: string
  /** The field being accessed */
  field: string
  /** The operation being performed */
  operation: "read" | "write"
  /** The current record data (for read) or new data (for write) */
  data?: Record<string, unknown>
  /** The record ID if available */
  resourceId?: string
  /** The CRUD operation type (create/update) - helps policies decide access */
  crudOperation?: "create" | "update"
}

export interface RelationDef {
  type: "belongsTo" | "hasMany" | "hasOne"
  entity: () => Entity
  foreignKey: string
  references: string
  onDelete?: "cascade" | "setNull" | "restrict"
  /**
   * When true, join happens at API level instead of database level
   * Enables true domain isolation for plugins
   */
  remote?: boolean
  /**
   * Service ID to use for fetching remote data
   * If not specified, uses the entity's driver
   */
  remoteService?: string
}

// -----------------------------------------------------------------------------
// Entity
// -----------------------------------------------------------------------------

export type Operation = "create" | "read" | "update" | "delete" | "list"

export interface EntityConfig<TFields extends Record<string, FieldDef> = Record<string, FieldDef>> {
  fields: TFields
  rules: Partial<Record<Operation, RuleDef[]>>
  ownerField?: string
  timestamps: boolean | { createdAt?: string; updatedAt?: string }
  /** Entity actions (non-CRUD operations and workflows) */
  actions?: Record<string, EntityAction>
  /**
   * Namespace for schema splitting (for large codebases with 100+ entities)
   * Entities with the same namespace are grouped into separate schema files
   * Uses Prisma's prismaSchemaFolder feature for multi-file schemas
   * @example "auth", "billing", "inventory"
   */
  namespace?: string
  /**
   * Cross-field validators
   * Validate relationships between multiple fields
   * @example
   * ```typescript
   * entity("event", { startDate: datetime, endDate: datetime })
   *   .validate((data) => data.startDate < data.endDate, "Start date must be before end date")
   * ```
   */
  validators?: EntityValidator[]
}

/**
 * Cross-field validator definition
 */
export interface EntityValidator {
  /** Validation function that receives all field data */
  fn: EntityValidatorFn
  /** Error message when validation fails */
  message: string
  /** Optional: Only run on specific operations */
  operations?: ("create" | "update")[]
  /** Optional: Fields this validator depends on (for optimization) */
  fields?: string[]
}

/**
 * Cross-field validation function
 * Returns true if valid, false if invalid
 */
export type EntityValidatorFn = (
  data: Record<string, unknown>,
  ctx?: EntityValidatorContext
) => boolean | Promise<boolean>

/**
 * Context for entity validators
 */
export interface EntityValidatorContext {
  /** Current operation */
  operation: "create" | "update"
  /** Existing data (for updates) */
  existingData?: Record<string, unknown>
  /** Current user */
  user?: User | null
}

/**
 * Entity Action Definition
 * Supports both simple actions, workflows, and multi-entity operations
 */
export interface EntityAction<TInput = any, TOutput = any> {
  /** Action name */
  name: string
  /** HTTP method for the action route */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  /** Path suffix (e.g., "verify" becomes /users/:id/verify) */
  path?: string
  /** Whether action requires a resource ID */
  requiresId?: boolean
  /** Authorization rules */
  rules?: RuleDef[]
  /** Input schema for validation */
  input?: Record<string, FieldDef>
  /** Custom validation function (alternative to input schema) */
  validateFn?: (input: unknown) => { valid: boolean; errors?: string[] }
  /** Action handler */
  handler?: (ctx: EntityActionContext<TInput>) => Promise<TOutput>
  /** Workflow steps (if this is a workflow action) */
  workflow?: EntityWorkflowConfig

  // =========================================================================
  // Multi-Entity Operations (Zero API Pattern)
  // =========================================================================

  /**
   * Entity operations to execute (alternative to handler)
   * Supports multi-entity transactions with auto-mapping
   * @example
   * ```typescript
   * signUp: action("sign-up")
   *   .post()
   *   .input({ email: string, password: string })
   *   .creates("user")
   *   .creates("session", ctx => ({ userId: ctx.results.user.id }))
   * ```
   */
  operations?: EntityOperation<TInput>[]

  /**
   * Configure what to return from the action
   * @example
   * ```typescript
   * .returns("user", { omit: ["password"] })
   * ```
   */
  returns?: ActionReturnConfig

  /** OpenAPI metadata */
  metadata?: {
    summary?: string
    description?: string
    tags?: string[]
  }
}

/**
 * Context passed to entity action handlers
 */
export interface EntityActionContext<TInput = any> {
  /** The entity name */
  entity: string
  /** Action name */
  action: string
  /** Input data */
  input: TInput
  /** Resource ID (if requiresId is true) */
  resourceId?: string
  /** The resource (if requiresId is true, fetched automatically) */
  resource?: Record<string, any> | null
  /** Authenticated user */
  user: User | null
  /** Database driver */
  driver: Driver
  /** Resolve a service */
  resolve: <T = unknown>(serviceId: string) => T
  /** Async resolve */
  resolveAsync: <T = unknown>(serviceId: string) => Promise<T>
  /** Set data for workflow steps */
  set: <T = unknown>(key: string, value: T) => void
  /** Get data from workflow steps */
  get: <T = unknown>(key: string) => T | undefined
}

/**
 * Workflow configuration for entity actions
 */
export interface EntityWorkflowConfig {
  /** Use database transaction */
  useTransaction?: boolean
  /** Workflow steps */
  steps: EntityWorkflowStep[]
}

/**
 * Workflow step definition
 */
export interface EntityWorkflowStep<TResult = any> {
  /** Step name */
  name: string
  /** Execute the step */
  execute: (ctx: EntityActionContext) => Promise<TResult> | TResult
  /** Compensate/rollback if later step fails */
  compensate?: (ctx: EntityActionContext, result: TResult) => Promise<void> | void
  /** Retry configuration */
  retry?: {
    maxAttempts: number
    delay?: number
    backoff?: number
  }
}

// -----------------------------------------------------------------------------
// Multi-Entity Operations (Zero API Pattern)
// Enable actions to work with multiple entities
// -----------------------------------------------------------------------------

/**
 * Operation context passed to data/where functions in operations
 */
export interface OperationContext<TInput = any> {
  /** Input data from request */
  input: TInput
  /** Results from previous operations in the chain */
  results: Record<string, Record<string, unknown>>
  /** Resource ID (if action requires ID) */
  resourceId?: string
  /** Authenticated user */
  user: User | null
  /** Database driver */
  driver: Driver
}

/**
 * Entity operation type
 */
export type EntityOperationType = "create" | "update" | "delete" | "read"

/**
 * Entity operation definition
 * Represents a single database operation on an entity
 */
export interface EntityOperation<TInput = any> {
  /** Target entity name */
  entity: string

  /** Operation type */
  operation: EntityOperationType

  /**
   * Data for create/update operations
   * - "auto": Auto-map from input to entity fields
   * - Function: Custom mapping with access to context
   */
  data?: "auto" | ((ctx: OperationContext<TInput>) => Record<string, unknown> | Promise<Record<string, unknown>>)

  /**
   * Where clause for update/delete/read operations
   * If not provided, defaults to { id: ctx.resourceId }
   */
  where?: (ctx: OperationContext<TInput>) => Record<string, unknown> | Promise<Record<string, unknown>>

  /**
   * Optional transform applied to the result
   */
  transform?: (result: unknown, ctx: OperationContext<TInput>) => unknown | Promise<unknown>

  /**
   * Optional condition - only run if returns true
   */
  condition?: (ctx: OperationContext<TInput>) => boolean | Promise<boolean>
}

/**
 * Return configuration for actions
 * Defines what to return from the action
 */
export interface ActionReturnConfig {
  /** Which entity result to return (from results map) */
  entity?: string

  /** Fields to include in response */
  pick?: string[]

  /** Fields to exclude from response */
  omit?: string[]

  /** Custom transform function */
  transform?: (results: Record<string, unknown>) => unknown
}

export interface Entity<
  TName extends string = string,
  TFields extends Record<string, FieldDef> = Record<string, FieldDef>
> {
  name: TName
  config: EntityConfig<TFields>
  /** Plugin metadata - set when entity comes from a plugin */
  plugin?: {
    /** Plugin ID that owns this entity */
    id: string
    /** Base path for routes */
    basePath?: string
    /** Custom route path */
    routePath?: string
    /** Whether CRUD routes are disabled */
    internal?: boolean
  }
}

// -----------------------------------------------------------------------------
// User & Auth
// -----------------------------------------------------------------------------

export interface User {
  id: string
  email?: string
  role?: string
  [key: string]: unknown
}

// -----------------------------------------------------------------------------
// Rules
// -----------------------------------------------------------------------------

export interface RuleContext {
  user: User | null
  input: Record<string, any>
  resource: Record<string, any> | null
  entity: string
  operation: Operation
}

export type RuleFn = (ctx: RuleContext) => boolean | Promise<boolean>
export type BuiltInRule = "everyone" | "authenticated" | "owner" | "admin"
export type RuleDef = BuiltInRule | RuleFn

// -----------------------------------------------------------------------------
// Request / Response (Framework Agnostic)
// -----------------------------------------------------------------------------

export interface NevrRequest<TNative = unknown> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  params: Record<string, string>
  query: Record<string, string | string[] | undefined>
  body: unknown
  headers: Record<string, string | undefined>
  user: User | null
  context: Record<string, unknown>
  /**
   * Escape hatch: The native request object (e.g., Express Request, Fetch Request)
   * Only available if the adapter populates it.
   */
  native?: TNative
}

export interface NevrResponse {
  status: number
  body: unknown
  headers?: Record<string, string>
}

// -----------------------------------------------------------------------------
// Query Options
// -----------------------------------------------------------------------------

/**
 * Where clause operators
 * Supports all common query operators
 */
export type WhereOperator = {
  /** Exact match */
  equals?: unknown
  /** Alias for equals */
  eq?: unknown
  /** Not equal */
  not?: unknown
  /** Alias for not */
  ne?: unknown
  /** Value is in array */
  in?: unknown[]
  /** Value is not in array */
  notIn?: unknown[]
  /** Alias for notIn */
  not_in?: unknown[]
  /** Less than */
  lt?: number | Date
  /** Less than or equal */
  lte?: number | Date
  /** Greater than */
  gt?: number | Date
  /** Greater than or equal */
  gte?: number | Date
  /** String contains (case insensitive) */
  contains?: string
  /** String starts with */
  startsWith?: string
  /** Alias for startsWith */
  starts_with?: string
  /** String ends with */
  endsWith?: string
  /** Alias for endsWith */
  ends_with?: string
  /** Case insensitive mode */
  mode?: "insensitive" | "default"
}

export type Where = Record<string, unknown | WhereOperator>

/**
 * Sort direction with nulls handling
 */
export type SortDirection = "asc" | "desc" | { sort: "asc" | "desc"; nulls?: "first" | "last" }

/**
 * Join configuration for relations
 */
export interface JoinConfig {
  /** Join type */
  type?: "inner" | "left" | "right"
  /** Field on current entity */
  on: string
  /** Target entity name */
  entity: string
  /** Field on target entity (defaults to "id") */
  field?: string
  /** Alias for joined data */
  as?: string
  /** Nested select fields */
  select?: string[]
}

export interface QueryOptions {
  where?: Where
  select?: string[]
  /** Include relations (simple boolean or detailed config) */
  include?: Record<string, boolean | IncludeConfig>
  /** Join configuration for manual joins */
  join?: JoinConfig[]
  orderBy?: Record<string, SortDirection>
  take?: number
  skip?: number
  /** Cursor-based pagination */
  cursor?: { id: string; direction?: "forward" | "backward" }
  /** Distinct fields */
  distinct?: string[]
}

/**
 * Include configuration for relations
 */
export interface IncludeConfig {
  /** Select specific fields from relation */
  select?: string[]
  /** Filter related records */
  where?: Where
  /** Order related records */
  orderBy?: Record<string, SortDirection>
  /** Limit related records */
  take?: number
  /** Nested includes */
  include?: Record<string, boolean | IncludeConfig>
}

// -----------------------------------------------------------------------------
// Driver Interface (Database Abstraction)
// Entity-first database adapter
// -----------------------------------------------------------------------------

export interface Driver {
  /** Driver identifier */
  id?: string
  name: string

  // -------------------------------------------------------------------------
  // Core CRUD Operations
  // -------------------------------------------------------------------------

  findOne<T>(entity: string, where: Where): Promise<T | null>

  findMany<T>(entity: string, options?: QueryOptions): Promise<T[]>

  create<T>(entity: string, data: Record<string, unknown>): Promise<T>

  update<T>(
    entity: string,
    where: Where,
    data: Record<string, unknown>
  ): Promise<T>

  delete(entity: string, where: Where): Promise<void>

  count(entity: string, where?: Where): Promise<number>

  // -------------------------------------------------------------------------
  // Batch Operations
  // -------------------------------------------------------------------------

  /**
   * Create multiple records at once
   */
  createMany?<T>(entity: string, data: Record<string, unknown>[]): Promise<T[]>

  /**
   * Update multiple records matching where clause
   */
  updateMany?<T>(
    entity: string,
    where: Where,
    data: Record<string, unknown>
  ): Promise<{ count: number }>

  /**
   * Delete multiple records matching where clause
   */
  deleteMany?(entity: string, where: Where): Promise<{ count: number }>

  /**
   * Create or update based on unique constraint
   */
  upsert?<T>(
    entity: string,
    where: Where,
    create: Record<string, unknown>,
    update: Record<string, unknown>
  ): Promise<T>

  // -------------------------------------------------------------------------
  // Advanced Queries
  // -------------------------------------------------------------------------

  /**
   * Find first matching record (like findOne but with full QueryOptions)
   */
  findFirst?<T>(entity: string, options?: QueryOptions): Promise<T | null>

  /**
   * Check if any record exists matching where clause
   */
  exists?(entity: string, where: Where): Promise<boolean>

  /**
   * Aggregate operations (sum, avg, min, max)
   */
  aggregate?<T>(
    entity: string,
    operations: {
      _count?: boolean | Record<string, boolean>
      _sum?: Record<string, boolean>
      _avg?: Record<string, boolean>
      _min?: Record<string, boolean>
      _max?: Record<string, boolean>
    },
    where?: Where
  ): Promise<T>

  /**
   * Group by with aggregations
   */
  groupBy?<T>(
    entity: string,
    by: string[],
    operations?: {
      _count?: boolean | Record<string, boolean>
      _sum?: Record<string, boolean>
      _avg?: Record<string, boolean>
    },
    where?: Where
  ): Promise<T[]>

  // -------------------------------------------------------------------------
  // Transaction Support
  // -------------------------------------------------------------------------

  /**
   * Execute multiple operations in a transaction
   */
  transaction?<R>(callback: (tx: Driver) => Promise<R>): Promise<R>

  // -------------------------------------------------------------------------
  // Raw Access (Escape Hatch)
  // -------------------------------------------------------------------------

  /**
   * Get the raw database client for advanced use cases
   */
  getClient?(): unknown

  /**
   * Execute raw query (use with caution)
   */
  raw?<T>(query: string, params?: unknown[]): Promise<T>
}

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

export interface MiddlewareContext {
  request: NevrRequest
  response: Partial<NevrResponse>
  get: <T = unknown>(key: string) => T | undefined
  set: (key: string, value: unknown) => void
  end: (body: unknown, status?: number) => void
  ended: boolean
}

export type MiddlewareFn = (
  ctx: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void> | void

export interface Middleware {
  name: string
  handler: MiddlewareFn
}

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

export interface HookContext {
  entity: string
  operation: Operation
  user: User | null
  input: Record<string, any>
  resource: Record<string, any> | null
  driver: Driver

  // Control methods
  stop: () => void
  stopped: boolean
  setInput: (data: Record<string, any>) => void
  setResource: (data: Record<string, any>) => void
  addFilter: (filter: Where) => void
  filters: Where

  // Service Container (Pillar 3: Functional DI)
  /** Resolve a registered service by ID */
  resolve: <T = unknown>(serviceId: string) => T
  /** Async resolve for services that need initialization */
  resolveAsync: <T = unknown>(serviceId: string) => Promise<T>
}

export type HookFn = (ctx: HookContext) => void | Promise<void>

export interface Hooks {
  beforeCreate?: HookFn
  afterCreate?: HookFn
  beforeUpdate?: HookFn
  afterUpdate?: HookFn
  beforeDelete?: HookFn
  afterDelete?: HookFn
  beforeRead?: HookFn
  beforeList?: HookFn
  onError?: (error: Error, ctx: HookContext) => void | Promise<void>
}

// -----------------------------------------------------------------------------
// OpenAPI Metadata (for routes)
// -----------------------------------------------------------------------------

export interface RouteOpenAPIParameter {
  name: string
  in: "query" | "path" | "header" | "cookie"
  required?: boolean
  description?: string
  schema?: {
    type: "string" | "number" | "integer" | "boolean" | "array" | "object"
    format?: string
    enum?: string[]
  }
}

export interface RouteOpenAPIMetadata {
  /** Operation ID for code generation */
  operationId?: string
  /** Short summary */
  summary?: string
  /** Detailed description */
  description?: string
  /** Tags for grouping */
  tags?: string[]
  /** Whether authentication is required */
  requiresAuth?: boolean
  /** Parameters */
  parameters?: RouteOpenAPIParameter[]
  /** Request body schema */
  requestBody?: {
    description?: string
    required?: boolean
    schema?: Record<string, any>
  }
  /** Response schemas */
  responses?: Record<string, {
    description: string
    schema?: Record<string, any>
  }>
  /** Deprecation status */
  deprecated?: boolean
}

// -----------------------------------------------------------------------------
// Plugin Interface
// -----------------------------------------------------------------------------

export interface Route {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  handler: (req: NevrRequest, nevr: NevrInstance) => Promise<NevrResponse>
  /**
   * Middleware to apply to this route
   * Executed in order before the handler
   */
  use?: MiddlewareFn[]
  /**
   * OpenAPI metadata for documentation generation
   */
  metadata?: RouteOpenAPIMetadata
}

export interface PluginHooks {
  /** Called when plugin is initialized */
  onInit?: (nevr: NevrInstance) => void | Promise<void>
  /** Called before each request is processed */
  onRequest?: (req: NevrRequest, nevr: NevrInstance) => void | Promise<void>
  /** Called after each response is generated */
  onResponse?: (req: NevrRequest, res: NevrResponse, nevr: NevrInstance) => void | Promise<void>
  /** Called when an error occurs */
  onError?: (error: Error, req: NevrRequest, nevr: NevrInstance) => void | Promise<void>
}

export interface Plugin {
  /** Unique plugin identifier */
  id?: string

  /** Plugin name (required) */
  name: string

  /** Plugin version */
  version?: string

  /** Plugin description */
  description?: string

  // Request level - can be array or factory function
  middleware?: Middleware[] | ((nevr: NevrInstance) => Middleware[])

  // Entity level
  hooks?: Hooks | PluginHooks

  // Extend entities
  fields?: {
    all?: Record<string, FieldDef>
    [entityName: string]: Record<string, FieldDef> | undefined
  }

  // Add entities
  entities?: Entity[]

  // Add routes - can be array or factory function
  routes?: Route[] | ((nevr: NevrInstance) => Route[])

  // Extend context - static or factory function
  context?: Record<string, unknown> | ((req: NevrRequest) => Record<string, unknown>)

  // Initialization
  setup?: (nevr: NevrInstance) => void | Promise<void>
}

// -----------------------------------------------------------------------------
// Adapter Interface (Framework Abstraction)
// -----------------------------------------------------------------------------

export interface AdapterOptions {
  getUser: (req: unknown) => User | null | Promise<User | null>
  prefix?: string
}

export interface Adapter<THandler = unknown> {
  name: string
  createHandler: (nevr: NevrInstance, options: AdapterOptions) => THandler
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  data: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

// Re-export from centralized error-codes module
export type { ErrorCode } from "./error-codes.js"

export interface NevrError {
  code: import("./error-codes.js").ErrorCode
  message: string
  details?: ValidationError[]
}

// -----------------------------------------------------------------------------
// Nevr Instance
// -----------------------------------------------------------------------------

export interface NevrConfig {
  entities: (Entity | EntityOrBuilder)[]
  driver: Driver
  plugins?: { meta: any;[key: string]: any }[]
  cors?: CorsOptions | boolean
  security?: SecurityOptions | false
  /**
   * Request context factory - adds custom fields to each request
   */
  context?: (req: NevrRequest) => Record<string, unknown> | Promise<Record<string, unknown>>
  /**
   * Nevr context for isolated state management
   * 
   * When provided, the Nevr instance uses this context for all state
   * (services, rules, plugins) instead of global singletons.
   * 
   * Benefits:
   * - Test isolation: Each test can have its own context
   * - Multiple instances: Run multiple Nevr apps in same process
   * - Explicit dependencies: No hidden global state
   * 
   * @example
   * ```typescript
   * import { createNevrContext, nevr } from "nevr"
   * 
   * // Testing with isolated context
   * const ctx = createNevrContext()
   * const api = nevr({ nevrContext: ctx, entities: [...] })
   * 
   * afterEach(() => ctx.services.clear())
   * ```
   */
  nevrContext?: import("./context.js").NevrContext
  /**
   * Entity routing options
   */
  entityRoutes?: {
    /**
     * Custom pluralization function
     * @example (name) => name + 's' // simple pluralization
     */
    pluralize?: (entityName: string) => string
    /**
     * Disable auto-pluralization (use entity name as-is)
     * @default false
     */
    disablePluralization?: boolean
    /**
     * Custom route mappings per entity
     * @example { user: 'users', person: 'people' }
     */
    routes?: Record<string, string>
  }
}

/**
 * Accept both Entity and EntityBuilder for flexibility
 * EntityBuilder will be auto-resolved to Entity
 */
export interface EntityOrBuilder {
  name: string
  config?: EntityConfig
  build?: () => Entity
}

export interface CorsOptions {
  origin?: string | string[] | boolean
  credentials?: boolean
  methods?: string[]
  allowedHeaders?: string[]
}

export interface SecurityOptions {
  helmet?: boolean
}

export interface NevrInstance {
  config: NevrConfig
  entities: Map<string, Entity>
  /** Plugins (any plugin format is accepted and normalized internally) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: any[]
  middleware: Middleware[]
  driver: Driver

  // Methods
  handleRequest: (req: NevrRequest) => Promise<NevrResponse>
  getEntity: (name: string) => Entity | undefined
  getDriver: () => Driver

  // =============================================================================
  // Service Container (Pillar 3: Functional DI)
  // =============================================================================

  /** The underlying service container for advanced usage */
  container: {
    /** Initialize all singleton services (call on app startup) */
    initializeAll: () => Promise<void>
    /** Get all registered service IDs */
    getServiceIds: () => string[]
    /** Get services by tag */
    getByTag: (tag: string) => string[]
    /** Clear all services (useful for testing) */
    clear: () => void
    /** Unregister a service */
    unregister: (id: string) => boolean
  }

  /** Resolve a registered service by ID (sync) */
  resolve: <T = unknown>(serviceId: string) => T
  /** Async resolve for services that need initialization */
  resolveAsync: <T = unknown>(serviceId: string) => Promise<T>
  /** Register a service with lifecycle options */
  registerService: <T>(
    id: string,
    factory: ((ctx: ServiceResolverContext) => T) | ((ctx: ServiceResolverContext) => Promise<T>) | T,
    options?: ServiceRegistrationOptions
  ) => void
  /** Check if service is registered */
  hasService: (id: string) => boolean

  // =============================================================================
  // Custom Routes & Middleware (DX Helpers)
  // =============================================================================

  /** Add a custom route at runtime */
  addRoute: (route: Route) => void
  /** Add a custom middleware at runtime */
  addMiddleware: (middleware: Middleware) => void
  /** List all custom routes */
  getRoutes: () => Route[]

  // =============================================================================
  // Entity Actions (Entity-first workflows and custom operations)
  // =============================================================================

  /** Execute an entity action */
  executeAction: <TInput = unknown, TOutput = unknown>(
    entityName: string,
    actionName: string,
    input: TInput,
    ctx?: { user?: User | null; resourceId?: string }
  ) => Promise<TOutput>
}

/** Service registration options */
export interface ServiceRegistrationOptions {
  /** Service lifecycle: singleton (default), transient, or scoped */
  lifecycle?: "singleton" | "transient" | "scoped"
  /** Tags for grouping/querying services */
  tags?: string[]
  /** Priority for initialization order (higher = earlier) */
  priority?: number
  /** Description for debugging */
  description?: string
}

/** Context passed to service factories */
export interface ServiceResolverContext {
  /** Resolve another service */
  resolve: <T = unknown>(id: string) => T
  /** Async resolve another service */
  resolveAsync: <T = unknown>(id: string) => Promise<T>
  /** Database driver */
  driver: Driver
}
