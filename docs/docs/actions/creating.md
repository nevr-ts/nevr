# Creating Actions

> 🛠️ **Build custom actions for domain-specific operations on entities.**

## Why Create Custom Actions?

While built-in CRUD endpoints handle basic data operations, your business logic often requires more:

| Use Case | Why Not Just Use CRUD? | Custom Action |
|----------|------------------------|---------------|
| **Email verification** | Need to validate token, update status, send notification | `POST /users/:id/verify` |
| **Order cancellation** | Must check status, refund payment, restore inventory | `POST /orders/:id/cancel` |
| **Content publishing** | Needs approval check, SEO update, cache invalidation | `POST /articles/:id/publish` |
| **Bulk operations** | Standard endpoints work on single records | `PUT /products/bulk` |

> 🟢 **Beginner Tip**: If you find yourself making multiple API calls from your frontend to accomplish one "business action", that's a sign you need a custom action.

---

## action()

Create a new action builder:

```typescript
import { entity, action, string } from "nevr"

const user = entity("user", { name: string, email: string })
  .actions({
    greet: action()
      .handler(async (ctx) => {
        return { message: `Hello, ${ctx.user?.name}!` }
      }),
  })
```

---

## ActionBuilder Methods

### .method()

Set HTTP method (default: POST):

```typescript
.actions({
  search: action()
    .method("GET")
    .handler(async (ctx) => { ... }),

  // Shorthand methods
  getStatus: action().get().handler(...),
  create: action().post().handler(...),
})
```

### .input()

Define input schema with validation:

```typescript
.actions({
  invite: action()
    .input({
      email: string.email(),
      role: string.optional(),
      message: text.max(500),
    })
    .handler(async (ctx) => {
      const { email, role, message } = ctx.input
      // email: string, role: string | undefined, message: string
    }),
})
```

### .onResource()

Require a resource ID (for /:id/action routes):

```typescript
.actions({
  activate: action()
    .onResource()
    .handler(async (ctx) => {
      const id = ctx.resourceId
      const record = ctx.resource // Pre-loaded entity
      await ctx.driver.update(ctx.entity, { id }, { active: true })
      return { activated: true }
    }),
})
// Endpoint: POST /api/users/:id/activate
```

### .rules()

Set authorization rules:

```typescript
.actions({
  // Only owner or admin
  cancel: action()
    .onResource()
    .rules("owner", "admin")
    .handler(async (ctx) => { ... }),

  // Only admin
  forceDelete: action()
    .onResource()
    .rules("admin")
    .handler(async (ctx) => { ... }),

  // Custom rule function
  special: action()
    .rules((ctx) => ctx.user?.premium === true)
    .handler(async (ctx) => { ... }),
})
```

### .meta()

Add metadata for documentation or middleware:

```typescript
.actions({
  report: action()
    .meta({
      description: "Generate monthly report",
      rateLimit: 10,
      cache: 3600,
      tags: ["reports", "analytics"],
    })
    .handler(async (ctx) => { ... }),
})
```

### .workflow()

Attach a workflow with saga pattern:

```typescript
import { step } from "nevr"

.actions({
  checkout: action()
    .onResource()
    .input({ paymentMethodId: string })
    .workflow([
      step("reserve", reserveInventory, releaseInventory),
      step("charge", chargePayment, refundPayment),
      step("fulfill", createShipment),
    ], { useTransaction: true })
})
```

### .handler()

Set the action handler:

```typescript
.actions({
  custom: action()
    .input({ data: string })
    .handler(async (ctx) => {
      // Business logic here
      return { success: true, data: ctx.input.data }
    }),
})
```

---

## ActionContext

Context passed to action handlers:

```typescript
interface ActionContext<TInput = unknown> {
  /** Validated input data */
  input: TInput

  /** URL parameters */
  params: Record<string, string>

  /** Query parameters */
  query: Record<string, string | string[] | undefined>

  /** Request headers */
  headers: Record<string, string | undefined>

  /** Authenticated user (null if unauthenticated) */
  user: User | null

  /** Database driver */
  driver: Driver

  /** Entity name */
  entity: string

  /** Resource ID (if onResource) */
  resourceId?: string

  /** Pre-loaded resource (if onResource) */
  resource?: Record<string, unknown>

  /** Resolve a service */
  resolve: <T>(serviceId: string) => T

  /** Full Nevr context */
  context: NevrContext

  /** Raw request */
  request: NevrRequest
}
```

