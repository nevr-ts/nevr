# Scoped Services

Request-scoped service instances.

## What Are Scoped Services?

A new instance is created for each request and shared within that request.

```typescript
api.registerService("requestContext", () => ({
  requestId: crypto.randomUUID(),
  startTime: Date.now(),
}), { lifecycle: "scoped" })
```

## Use Cases

### Request Tracking

```typescript
api.registerService("requestLogger", () => ({
  requestId: crypto.randomUUID(),
  logs: [],
  log(message: string) {
    this.logs.push({ time: Date.now(), message })
  }
}), { lifecycle: "scoped" })

// Same instance throughout request
action().handler(async (ctx) => {
  const logger = ctx.resolve("requestLogger")
  logger.log("Starting checkout")
  // ...
  logger.log("Checkout complete")
})
```

### Database Transactions

```typescript
api.registerService("transaction", async (ctx) => {
  return ctx.resolve("db").startTransaction()
}, { lifecycle: "scoped" })
```

### User Context

```typescript
api.registerService("currentUser", (ctx) => {
  return ctx.user // From auth middleware
}, { lifecycle: "scoped" })
```

## Creating Scopes

```typescript
import { createScope } from "nevr"

// Manual scope creation
// Create a new scope from the global/API container
const scope = createScope(api.container)

// Set scoped values
scope.set("requestId", "req_123")

const service = scope.resolve("requestLogger")
```

## Lifecycle Comparison

| Lifecycle | Instance Created | Shared |
|-----------|-----------------|--------|
| `singleton` | Once | Globally |
| `transient` | Every resolve | Never |
| `scoped` | Per request | Within request |

## Next Steps

- [Service Lifecycle](/services/lifecycle)
- [Service Container](/services/container)
