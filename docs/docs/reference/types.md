# Types Reference

TypeScript type definitions.

## Core Types

### Entity

```typescript
interface Entity {
  name: string
  config: EntityConfig
}
```

### EntityConfig

```typescript
interface EntityConfig {
  fields: Record<string, FieldDef>
  rules?: Record<Operation, RuleDef[]>
  ownerField?: string
  timestamps?: boolean
  namespace?: string
  actions?: Record<string, EntityAction>
  validators?: EntityValidator[]
}
```

### FieldDef

```typescript
interface FieldDef {
  type: FieldType
  optional?: boolean
  unique?: boolean
  default?: any | (() => any)
  validation?: FieldValidation[]
  transforms?: FieldTransform[]
  security?: FieldSecurity
  access?: {
    read?: FieldAccessPolicy
    write?: FieldAccessPolicy
  }
  relation?: RelationDef
}
```

### FieldType

```typescript
type FieldType =
  | "string"
  | "text"
  | "int"
  | "float"
  | "boolean"
  | "datetime"
  | "json"
```

### RelationDef

```typescript
interface RelationDef {
  type: "belongsTo" | "hasMany" | "hasOne"
  entity: () => Entity | EntityBuilder
  foreignKey?: string
  onDelete?: "cascade" | "setNull" | "restrict"
  remote?: string
}
```

### Operation

```typescript
type Operation = "create" | "read" | "update" | "delete" | "list"
```

## Rule Types

### RuleDef

```typescript
type RuleDef = BuiltInRule | RuleFn
```

### BuiltInRule

```typescript
type BuiltInRule = "everyone" | "authenticated" | "owner" | "admin"
```

### RuleFn

```typescript
type RuleFn = (ctx: RuleContext) => boolean | Promise<boolean>
```

### RuleContext

```typescript
interface RuleContext {
  user: User | null
  record: Record<string, unknown> | null
  operation: Operation
  driver: Driver
}
```

## User Types

### User

```typescript
interface User {
  id: string
  email?: string
  role?: string
  [key: string]: unknown
}
```

## Request/Response Types

### NevrRequest

```typescript
interface NevrRequest {
  method: string
  path: string
  headers: Record<string, string>
  query: Record<string, any>
  body: any
  params: Record<string, string>
}
```

### NevrResponse

```typescript
interface NevrResponse {
  status: number
  body: any
  headers?: Record<string, string>
}
```

## Query Types

### QueryOptions

```typescript
interface QueryOptions {
  where?: Where
  select?: Record<string, boolean>
  include?: IncludeConfig
  orderBy?: Record<string, SortDirection>
  take?: number
  skip?: number
}
```

### Where

```typescript
interface Where {
  [field: string]: WhereValue | WhereOperator
}

interface WhereOperator {
  equals?: any
  not?: any
  in?: any[]
  notIn?: any[]
  lt?: number
  lte?: number
  gt?: number
  gte?: number
  contains?: string
  startsWith?: string
  endsWith?: string
}
```

## Driver Types

### Driver

```typescript
interface Driver {
  findOne<T>(entity: string, where: Where): Promise<T | null>
  findMany<T>(entity: string, options?: QueryOptions): Promise<T[]>
  create<T>(entity: string, data: any): Promise<T>
  update<T>(entity: string, where: Where, data: any): Promise<T>
  delete(entity: string, where: Where): Promise<void>
  count(entity: string, where?: Where): Promise<number>
  transaction?<T>(fn: (tx: Driver) => Promise<T>): Promise<T>
}
```

## Plugin Types

### Plugin

```typescript
interface Plugin {
  name: string
  version?: string
  description?: string
  entities?: Entity[]
  routes?: Route[] | ((nevr: NevrInstance) => Route[])
  middleware?: Middleware[] | ((nevr: NevrInstance) => Middleware[])
  hooks?: Hooks
  fields?: Record<string, FieldDef>
  context?: any | ((nevr: NevrInstance) => any)
  setup?: (nevr: NevrInstance) => void | Promise<void>
}
```

### Route

```typescript
interface Route {
  method: string
  path: string
  handler: (ctx: RouteContext) => Promise<any>
  middleware?: Middleware[]
}
```

### Middleware

```typescript
interface Middleware {
  name: string
  fn: MiddlewareFn
}

type MiddlewareFn = (
  ctx: MiddlewareContext,
  next: () => Promise<NevrResponse>
) => Promise<NevrResponse>
```

### Hooks

```typescript
interface Hooks {
  beforeCreate?: HookFn
  afterCreate?: HookFn
  beforeUpdate?: HookFn
  afterUpdate?: HookFn
  beforeDelete?: HookFn
  afterDelete?: HookFn
  onError?: (error: Error, ctx: HookContext) => void
}
```

## Action Types

### EntityAction

```typescript
interface EntityAction {
  name: string
  method: string
  onResource: boolean
  rules: RuleDef[]
  input?: Record<string, FieldDef>
  handler?: (ctx: ActionContext) => Promise<any>
  workflow?: WorkflowConfig
  meta?: Record<string, any>
}
```

### ActionContext

```typescript
interface ActionContext<TInput = any> {
  input: TInput
  resourceId?: string
  user: User | null
  driver: Driver
  resolve: <T>(serviceId: string) => T
  entity: Entity
  raw: any
}
```

## Workflow Types

### WorkflowStep

```typescript
interface WorkflowStep<TData, TResult> {
  name: string
  execute: (ctx: WorkflowContext<TData>) => Promise<TResult>
  compensate?: (ctx: WorkflowContext<TData>, result: TResult) => Promise<void>
}
```

### WorkflowContext

```typescript
interface WorkflowContext<TData> {
  input: any
  data: TData
  stepResults: Record<string, any>
  driver: Driver
  resolve: <T>(serviceId: string) => T
}
```

### WorkflowConfig

```typescript
interface WorkflowConfig {
  steps: WorkflowStep<any, any>[]
  useTransaction?: boolean
  timeout?: number
  initialData?: any
}
```

## Service Types

### ServiceFactory

```typescript
type ServiceFactory<T> = (ctx: ServiceContext) => T | Promise<T>
```

### ServiceOptions

```typescript
interface ServiceOptions {
  lifecycle?: "singleton" | "transient" | "scoped"
  tags?: string[]
}
```

### ServiceContext

```typescript
interface ServiceContext {
  resolve: <T>(serviceId: string) => T
  resolveAsync: <T>(serviceId: string) => Promise<T>
  driver: Driver
}
```

## Validation Types

### EntityValidator

```typescript
interface EntityValidator {
  fn: EntityValidatorFn
  message: string
  operations?: ("create" | "update")[]
  fields?: string[]
}
```

### EntityValidatorFn

```typescript
type EntityValidatorFn = (
  data: Record<string, unknown>,
  ctx?: EntityValidatorContext
) => boolean | Promise<boolean>
```

## Access Policy Types

### FieldAccessPolicy

```typescript
type FieldAccessPolicy = FieldAccessPolicyRule | FieldAccessPolicyFn
```

### FieldAccessPolicyRule

```typescript
type FieldAccessPolicyRule =
  | "everyone"
  | "authenticated"
  | "owner"
  | "admin"
  | "none"
```

### FieldAccessPolicyFn

```typescript
type FieldAccessPolicyFn = (
  ctx: FieldAccessContext
) => boolean | Promise<boolean>
```

## See Also

- [Type Safety](/concepts/type-safety)
- [Type Inference](/reference/inference)