---

## ActionResult

Actions can return data or a full result:

```typescript
// Simple data return
.handler(async (ctx) => {
  return { message: "Done" }
})

// Full result with status/headers
.handler(async (ctx) => {
  return {
    data: { id: "123" },
    status: 201,
    headers: { "X-Custom": "value" },
  }
})

// Redirect
.handler(async (ctx) => {
  return { redirect: "/success" }
})
```

```typescript
interface ActionResult<TOutput = unknown> {
  data?: TOutput
  status?: number
  headers?: Record<string, string>
  redirect?: string
}
```

---

## Factory Functions

Quick action creation without builder:

```typescript
import { getAction, postAction } from "nevr"

.actions({
  // GET action
  stats: getAction(async (ctx) => {
    const count = await ctx.driver.count(ctx.entity)
    return { count }
  }),

  // POST action
  process: postAction(async (ctx) => {
    return { processed: true }
  }),
})
```

---

## Full Example

```typescript
import { entity, action, string, float, step } from "nevr"

const order = entity("order", {
  status: string.default("pending"),
  total: float,
  customer: belongsTo(() => user),
})
  .ownedBy("customer")
  .actions({
    // Simple action
    getStatus: action()
      .get()
      .onResource()
      .handler(async (ctx) => {
        return { status: ctx.resource?.status }
      }),

    // Action with input
    cancel: action()
      .onResource()
      .rules("owner", "admin")
      .input({ reason: string.optional() })
      .handler(async (ctx) => {
        if (ctx.resource?.status === "shipped") {
          throw new Error("Cannot cancel shipped order")
        }
        await ctx.driver.update("order", { id: ctx.resourceId }, {
          status: "cancelled",
          cancelReason: ctx.input.reason,
        })
        return { cancelled: true }
      }),

    // Action with workflow
    checkout: action()
      .onResource()
      .rules("owner")
      .input({ paymentMethodId: string })
      .workflow([
        step("reserve",
          async (ctx) => ctx.resolve("inventory").reserve(ctx.resource.items),
          async (ctx, result) => ctx.resolve("inventory").release(result.id)
        ),
        step("charge",
          async (ctx) => ctx.resolve("stripe").charges.create({
            amount: Math.round(ctx.resource.total * 100),
            source: ctx.input.paymentMethodId,
          }),
          async (ctx, result) => ctx.resolve("stripe").refunds.create({
            charge: result.id,
          })
        ),
        step("notify",
          async (ctx) => ctx.resolve("mailer").send("order-confirmed", ctx.user.email)
        ),
      ], { useTransaction: true }),

    // Collection action (no resource ID)
    bulkProcess: action()
      .post()
      .rules("admin")
      .input({ ids: json })
      .handler(async (ctx) => {
        let processed = 0
        for (const id of ctx.input.ids) {
          await ctx.driver.update("order", { id }, { status: "processed" })
          processed++
        }
        return { processed }
      }),
  })
```

---

## Client Usage

```typescript
// Resource action
await client.orders.action("cancel", "order_123", {
  reason: "Customer request",
})

// Collection action
await client.orders.action("bulkProcess", {
  ids: ["order_1", "order_2"],
})
```

---

## HTTP API

```bash
# Resource action
POST /api/orders/order_123/cancel
Content-Type: application/json
{"reason": "Customer request"}

# Collection action
POST /api/orders/bulk-process
Content-Type: application/json
{"ids": ["order_1", "order_2"]}

# GET action
GET /api/orders/order_123/get-status
```

---

## Next Steps

- [Pre-built Actions](/actions/prebuilt) - Ready-to-use actions
- [Workflows](/actions/workflows) - Multi-step operations
- [Saga Pattern](/actions/saga-pattern) - Distributed transactions
