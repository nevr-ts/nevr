# Service Container

> 💉 **A powerful dependency injection container for managing services across your application.**

Nevr provides dependency injection for managing services, enabling loose coupling, testability, and centralized configuration. The container supports singleton, transient, and scoped lifecycles with automatic circular dependency detection.

> 🟢 **Beginner Tip**: Don't worry if "dependency injection" sounds complex. It simply means: define your services in one place, and Nevr makes them available everywhere you need them.

## What is the Service Container?

The Service Container is a registry for services that can be resolved anywhere in your application—actions, hooks, workflows, and plugins. It follows the Inversion of Control (IoC) pattern.

```typescript
import { nevr } from "nevr"

const api = nevr({
  entities: [user, order],
  driver: prisma(db),
})

// Register a service
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY))

// Resolve anywhere in your code
const stripe = api.resolve<Stripe>("stripe")
```

## Why Use the Service Container?

| Benefit | Description |
|---------|-------------|
| **Loose Coupling** | Services don't directly import each other |
| **Testability** | Easy to mock services in tests |
| **Configuration** | Centralized service setup |
| **Lifecycle Management** | Singleton, transient, or scoped instances |
| **Circular Detection** | Automatic detection of circular dependencies |
| **Lazy Initialization** | Services created only when needed |

---

## API Reference

### `api.*` Methods (NevrInstance)

Top-level methods available on your Nevr instance:

| Method | Type | Description |
|:--|:--|:--|
| `api.registerService(id, factory, options?)` | `void` | Register a service with factory or instance |
| `api.resolve<T>(id)` | `T` | Synchronously resolve a service |
| `api.resolveAsync<T>(id)` | `Promise<T>` | Asynchronously resolve a service |
| `api.hasService(id)` | `boolean` | Check if a service is registered |

### `api.container.*` Methods

Low-level container methods for advanced usage:

| Method | Type | Description |
|:--|:--|:--|
| `api.container.initializeAll()` | `Promise<void>` | Initialize all singleton services |
| `api.container.getServiceIds()` | `string[]` | Get all registered service IDs |
| `api.container.getByTag(tag)` | `string[]` | Get service IDs by tag |
| `api.container.clear()` | `void` | Clear all services (for testing) |
| `api.container.unregister(id)` | `boolean` | Remove a service |

---

## Registering Services

### Basic Registration

Register services with factory functions for lazy initialization:

```typescript
// Factory function (recommended)
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY))

// Factory with dependencies
api.registerService("orders", (ctx) => {
  const stripe = ctx.resolve<Stripe>("stripe")
  return new OrderService(stripe, ctx.driver)
})

// Async factory
api.registerService("database", async (ctx) => {
  const connection = await createConnection()
  await connection.connect()
  return connection
})
```

### Register an Instance Directly

Pass an instance instead of a factory:

```typescript
const stripe = new Stripe(process.env.STRIPE_KEY)

// Directly registers the instance (no factory)
api.registerService("stripe", stripe)
```

---

## ServiceRegistrationOptions

Configure how services are created and managed:

```typescript
interface ServiceRegistrationOptions {
  /** Service lifecycle: singleton (default), transient, or scoped */
  lifecycle?: "singleton" | "transient" | "scoped"
  /** Optional description for debugging */
  description?: string
  /** Tags for grouping services */
  tags?: string[]
  /** Priority for ordering (higher = earlier initialization) */
  priority?: number
}
```

| Option | Type | Default | Description |
|:--|:--|:--|:--|
| `lifecycle` | `"singleton" \| "transient" \| "scoped"` | `"singleton"` | When to create new instances |
| `tags` | `string[]` | `[]` | Tags for grouping services |
| `priority` | `number` | `0` | Initialization order (higher = earlier) |
| `description` | `string` | - | Description for debugging |

```typescript
api.registerService("cache", () => new Redis(), {
  lifecycle: "singleton",
  tags: ["infrastructure", "cache"],
  priority: 10,  // Initialize early
  description: "Redis cache service",
})
```

### Lifecycle Options

| Lifecycle | Behavior | Use Case |
|:--|:--|:--|
| `singleton` | One instance for entire app | Stripe, database connections |
| `transient` | New instance every resolve | Loggers, request-specific services |
| `scoped` | One instance per request | Current user, request context |

```typescript
// Singleton (default) - one instance for the entire application
api.registerService("stripe", () => new Stripe(key), {
  lifecycle: "singleton"
})

// Transient - new instance created every time
api.registerService("logger", () => new Logger(), {
  lifecycle: "transient"
})

// Scoped - one instance per request
api.registerService("requestContext", () => new RequestContext(), {
  lifecycle: "scoped"
})
```

---

## Resolving Services

### Synchronous Resolution

For services that don't require async initialization:

```typescript
// In actions
.actions({
  processPayment: action()
    .handler(async (ctx) => {
      const stripe = ctx.resolve<Stripe>("stripe")
      return stripe.charges.create({ ... })
    }),
})

// Directly from the API
const cache = api.resolve<Redis>("cache")
```

### Asynchronous Resolution

For services that need async initialization:

```typescript
// In actions with async services
.actions({
  syncData: action()
    .handler(async (ctx) => {
      const db = await ctx.resolveAsync<Database>("database")
      await db.sync()
    }),
})

// Initialize all singletons at startup
await api.container.initializeAll()
```

---

## ServiceResolverContext

The context passed to factory functions:

| Property | Type | Description |
|:--|:--|:--|
| `resolve` | `<T>(id: string) => T` | Resolve another service (sync) |
| `resolveAsync` | `<T>(id: string) => Promise<T>` | Resolve another service (async) |
| `driver` | `Driver` | Database driver |

