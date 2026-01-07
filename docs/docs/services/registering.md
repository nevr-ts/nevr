# Registering Services

How to register services in the container.

---

## registerService()

Register a service with a factory function:

```typescript
api.registerService("serviceName", (ctx) => serviceInstance, options?)
```

### Basic Examples

```typescript
// External APIs
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY))
api.registerService("sendgrid", () => new SendGrid(process.env.SENDGRID_KEY))

// Custom classes
api.registerService("orderService", (ctx) => {
  const stripe = ctx.resolve("stripe")
  return new OrderService(stripe)
})

// Functions
api.registerService("generateId", () => () => crypto.randomUUID())

// Configuration
api.registerService("config", () => ({
  apiUrl: process.env.API_URL,
  debug: process.env.NODE_ENV === "development",
}))
```

---

## Register an Instance

Register an already-instantiated service object directly using `registerService`:

```typescript
const stripeClient = new Stripe(process.env.STRIPE_KEY)
api.registerService("stripe", stripeClient)

const redisClient = await createRedisClient()
api.registerService("redis", redisClient)
```

---

## registerMany()

To register multiple services at once, you can use `registerService` repeatedly or use the raw container for bulk operations (advanced):

```typescript
// Standard way
api.registerService("stripe", () => new Stripe(KEY))
api.registerService("mailer", () => new Mailer())

// Advanced: Using raw container
const container = getGlobalContainer()
container.registerMany({
  stripe: () => new Stripe(KEY),
  mailer: {
    factory: () => new Mailer(),
    options: { lifecycle: "singleton", tags: ["email"] },
  },
})
```

---

## ServiceRegistrationOptions

```typescript
interface ServiceRegistrationOptions {
  /** Service lifecycle (default: "singleton") */
  lifecycle?: "singleton" | "transient" | "scoped"

  /** Optional description for debugging */
  description?: string

  /** Tags for grouping services */
  tags?: string[]

  /** Priority for initialization order (higher = earlier) */
  priority?: number
}
```

### With Options

```typescript
api.registerService("cache", () => new Redis(), {
  lifecycle: "singleton",
  tags: ["cache", "infrastructure"],
  description: "Redis cache client",
  priority: 100, // Initialize early
})

api.registerService("requestLogger", () => new Logger(), {
  lifecycle: "scoped",  // New instance per request
  tags: ["logging"],
})

api.registerService("uuid", () => crypto.randomUUID(), {
  lifecycle: "transient",  // New value every time
})
```

---

## Async Factories

For services that need async initialization:

```typescript
api.registerService("database", async (ctx) => {
  const connection = await createConnection()
  await connection.connect()
  return connection
})

api.registerService("secrets", async () => {
  return await loadSecretsFromVault()
})

// Resolve with resolveAsync
const db = await ctx.resolveAsync("database")
```

---

## Factory Helpers

### createService()

Create a service with explicit dependencies:

```typescript
import { createService } from "nevr"

api.registerService("orderService",
  createService(
    ["stripe", "mailer", "inventory"], // Dependencies
    (deps, ctx) => new OrderService(deps.stripe, deps.mailer, deps.inventory)
  )
)
```

### lazyService()

Create a lazy-initialized service:

```typescript
import { lazyService } from "nevr"

api.registerService("heavyClient", lazyService(async () => {
  // Only runs when first resolved
  const client = await initializeHeavyClient()
  return client
}))
```

---

## Service Context

Factory functions receive a context with these properties:

| Property | Type | Description |
|:--|:--|:--|
| `resolve` | `<T>(id: string) => T` | Resolve another service (sync) |
| `resolveAsync` | `<T>(id: string) => Promise<T>` | Resolve another service (async) |
| `driver` | `Driver` | Database driver |

```typescript
api.registerService("myService", (ctx) => {
  // Resolve other services
  const stripe = ctx.resolve<Stripe>("stripe")
  const db = ctx.driver

  return new MyService(stripe, db)
})
```

> [!NOTE]
> The factory context is `ServiceResolverContext`. For the full `ServiceContext` with `has()`, `getServiceIds()`, `getByTag()`, use `ServiceContainer` directly.

---

## Circular Dependency Detection

The container detects circular dependencies:

```typescript
// This will throw an error
api.registerService("a", (ctx) => {
  return { b: ctx.resolve("b") }
})

api.registerService("b", (ctx) => {
  return { a: ctx.resolve("a") }  // Circular!
})

ctx.resolve("a")
// Error: Circular dependency detected: "a" -> "b" -> "a"
```

### Breaking Circular Dependencies

Use lazy resolution:

```typescript
api.registerService("a", (ctx) => ({
  getB: () => ctx.resolve("b"),  // Resolved lazily when called
}))

api.registerService("b", (ctx) => ({
  getA: () => ctx.resolve("a"),
}))
```

---

## Tags

Group related services:

```typescript
api.registerService("redis", () => new Redis(), {
  tags: ["cache", "infrastructure"],
})

api.registerService("memcache", () => new Memcache(), {
  tags: ["cache", "infrastructure"],
})

api.registerService("s3", () => new S3(), {
  tags: ["storage", "infrastructure"],
})

// Get all cache services
const cacheIds = api.container.getByTag("cache")
// ["redis", "memcache"]

// Get all infrastructure
const infraIds = api.container.getByTag("infrastructure")
// ["redis", "memcache", "s3"]
```

---

## Typed Services

Define a type registry for type-safe resolution:

```typescript
// Define your service types
interface AppServices {
  stripe: Stripe
  mailer: MailerService
  config: AppConfig
  orderService: OrderService
}

// Type-safe resolution
const stripe = ctx.resolve<AppServices["stripe"]>("stripe")
const mailer = ctx.resolve<AppServices["mailer"]>("mailer")
```

---

## Full Example

```typescript
import { nevr, createService, lazyService } from "nevr"
import Stripe from "stripe"
import { Mailer } from "./mailer"
import { OrderService } from "./order-service"

const api = nevr({
  entities: [user, order, product],
  driver: prisma(db),
})

// Infrastructure
api.registerService("config", () => ({
  stripeKey: process.env.STRIPE_KEY!,
  mailFrom: "noreply@example.com",
}), { priority: 100 })

// External clients
api.registerService("stripe", (ctx) => {
  const config = ctx.resolve("config")
  return new Stripe(config.stripeKey)
}, { tags: ["payment"] })

api.registerService("mailer", () => new Mailer(), {
  tags: ["email"],
})

// Business services
api.registerService("orderService",
  createService(
    ["stripe", "mailer"],
    (deps) => new OrderService(deps.stripe, deps.mailer)
  ),
  { tags: ["business"] }
)

// Async service
api.registerService("secrets", lazyService(async () => {
  return await loadFromVault()
}))

// Initialize all singletons at startup
await api.container.initializeAll()
```

---

## Next Steps

- [Resolving Services](/services/resolving)
- [Service Lifecycle](/services/lifecycle)
- [Scoped Services](/services/scoped)
