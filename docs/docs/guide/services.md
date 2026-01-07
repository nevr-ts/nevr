# Service Container

The Service Container is Nevr's dependency injection system. Register services once, resolve them anywhere with `ctx.resolve()`.

## Why Service Container?

Without DI, your code becomes tightly coupled:

```typescript
// Bad: Direct imports everywhere
import { Stripe } from "stripe"
import { sendEmail } from "./mailer"
import { uploadToS3 } from "./storage"

// In every handler...
const stripe = new Stripe(process.env.STRIPE_KEY!)
await sendEmail(...)
await uploadToS3(...)
```

With Service Container:

```typescript
// Good: Register once
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY!))
api.registerService("mailer", () => new Mailer())
api.registerService("storage", () => new S3Storage())

// Resolve anywhere
const stripe = ctx.resolve("stripe")
```

## Registering Services

### Basic Registration

```typescript
import { nevr, entity, string } from "nevr"
import Stripe from "stripe"

const api = nevr({
  entities: [user, post],
  driver: prisma(new PrismaClient()),
})

// Register a service with a factory function
api.registerService("stripe", () => {
  return new Stripe(process.env.STRIPE_KEY!, {
    apiVersion: "2023-10-16",
  })
})
```

### Registration with Dependencies

Services can depend on other services:

```typescript
// Config service
api.registerService("config", () => ({
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT || "587"),
}))

// Mailer depends on config
api.registerService("mailer", (ctx) => {
  const config = ctx.resolve("config")
  return new Mailer({
    host: config.smtpHost,
    port: config.smtpPort,
  })
})
```

### Register Instance Directly

If you already have an instance:

```typescript
const stripeInstance = new Stripe(process.env.STRIPE_KEY!)

api.registerService("stripe", () => stripeInstance)
// Or register instance directly via container
api.container.registerInstance("stripe", stripeInstance)
```

## Service Lifecycles

### Singleton (Default)

Factory is called once, same instance is returned:

```typescript
api.registerService("database", () => {
  console.log("Creating database connection...")
  return new DatabaseConnection()
}, { lifecycle: "singleton" })

// First call creates instance
const db1 = ctx.resolve("database") // logs: Creating database connection...
// Subsequent calls reuse it
const db2 = ctx.resolve("database") // no log, same instance
console.log(db1 === db2) // true
```

### Transient

New instance created every time:

```typescript
api.registerService("requestId", () => {
  return { id: crypto.randomUUID() }
}, { lifecycle: "transient" })

const req1 = ctx.resolve("requestId")
const req2 = ctx.resolve("requestId")
console.log(req1.id === req2.id) // false
```

### Scoped (Per-Request)

Instance is created once per request using `ScopedContainer`:

```typescript
import { createScope } from "nevr"

// In middleware
app.use((req, res, next) => {
  const scope = createScope(api.container)
  scope.set("currentUser", req.user)
  scope.set("requestId", crypto.randomUUID())
  req.scope = scope
  next()
})

// In handler
const user = ctx.resolve("currentUser")
const requestId = ctx.resolve("requestId")
```

## Resolving Services

### In Actions

```typescript
const order = entity("order", {
  total: float,
  status: string.default("pending"),
}).actions({
  checkout: action()
    .input({ paymentMethodId: string })
    .handler(async (ctx) => {
      // Resolve services
      const stripe = ctx.resolve("stripe")
      const inventory = ctx.resolve("inventory")
      const mailer = ctx.resolve("mailer")

      // Use them
      const charge = await stripe.charges.create({
        amount: ctx.resource.total * 100,
        currency: "usd",
        payment_method: ctx.input.paymentMethodId,
      })

      await mailer.send({
        to: ctx.user.email,
        subject: "Order Confirmed",
        body: `Your order #${ctx.resourceId} is confirmed.`,
      })

      return { chargeId: charge.id }
    }),
})
```

### In Workflows

```typescript
step("charge-payment",
  async (ctx) => {
    const stripe = ctx.resolve("stripe")
    return await stripe.charges.create({
      amount: ctx.input.amount,
      currency: "usd",
    })
  },
  async (ctx, charge) => {
    const stripe = ctx.resolve("stripe")
    await stripe.refunds.create({ charge: charge.id })
  }
)
```

### In Hooks

```typescript
const user = entity("user", {
  email: string,
}).hooks({
  afterCreate: async (ctx) => {
    const mailer = ctx.resolve("mailer")
    await mailer.send({
      to: ctx.result.email,
      subject: "Welcome!",
      body: "Thanks for signing up.",
    })
  },
})
```

### Async Resolution

For services that need async initialization:

```typescript
api.registerService("database", async () => {
  const db = new Database()
  await db.connect() // Async operation
  return db
})

// Must use resolveAsync
const db = await ctx.resolveAsync("database")
```

## Service Tags

Group related services with tags:

```typescript
// Register notification services
api.registerService("emailNotifier", () => new EmailNotifier(), {
  tags: ["notifier"],
})
api.registerService("smsNotifier", () => new SMSNotifier(), {
  tags: ["notifier"],
})
api.registerService("pushNotifier", () => new PushNotifier(), {
  tags: ["notifier"],
})

