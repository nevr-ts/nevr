// =============================================================================
// NEVR CORE TYPES
// Foundation types for the entire framework
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

export interface FieldDef {
  type: FieldType
  optional: boolean
  unique: boolean
  default?: unknown
  min?: number
  max?: number
  isEmail?: boolean
  relation?: RelationDef
}

export interface RelationDef {
  type: "belongsTo" | "hasMany" | "hasOne"
  entity: () => Entity
  foreignKey: string
  references: string
  onDelete?: "cascade" | "setNull" | "restrict"
}

// -----------------------------------------------------------------------------
// Entity
// -----------------------------------------------------------------------------

export type Operation = "create" | "read" | "update" | "delete" | "list"

export interface EntityConfig {
  fields: Record<string, FieldDef>
  rules: Partial<Record<Operation, RuleDef[]>>
  ownerField?: string
  timestamps: boolean
}

export interface Entity {
  name: string
  config: EntityConfig
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
  input: Record<string, unknown>
  resource: Record<string, unknown> | null
  entity: string
  operation: Operation
}

export type RuleFn = (ctx: RuleContext) => boolean | Promise<boolean>
export type BuiltInRule = "everyone" | "authenticated" | "owner" | "admin"
export type RuleDef = BuiltInRule | RuleFn

// -----------------------------------------------------------------------------
// Request / Response (Framework Agnostic)
// -----------------------------------------------------------------------------

export interface ZapiRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  params: Record<string, string>
  query: Record<string, string | string[] | undefined>
  body: unknown
  headers: Record<string, string | undefined>
  user: User | null
  context: Record<string, unknown>
}

export interface ZapiResponse {
  status: number
  body: unknown
  headers?: Record<string, string>
}

// -----------------------------------------------------------------------------
// Query Options
// -----------------------------------------------------------------------------

export interface QueryOptions {
  where?: Where
  select?: string[]
  include?: Record<string, boolean>
  orderBy?: Record<string, "asc" | "desc">
  take?: number
  skip?: number
}

export type WhereOperator = {
  equals?: unknown
  not?: unknown
  in?: unknown[]
  notIn?: unknown[]
  lt?: number
  lte?: number
  gt?: number
  gte?: number
  contains?: string
  startsWith?: string
  endsWith?: string
}

export type Where = Record<string, unknown | WhereOperator>

// -----------------------------------------------------------------------------
// Driver Interface (Database Abstraction)
// -----------------------------------------------------------------------------

export interface Driver {
  name: string

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
  
  // Optional: Transaction support
  transaction?<R>(callback: (tx: Driver) => Promise<R>): Promise<R>
}

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

export interface MiddlewareContext {
  request: ZapiRequest
  response: Partial<ZapiResponse>
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
  input: Record<string, unknown>
  resource: Record<string, unknown> | null
  driver: Driver

  // Control methods
  stop: () => void
  stopped: boolean
  setInput: (data: Record<string, unknown>) => void
  setResource: (data: Record<string, unknown>) => void
  addFilter: (filter: Where) => void
  filters: Where
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
// Plugin Interface
// -----------------------------------------------------------------------------

export interface Route {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  handler: (req: ZapiRequest, zapi: ZapiInstance) => Promise<ZapiResponse>
}

export interface PluginHooks {
  /** Called when plugin is initialized */
  onInit?: (zapi: ZapiInstance) => void | Promise<void>
  /** Called before each request is processed */
  onRequest?: (req: ZapiRequest, zapi: ZapiInstance) => void | Promise<void>
  /** Called after each response is generated */
  onResponse?: (req: ZapiRequest, res: ZapiResponse, zapi: ZapiInstance) => void | Promise<void>
  /** Called when an error occurs */
  onError?: (error: Error, req: ZapiRequest, zapi: ZapiInstance) => void | Promise<void>
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
  middleware?: Middleware[] | ((zapi: ZapiInstance) => Middleware[])

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
  routes?: Route[] | ((zapi: ZapiInstance) => Route[])

  // Extend context - static or factory function
  context?: Record<string, unknown> | ((req: ZapiRequest) => Record<string, unknown>)

  // Initialization (legacy - use hooks.onInit instead)
  setup?: (zapi: ZapiInstance) => void | Promise<void>
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
  createHandler: (zapi: ZapiInstance, options: AdapterOptions) => THandler
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

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"

export interface ZapiError {
  code: ErrorCode
  message: string
  details?: ValidationError[]
}

// -----------------------------------------------------------------------------
// Zapi Instance
// -----------------------------------------------------------------------------

export interface ZapiConfig {
  entities: Entity[]
  driver: Driver
  plugins?: Plugin[]
  cors?: CorsOptions | false
  security?: SecurityOptions | false
  context?: (req: ZapiRequest) => Record<string, unknown> | Promise<Record<string, unknown>>
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

export interface ZapiInstance {
  config: ZapiConfig
  entities: Map<string, Entity>
  plugins: Plugin[]
  middleware: Middleware[]
  driver: Driver

  // Methods
  handleRequest: (req: ZapiRequest) => Promise<ZapiResponse>
  getEntity: (name: string) => Entity | undefined
  getDriver: () => Driver
}
