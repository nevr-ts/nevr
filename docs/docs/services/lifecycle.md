# Service Lifecycle

Control when service instances are created.

## Lifecycle Options

### Singleton (Default)

One instance for the entire application:

```typescript
api.registerService("stripe", () => new Stripe(KEY), {
  lifecycle: "singleton",
})

// Same instance everywhere
const stripe1 = ctx.resolve("stripe")
const stripe2 = ctx.resolve("stripe")
stripe1 === stripe2 // true
```

### Transient

New instance on every resolve:

```typescript
api.registerService("uuid", () => crypto.randomUUID(), {
  lifecycle: "transient",
})

// Different each time
const id1 = ctx.resolve("uuid")
const id2 = ctx.resolve("uuid")
id1 !== id2 // true
```

### Scoped

One instance per request:

```typescript
api.registerService("requestLog", () => ({
  entries: [],
}), {
  lifecycle: "scoped",
})

// Same within request, different across requests
```

## Choosing a Lifecycle

| Use Case | Lifecycle |
|----------|-----------|
| API clients (Stripe, etc.) | `singleton` |
| Database connections | `singleton` |
| ID generators | `transient` |
| Request context | `scoped` |
| Loggers | `scoped` |

## Initialization

Initialize singletons at startup:

```typescript
// Initialize all singletons
await api.container.initializeAll()
```

## Cleanup

Unregister services:

```typescript
// Remove single service
api.container.unregister("stripe")

// Clear all
api.container.clear()
```

## Tags

Group services with tags:

```typescript
api.registerService("redis", () => new Redis(), {
  tags: ["cache", "infrastructure"],
})

api.registerService("memcache", () => new Memcache(), {
  tags: ["cache", "infrastructure"],
})

// Get all cache services
const caches = api.container.getByTag("cache")
```

## Next Steps

- [Service Container](/services/container)
- [Registering Services](/services/registering)