// Get all notifiers
const notifierIds = api.container.getByTag("notifier")
// ["emailNotifier", "smsNotifier", "pushNotifier"]

// Send notification via all channels
for (const id of notifierIds) {
  const notifier = ctx.resolve(id)
  await notifier.send(message)
}
```

## Helper Functions

### createService

Create a service with declared dependencies:

```typescript
import { createService } from "nevr"

const paymentServiceFactory = createService<
  PaymentService,
  { stripe: Stripe; logger: Logger }
>(
  ["stripe", "logger"],
  (deps, ctx) => {
    return new PaymentService(deps.stripe, deps.logger)
  }
)

api.registerService("payment", paymentServiceFactory)
```

### lazyService

Create a service that initializes on first use:

```typescript
import { lazyService } from "nevr"

api.registerService("heavyService", lazyService(() => {
  console.log("Initializing heavy service...")
  return new HeavyService()
}))

// Service not created until first resolve
const service = await ctx.resolveAsync("heavyService")
```

## Scoped Containers

For per-request values like `currentUser`:

```typescript
import { createScope, ScopedContainer } from "nevr"

// Create scope from parent container
const scope = createScope(api.container)

// Set per-request values
scope.set("currentUser", { id: "user-123", email: "john@example.com" })
scope.set("requestId", crypto.randomUUID())

// Resolve - checks scope first, then parent
const user = scope.resolve("currentUser")      // From scope
const stripe = scope.resolve("stripe")          // From parent
```

### Express Integration

### createResolverContext

For advanced use cases (like testing or manual context creation), you can create a standalone resolver context:

```typescript
import { createResolverContext } from "nevr"

const ctx = createResolverContext(api.container, {
  user: mockUser,
  requestId: "test-id"
})

const service = ctx.resolve("service")
```



```typescript
import express from "express"
import { createScope } from "nevr"

const app = express()

app.use((req, res, next) => {
  // Create scoped container for this request
  const scope = createScope(api.container)

  // Set request-specific values
  scope.set("currentUser", req.user)
  scope.set("requestId", req.headers["x-request-id"])

  // Attach to request
  req.scope = scope
  next()
})

app.post("/orders/:id/checkout", async (req, res) => {
  const scope = req.scope
  const user = scope.resolve("currentUser")
  const stripe = scope.resolve("stripe")
  // ...
})
```

## Global Container

For simple applications without explicit wiring:

```typescript
import {
  getGlobalContainer,
  setGlobalContainer,
  clearGlobalContainer,
} from "nevr"

// Get/create global container
const container = getGlobalContainer()
container.register("config", () => ({ env: "production" }))

// Set custom container as global
const myContainer = new ServiceContainer()
setGlobalContainer(myContainer)

// Clear (useful for testing)
clearGlobalContainer()
```

## Circular Dependency Detection

The container automatically detects circular dependencies:

```typescript
api.registerService("serviceA", (ctx) => {
  ctx.resolve("serviceB") // Resolves B which tries to resolve A
  return { name: "A" }
})

api.registerService("serviceB", (ctx) => {
  ctx.resolve("serviceA") // Circular!
  return { name: "B" }
})

ctx.resolve("serviceA")
// Error: Circular dependency detected: "serviceA"
```

## Type-Safe Resolution

### Define Service Types

```typescript
import { DefineServices, MergeServices } from "nevr"

// Define your service types
interface AppServices {
  stripe: Stripe
  mailer: Mailer
  config: { smtpHost: string; smtpPort: number }
}

// Use in resolution
const stripe = ctx.resolve<AppServices["stripe"]>("stripe")
const mailer = ctx.resolve<AppServices["mailer"]>("mailer")
```

### Plugin Service Types

```typescript
// In plugin
interface PaymentPluginServices {
  paymentProcessor: PaymentProcessor
  invoiceGenerator: InvoiceGenerator
}

// Merge with app services
type AllServices = MergeServices<AppServices, PaymentPluginServices>
```

## Checking Service Existence

```typescript
// Check if service exists
if (api.hasService("stripe")) {
  const stripe = ctx.resolve("stripe")
  await stripe.charges.create(...)
}

// Get all service IDs
const serviceIds = api.container.getServiceIds()
// ["stripe", "mailer", "config", ...]
```

## Initialize All Services

Pre-initialize all singletons at startup:

```typescript
const api = nevr({ entities, driver })

// Register all services
api.registerService("database", async () => new Database())
api.registerService("cache", async () => new Redis())

// Initialize at startup (useful for warming up connections)
await api.container.initializeAll()

// Start server
app.listen(3000)
```

## Best Practices

1. **Register early** - Register all services before handling requests
2. **Use factories** - Prefer factory functions over direct instances for testability
3. **Singleton by default** - Most services should be singletons
4. **Scope per-request data** - Use `ScopedContainer` for request-specific values
5. **Avoid circular deps** - Structure your services to avoid circular dependencies
6. **Type your services** - Use TypeScript interfaces for type-safe resolution

## Next Steps

- [Actions](/guide/actions) - Using services in actions
- [Workflows](/guide/workflows) - Using services in workflow steps
- [Remote Joiner](/guide/remote-joiner) - Remote data fetching services