```typescript
// Service that depends on other services
api.registerService("orderService", (ctx) => {
  const stripe = ctx.resolve<Stripe>("stripe")
  const mailer = ctx.resolve<MailerService>("mailer")
  const db = ctx.driver

  return new OrderService(stripe, mailer, db)
})
```

---

## Tags for Grouping

Organize services with tags:

```typescript
api.registerService("postgres", () => new Pool(), {
  tags: ["database", "sql"]
})

api.registerService("redis", () => new Redis(), {
  tags: ["database", "cache"]
})

api.registerService("mongodb", () => new MongoClient(), {
  tags: ["database", "nosql"]
})

// Get all database services
const dbServices = api.container.getByTag("database")
// ["postgres", "redis", "mongodb"]
```

---

## ScopedContainer

For per-request services like current user or request context:

```typescript
import { createScope, ScopedContainer } from "nevr"

// In middleware
async function authMiddleware(req, res, next) {
  const scope = createScope(api.container)

  // Set request-specific values
  scope.set("currentUser", req.user)
  scope.set("requestId", generateId())

  // Attach to request for later use
  req.scope = scope
  next()
}

// In actions
.actions({
  getProfile: action()
    .handler(async (ctx) => {
      const currentUser = ctx.resolve("currentUser")
      return currentUser
    }),
})
```

### ScopedContainer Methods

| Method | Type | Description |
|:--|:--|:--|
| `set(id, value)` | `void` | Set a scoped value |
| `resolve<T>(id)` | `T` | Resolve from scope first, then parent |
| `resolveAsync<T>(id)` | `Promise<T>` | Async resolution |
| `has(id)` | `boolean` | Check if service exists |
| `getDriver()` | `Driver` | Get the database driver |
| `getContext()` | `ServiceContext` | Get service context |

---

## Circular Dependency Detection

The container automatically detects circular dependencies:

```typescript
// This will throw an error
api.registerService("a", (ctx) => {
  const b = ctx.resolve("b") // b depends on a
  return new A(b)
})

api.registerService("b", (ctx) => {
  const a = ctx.resolve("a") // a depends on b - circular!
  return new B(a)
})

api.resolve("a")
// Error: [ServiceContainer] Circular dependency detected: "a"
```

### Breaking Circular Dependencies

Use lazy resolution to break cycles:

```typescript
api.registerService("a", (ctx) => {
  return new A(() => ctx.resolve("b")) // Lazy resolution
})

api.registerService("b", (ctx) => {
  const a = ctx.resolve("a")
  return new B(a)
})
```

---

## ServiceContainer Class

For advanced usage, you can use the `ServiceContainer` class directly:

```typescript
import { ServiceContainer, getGlobalContainer } from "nevr"

// Create a new container
const container = new ServiceContainer()

// Or use the global container
const globalContainer = getGlobalContainer()
```

### ServiceContainer Methods

| Method | Description |
|:--|:--|
| `register(id, factory, options?)` | Register a service with a factory |
| `registerInstance(id, instance, options?)` | Register an already-instantiated service |
| `registerMany(services)` | Register multiple services at once |
| `resolve<T>(id)` | Synchronously resolve a service |
| `resolveAsync<T>(id)` | Asynchronously resolve a service |
| `has(id)` | Check if a service is registered |
| `getServiceIds()` | Get all registered service IDs |
| `getByTag(tag)` | Get service IDs by tag |
| `initializeAll()` | Initialize all singleton services |
| `unregister(id)` | Remove a service |
| `clear()` | Clear all services |
| `setDriver(driver)` | Set the database driver |
| `getResolver()` | Get a typed resolver |
| `createContext()` | Create a service context |

---

## Real-World Example

```typescript
const api = nevr({
  entities: [user, product, order],
  driver: prisma(db),
})

// Payment processing
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY), {
  tags: ["payments"]
})

// Email service
api.registerService("mailer", (ctx) => {
  return new MailerService({
    from: "noreply@shop.com",
    templates: "./templates"
  })
}, { tags: ["communication"] })

// Order processing (depends on other services)
api.registerService("orders", (ctx) => {
  return new OrderService(
    ctx.resolve("stripe"),
    ctx.resolve("mailer"),
    ctx.driver
  )
}, { tags: ["core"] })

// Use in action
const order = entity("order", { ... })
  .actions({
    checkout: action()
      .input({ paymentMethod: string })
      .handler(async (ctx) => {
        const orders = ctx.resolve<OrderService>("orders")
        return orders.processCheckout(ctx.resourceId, ctx.input)
      }),
  })
```

---

## Testing with Mocks

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { ServiceContainer } from "nevr"

describe("OrderService", () => {
  let container: ServiceContainer

  beforeEach(() => {
    container = new ServiceContainer()

    // Register mocks
    container.registerInstance("stripe", {
      charges: { create: vi.fn().mockResolvedValue({ id: "ch_123" }) }
    })

    container.registerInstance("mailer", {
      send: vi.fn().mockResolvedValue(true)
    })
  })

  it("processes checkout", async () => {
    const orders = new OrderService(
      container.resolve("stripe"),
      container.resolve("mailer")
    )

    const result = await orders.processCheckout("order_123", {
      paymentMethod: "pm_123"
    })

    expect(result.success).toBe(true)
  })
})
```

---

## Next Steps

- [Registering Services](/services/registering) - Different registration patterns
- [Resolving Services](/services/resolving) - Resolution strategies
- [Scoped Services](/services/scoped) - Per-request services
- [Service Lifecycle](/services/lifecycle) - Singleton, transient, scoped
