# Resolving Services

How to access registered services.

## Basic Resolution

```typescript
const stripe = ctx.resolve("stripe")
```

## Resolution Context

Services can be resolved from:

### Action Handlers

```typescript
.actions({
  checkout: action()
    .handler(async (ctx) => {
      const stripe = ctx.resolve("stripe")
      return stripe.charges.create({...})
    }),
})
```

### Hooks

```typescript
hooks: {
  afterCreate: async (ctx) => {
    const mailer = ctx.resolve("mailer")
    await mailer.send("welcome", ctx.result)
  }
}
```

### Middleware

```typescript
middleware: [{
  name: "logging",
  fn: async (ctx, next) => {
    const logger = ctx.resolve("logger")
    logger.info(`${ctx.method} ${ctx.path}`)
    return next()
  }
}]
```

### Service Factories

```typescript
api.registerService("orderService", (ctx) => {
  const stripe = ctx.resolve("stripe")
  const mailer = ctx.resolve("mailer")
  return new OrderService(stripe, mailer)
})
```

## Async Resolution

For services with async factories:

```typescript
const db = await ctx.resolveAsync("database")
```

## Check Existence

```typescript
if (api.hasService("stripe")) {
  const stripe = ctx.resolve("stripe")
}
```

## Get All Services

```typescript
// Get all service IDs
const ids = api.container.getServiceIds()

// Get services by tag
const cacheServices = api.container.getByTag("cache")
```

## Type Safety

Define service types:

```typescript
interface Services {
  stripe: Stripe
  mailer: Mailer
  config: AppConfig
}

// Typed resolution
const stripe = ctx.resolve<Stripe>("stripe")
```

## Next Steps

- [Scoped Services](/services/scoped)
- [Service Lifecycle](/services/lifecycle)
