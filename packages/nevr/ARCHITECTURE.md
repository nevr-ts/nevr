# Nevr Architecture

This document explains the core architectural decisions and design principles behind Nevr.

## 📋 Table of Contents

- [Core Principles](#core-principles)
- [Entity-First Architecture](#entity-first-architecture)
- [Type Inference System](#type-inference-system)
- [Plugin System](#plugin-system)
- [Service Container](#service-container)
- [Request Flow](#request-flow)

---

## 🏛️ Core Principles

### 1. Entity-First Design

Everything starts with entities. Instead of writing controllers, services, and repositories separately, you define your data model and Nevr generates everything else.

```typescript
// Define once, get everything
const user = entity("user", {
  email: string.unique(),
  password: string.password().omit(),
})
```

This single definition gives you:
- Database schema
- CRUD API endpoints
- Input validation
- Security rules
- Type inference

### 2. Zero Boilerplate

Common patterns are built-in, not bolted-on:

| Pattern | Traditional | Nevr |
|---------|-------------|------|
| Password hashing | Manual crypto calls | `.password()` |
| Hide sensitive data | Manual field filtering | `.omit()` |
| Unique constraints | DB & validation separate | `.unique()` |
| Timestamps | Manual hooks | `timestamps()` plugin |

### 3. Framework Agnostic

Nevr works with any HTTP framework through adapters:

```
┌─────────────┐     ┌─────────────┐     ┌──────────┐
│   Express   │────▶│   Adapter   │────▶│   Nevr   │
│    Hono     │     │  (Bridge)   │     │   Core   │
│   Bun/Deno  │     └─────────────┘     └──────────┘
└─────────────┘
```

### 4. Database Agnostic

Same entities work with different databases through drivers:

```
┌───────────┐     ┌──────────────┐     ┌───────────┐
│   Nevr    │────▶│    Driver    │────▶│  Prisma   │
│   Core    │     │  (Abstract)  │     │  Drizzle  │
│           │     └──────────────┘     │  Kysely   │
└───────────┘                          └───────────┘
```

---

## 🔷 Entity-First Architecture

### The Entity as Single Source of Truth

In Nevr, the entity definition contains everything about your data:

```typescript
const user = entity("user", {
  // Schema definition
  email: string.email().unique(),
  password: string.password().omit(),
  role: string.default("user").writable("none"),
  
  // Relations
  posts: hasMany(() => post),
})
  // Ownership tracking
  .ownedBy("id")
  
  // Access control
  .rules({
    read: ["authenticated"],
    update: ["owner", "admin"],
  })
  
  // Cross-field validation
  .validate({
    roleValid: {
      fn: (data) => ["user", "admin"].includes(data.role),
      message: "Invalid role",
    },
  })
  
  .build()
```

### Field Builder DSL

Fields are defined using a fluent builder API:

```
┌──────────────────────────────────────────────────────────────┐
│                      Field Definition                         │
├──────────────────────────────────────────────────────────────┤
│  string  ────▶  .password()  ────▶  .omit()  ────▶  .build() │
│   ↓              ↓                   ↓                        │
│  Type         Transform           Security        Runtime     │
│  (base)       (hash)              (hide)          (resolve)   │
└──────────────────────────────────────────────────────────────┘
```

### FieldBuilder Resolution

At runtime, FieldBuilder instances are resolved to plain objects:

```typescript
// Definition (compile-time)
password: string.password().omit()

// Resolved (runtime)
{
  type: "string",
  transform: { hash: "scrypt" },
  returned: false,  // omit from API
  input: false,     // can't be set directly
}
```

The `resolvePluginFieldDef()` utility handles this conversion for plugins.

---

## 🔍 Type Inference System

### End-to-End Type Safety

Types flow from server to client without manual synchronization:

```
┌─────────────────────────────────────────────────────────────┐
│  Server (entity definition)                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ entity("user", { email: string, name: string.optional() })│
│  └────────────────────┬────────────────────────────────────┘│
└───────────────────────┼─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Type Inference Layer                                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ type User = { id: string; email: string; name?: string } ││
│  └────────────────────┬────────────────────────────────────┘│
└───────────────────────┼─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Client (auto-typed)                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ client.users.create({ email: "..." }) // TypeScript knows││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### $Infer Pattern

Expose types through the `$Infer` property:

```typescript
// Server
export const api = nevr({ entities: [user, post], driver })
export type API = typeof api

// Client
type ServerTypes = API["$Infer"]
type User = ServerTypes["Entities"]["user"]
type Post = ServerTypes["Entities"]["post"]
```

### Type Mapping

Field types map to TypeScript types:

| Field Type | TypeScript Type |
|------------|-----------------|
| `string`, `text` | `string` |
| `int`, `float` | `number` |
| `bool`, `boolean` | `boolean` |
| `datetime` | `Date` |
| `json` | `Record<string, unknown>` |
| `belongsTo(entity)` | `string` (foreign key) |

---

## 🧩 Plugin System

### Unified Plugin Architecture

The unified plugin system provides a consistent structure:

```typescript
export const myPlugin = createUnifiedPlugin({
  // Metadata
  meta: {
    id: "my-plugin",
    name: "My Plugin",
    version: "1.0.0",
    dependencies: [{ id: "auth", version: "^1.0.0" }],
  },
  
  // Schema (entities & extensions)
  schema: {
    entities: {
      myEntity: { fields: { ... }, internal: true }
    },
    extend: {
      user: { customField: string }  // Extend existing entity
    }
  },
  
  // Lifecycle hooks
  lifecycle: {
    onInit: (nevr) => { /* startup */ },
    onRequest: (req, nevr) => { /* per-request */ },
    onShutdown: (nevr) => { /* cleanup */ },
  },
  
  // Custom routes
  routes: (nevr) => [
    { method: "POST", path: "/custom", handler: ... }
  ],
})
```

### Plugin Resolution

Plugins are resolved and merged in order:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  auth()     │  │ timestamps()│  │  custom()   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       ▼                ▼                ▼
┌─────────────────────────────────────────────────┐
│           Plugin Resolver                        │
│  • Resolve dependencies                          │
│  • Merge schemas                                 │
│  • Combine lifecycle hooks                       │
│  • Collect routes                                │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│           Nevr Instance                          │
│  • Merged entities                               │
│  • All routes registered                         │
│  • Lifecycle manager active                      │
└─────────────────────────────────────────────────┘
```

### PluginFieldDef Union

Fields in plugin schemas accept multiple types:

```typescript
type PluginFieldDef = 
  | PluginFieldDefObject  // Plain object definition
  | FieldBuilder          // Field DSL builder
  | RelationBuilder       // belongsTo/hasMany
  | SelfRefBuilder        // Self-referential relation
```

---

## 💉 Service Container

### Functional Dependency Injection

Register and resolve services with lifecycle management:

```
┌─────────────────────────────────────────────────────────────┐
│                  Service Container                           │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │ stripe    │  │  email    │  │  cache    │  ... services │
│  │ singleton │  │ singleton │  │ transient │               │
│  └───────────┘  └───────────┘  └───────────┘               │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│  ctx.resolve("stripe")  // Same instance                     │
│  ctx.resolve("cache")   // New instance each time            │
└─────────────────────────────────────────────────────────────┘
```

### Lifecycle Options

| Lifecycle | When Created | When Disposed |
|-----------|--------------|---------------|
| `singleton` | First resolve | App shutdown |
| `transient` | Every resolve | After use |
| `scoped` | Per request | Request end |

---

## 🔄 Request Flow

### Complete Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. HTTP Request                                                     │
│     POST /api/users { email: "...", password: "..." }               │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Adapter (Express/Hono)                                           │
│     • Parse request                                                  │
│     • Extract user from session/token                                │
│     • Convert to NevrRequest                                         │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Middleware Stack                                                 │
│     • CORS                                                           │
│     • Security headers                                               │
│     • Plugin middleware                                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Router                                                           │
│     • Match route to entity/operation                                │
│     • Check plugin routes                                            │
│     • Extract parameters                                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. CRUD Handler                                                     │
│     a. Validate input (field types, constraints)                     │
│     b. Check authorization rules                                     │
│     c. Execute beforeCreate hook                                     │
│     d. Apply field transformations (password hash, etc.)             │
│     e. Call driver.create()                                          │
│     f. Execute afterCreate hook                                      │
│     g. Filter output (remove .omit() fields)                         │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. Response                                                         │
│     { id: "...", email: "..." }                                      │
│     (password NOT included - omitted)                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Key Interfaces

### Core Types

```typescript
interface NevrInstance {
  config: NevrConfig
  entities: Map<string, Entity>
  plugins: Plugin[]
  driver: Driver
  handleRequest: (req: NevrRequest) => Promise<NevrResponse>
  
  // Service container
  resolve: <T>(id: string) => T
  registerService: <T>(id: string, factory: () => T) => void
}

interface Entity {
  name: string
  config: EntityConfig  // fields, rules, hooks, validators
  plugin?: { id: string, internal?: boolean }
}

interface Driver {
  findOne<T>(entity: string, where: Where): Promise<T | null>
  findMany<T>(entity: string, options?: QueryOptions): Promise<T[]>
  create<T>(entity: string, data: Record<string, unknown>): Promise<T>
  update<T>(entity: string, where: Where, data: Record<string, unknown>): Promise<T>
  delete(entity: string, where: Where): Promise<void>
  count(entity: string, where?: Where): Promise<number>
}
```

---

## 🎯 Design Decisions

### Why Entity-First?

1. **Single Source of Truth** — One definition, no sync issues
2. **Declarative Security** — Rules live with data, not scattered
3. **Better DX** — Less code to write and maintain
4. **Type Safety** — TypeScript knows your schema

### Why FieldBuilder DSL?

1. **Fluent API** — Natural to read and write
2. **Composable** — Chain modifiers freely
3. **Type-Safe** — TypeScript validates chains
4. **Extensible** — Add custom builders

### Why Unified Plugins?

1. **Consistent Structure** — Same pattern for all plugins
2. **Dependency Management** — Plugins can require others
3. **Rich Lifecycle** — Init, request, shutdown hooks
4. **Schema Integration** — Plugins can extend entities

---

## 📚 Further Reading

- [README.md](./README.md) — Quick start guide
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Development guide
