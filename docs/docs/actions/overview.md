# Actions Overview

> 🔑 **Actions are custom operations attached to entities that go beyond standard CRUD.**

## Why Actions?

CRUD operations (Create, Read, Update, Delete) cover the basics, but real applications need more:

| Scenario | Why CRUD Isn't Enough | Action Solution |
|----------|----------------------|------------------|
| **User Verification** | `UPDATE user SET verified=true` exposes too much control | `POST /users/:id/verify` with business logic |
| **Order Checkout** | Multiple steps: inventory → payment → shipping | Workflow action with compensation |
| **Soft Delete** | Standard DELETE removes data permanently | Custom action sets `deletedAt` timestamp |
| **Publishing** | Need validation, notifications, audit trail | Action encapsulates all logic |

> 🟢 **Beginner Tip**: Think of actions as "business operations" that do more than just save data. They can send emails, charge payments, update related records, and enforce business rules—all in one API call.

---

## What Are Actions?

Actions are custom endpoints that:
- Attach to entities automatically  
- Have access to the service container, driver, and user context  
- Support input validation and authorization rules  
- Can be collection-level or resource-level  
- Support workflows with saga pattern compensation

```typescript
import { entity, action, string, bool } from "nevr"

const post = entity("post", {
  title: string,
  published: bool.default(false),
})
  .actions({
    // POST /api/posts/:id/publish
    publish: action()
      .onResource()
      .rules("owner")
      .handler(async (ctx) => {
        const updated = await ctx.driver.update("post",
          { id: ctx.resourceId },
          { published: true }
        )
        return { published: true, post: updated }
      }),
  })
```

---

## Action Types

### Collection Actions

Operations on the entire entity collection (no specific ID):

```typescript
.actions({
  // POST /api/users/invite
  invite: action()
    .input({ email: string.email() })
    .rules("authenticated")
    .handler(async (ctx) => {
      const { email } = ctx.input
      const token = generateToken()
      await sendInviteEmail(email, token)
      return { success: true, message: "Invitation sent" }
    }),

  // POST /api/products/import
  import: action()
    .input({ url: string.url() })
    .rules("admin")
    .handler(async (ctx) => {
      const products = await fetchProducts(ctx.input.url)
      const created = await ctx.driver.createMany("product", products)
      return { imported: created.length }
    }),

  // GET /api/orders/stats
  stats: action()
    .get()
    .rules("authenticated")
    .handler(async (ctx) => {
      const total = await ctx.driver.count("order")
      const pending = await ctx.driver.count("order", { status: "pending" })
      return { total, pending }
    }),
})
```

### Resource Actions

Operations on a specific resource (requires `:id`):

```typescript
.actions({
  // POST /api/posts/:id/publish
  publish: action()
    .onResource()
    .rules("owner")
    .handler(async (ctx) => {
      return ctx.driver.update("post",
        { id: ctx.resourceId },
        { published: true, publishedAt: new Date() }
      )
    }),

  // POST /api/users/:id/verify
  verify: action()
    .onResource()
    .input({ token: string })
    .handler(async (ctx) => {
      const user = await ctx.driver.findOne("user", { id: ctx.resourceId })
      if (!user) throw notFoundError("User not found")

      if (user.verificationToken !== ctx.input.token) {
        throw forbiddenError("Invalid token")
      }

      return ctx.driver.update("user",
        { id: ctx.resourceId },
        { verified: true, verificationToken: null }
      )
    }),

  // DELETE /api/posts/:id/soft
  softDelete: action()
    .onResource()
    .method("DELETE")
    .rules("owner")
    .handler(async (ctx) => {
      return ctx.driver.update("post",
        { id: ctx.resourceId },
        { deletedAt: new Date() }
      )
    }),
})
```

---

## ActionBuilder API

The `action()` function returns an `ActionBuilder` for fluent configuration:

### method()

Set the HTTP method:

```typescript
action().method("GET")     // GET request
action().method("POST")    // POST request (default)
action().method("PUT")     // PUT request
action().method("PATCH")   // PATCH request
action().method("DELETE")  // DELETE request
```

### get() / post()

Shorthand for HTTP methods:

```typescript
// Equivalent to method("GET")
action().get()

// Equivalent to method("POST") - default
action().post()
```

### onResource()

Mark as a resource action (requires `:id`):

```typescript
// Without onResource: POST /api/users/reset-password
action().handler(...)

// With onResource: POST /api/users/:id/reset-password
action().onResource().handler(...)
```

### rules()

Set authorization rules:

```typescript
// Single rule
action().rules("authenticated")

// Multiple rules (OR - any must pass)
action().rules("owner", "admin")

// Built-in rules
action().rules("everyone")       // No auth required
action().rules("authenticated")  // Must be logged in
action().rules("owner")          // Must own the resource
action().rules("admin")          // Must have admin role

// Custom rules
const premiumUser = defineRule("premium", async (ctx) => {
  return ctx.user?.subscription === "premium"
})

action().rules(premiumUser)
```

### input()

Define input schema with validation:

```typescript
action()
  .input({
    email: string.email("Invalid email"),
    password: string.min(8, "Password too short"),
    role: string.validate(
      (v) => ["user", "admin"].includes(v as string),
      "Invalid role"
    ).optional(),
  })
  .handler(async (ctx) => {
    // ctx.input is typed and validated
    const { email, password, role } = ctx.input
  })
```

### handler()

The action logic:

```typescript
action()
  .handler(async (ctx) => {
    // Your action logic
    return { success: true }
  })
```

### workflow()

Define a multi-step workflow with compensation:

```typescript
import { step } from "nevr"

action()
  .input({ paymentMethod: string })
  .workflow([
    step("reserve-inventory", async (ctx) => {
      return await ctx.resolve("inventory").reserve(ctx.input)
    }, async (ctx, result) => {
      // Compensation if later step fails
      await ctx.resolve("inventory").release(result)
    }),

    step("charge-payment", async (ctx) => {
      return await ctx.resolve("payments").charge(ctx.input)
    }, async (ctx, result) => {
      await ctx.resolve("payments").refund(result)
    }),

    step("create-order", async (ctx) => {
      return await ctx.driver.create("order", ctx.input)
    }),
  ], { useTransaction: true })
```

### meta()

Add metadata for documentation:

```typescript
action()
  .meta({
    summary: "Publish a post",
    description: "Makes the post visible to all users",
    tags: ["Posts", "Publishing"],
  })
  .handler(...)
```

---

## Multi-Entity Operations

> 🚀 **Entity-First: Zero API boilerplate for common patterns**

### .creates()

Create entities with auto-mapping from input:

```typescript
// Simple: Auto-maps matching input fields
action("sign-up")
  .post()
  .input({
    email: string.email(),
    name: string.optional(),
  })
  .creates("user")  // Auto-maps email, name from input
  .meta({ summary: "Create user account" })

// With custom data
action("sign-up")
  .post()
  .input({
    email: string.email(),
    password: string.min(8),
  })
  .creates("user")
  .creates("session", ctx => ({
    userId: ctx.results.user.id,  // Access previous results
    token: generateToken(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }))
```

### .updates()

Update entities:

```typescript
action("verify")
  .post()
  .onResource()
  .input({ token: string })
  .updates("user", ctx => ({
    emailVerified: true,
    verifiedAt: new Date(),
  }))
```

### .deletes()

Delete entities:

```typescript
action("revoke")
  .post()
  .onResource()
  .deletes("session")  // Deletes the session by resourceId
```

### .returns()

Configure what to return:

```typescript
// Return specific entity
action("sign-up")
  .creates("user")
  .creates("session")
  .returns("user")  // Only return user, not session

// Omit sensitive fields
action("sign-up")
  .creates("user")
  .returns("user", { omit: ["password", "secret"] })

// Pick specific fields
action("sign-up")
  .creates("user")
  .returns("user", { pick: ["id", "email", "name"] })

// Custom transform
action("sign-up")
  .creates("user")
  .creates("session")
  .returns((ctx) => ({
    user: ctx.results.user,
    token: ctx.results.session.token,
  }))
```

### Complete Example

```typescript
const user = entity("user", {
  email: string.email(),
  password: string.password(),
  name: string.optional(),
})
  .actions({
    signUp: action("sign-up")
      .post()
      .input({
        email: string.email().trim().lower(),
        password: string.min(8),
        name: string.optional(),
      })
      .creates("user")
      .creates("session", ctx => ({
        userId: ctx.results.user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }))
      .returns("user", { omit: ["password"] })
      .meta({
        summary: "Create user account",
        description: "Register with email/password, returns user and creates session",
        tags: ["Authentication"],
      }),
  })
  .build()
```

---

## Action Context

The `ctx` object passed to handlers:

```typescript
interface EntityActionContext<TInput> {
  /** Entity name */
  entity: string

  /** Action name */
  action: string

  /** Validated input data */
  input: TInput

  /** Resource ID (if onResource) */
  resourceId?: string

  /** The resource record (if onResource and found) */
  resource: Record<string, unknown> | null

  /** Current authenticated user */
  user: User | null

  /** Database driver */
  driver: Driver

  /** Resolve a service from container */
  resolve: <T>(serviceId: string) => T

  /** Async resolve a service */
  resolveAsync: <T>(serviceId: string) => Promise<T>

  /** Store data for workflow steps */
  set: <T>(key: string, value: T) => void

  /** Get data from previous workflow steps */
  get: <T>(key: string) => T | undefined
}
```

### Using Context

```typescript
.handler(async (ctx) => {
  // Access input (validated)
  const { email, password } = ctx.input

  // Access resource (for onResource actions)
  if (ctx.resourceId) {
    const post = await ctx.driver.findOne("post", { id: ctx.resourceId })
  }

  // Access current user
  if (!ctx.user) {
    throw unauthorizedError("Login required")
  }
  const userId = ctx.user.id

  // Use the driver
  const posts = await ctx.driver.findMany("post", {
    where: { authorId: userId },
  })

  // Resolve services
  const stripe = ctx.resolve<Stripe>("stripe")
  const mailer = ctx.resolve<MailerService>("mailer")

  // Store/retrieve workflow data
  ctx.set("chargeId", charge.id)
  const chargeId = ctx.get<string>("chargeId")

  return { success: true }
})
```

---

## HTTP Methods

Actions support all standard HTTP methods:

| Method | Use Case | Example |
|--------|----------|---------|
| `GET` | Read-only operations | Stats, export, check |
| `POST` | Create or trigger actions | Publish, invite, process |
| `PUT` | Full replacement | Bulk update |
| `PATCH` | Partial update | Toggle field |
| `DELETE` | Remove or soft-delete | Soft delete, revoke |

```typescript
.actions({
  // GET /api/posts/popular
  popular: action()
    .get()
    .handler(async (ctx) => {
      return ctx.driver.findMany("post", {
        where: { published: true },
        orderBy: { views: "desc" },
        take: 10,
      })
    }),

  // PUT /api/products/bulk
  bulkUpdate: action()
    .method("PUT")
    .input({ ids: json, data: json })
    .rules("admin")
    .handler(async (ctx) => {
      const { ids, data } = ctx.input
      for (const id of ids) {
        await ctx.driver.update("product", { id }, data)
      }
      return { updated: ids.length }
    }),

  // DELETE /api/sessions/:id/revoke
  revoke: action()
    .onResource()
    .method("DELETE")
    .rules("owner")
    .handler(async (ctx) => {
      await ctx.driver.delete("session", { id: ctx.resourceId })
      return { revoked: true }
    }),
})
```

---

## Route Generation

Actions generate routes based on their configuration:

| Configuration | Generated Route |
|--------------|-----------------|
| `action().handler(...)` | `POST /api/{entities}/{action}` |
| `action().get().handler(...)` | `GET /api/{entities}/{action}` |
| `action().onResource().handler(...)` | `POST /api/{entities}/:id/{action}` |
| `action().get().onResource().handler(...)` | `GET /api/{entities}/:id/{action}` |

### Examples

```typescript
const user = entity("user", { ... })
  .actions({
    invite: action().handler(...),           // POST /api/users/invite
    export: action().get().handler(...),     // GET /api/users/export
    verify: action().onResource().handler(...),  // POST /api/users/:id/verify
    profile: action().get().onResource().handler(...),  // GET /api/users/:id/profile
  })
```

---

## Error Handling

Use Nevr's error builders in actions:

```typescript
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
} from "nevr"

.handler(async (ctx) => {
  // Not found
  const post = await ctx.driver.findOne("post", { id: ctx.resourceId })
  if (!post) {
    throw notFoundError("Post not found")
  }

  // Forbidden
  if (post.authorId !== ctx.user?.id) {
    throw forbiddenError("You don't own this post")
  }

  // Conflict
  if (post.published) {
    throw conflictError("Post is already published")
  }

  // Validation
  if (ctx.input.title.length < 3) {
    throw validationError([
      { field: "title", message: "Title too short" }
    ])
  }

  return ctx.driver.update("post", { id: ctx.resourceId }, { published: true })
})
```

---

## With Services

Access registered services in actions:

```typescript
const api = nevr({ ... })

// Register services
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY))
api.registerService("mailer", () => new MailerService())
api.registerService("notifications", () => new NotificationService())

// Use in actions
const order = entity("order", { ... })
  .actions({
    checkout: action()
      .input({ paymentMethodId: string })
      .rules("authenticated")
      .handler(async (ctx) => {
        const stripe = ctx.resolve<Stripe>("stripe")
        const mailer = ctx.resolve<MailerService>("mailer")
        const notifications = ctx.resolve<NotificationService>("notifications")

        // Process payment
        const payment = await stripe.paymentIntents.create({
          amount: ctx.resource.total * 100,
          currency: "usd",
          payment_method: ctx.input.paymentMethodId,
          confirm: true,
        })

        // Update order
        const order = await ctx.driver.update("order",
          { id: ctx.resourceId },
          { status: "paid", paymentId: payment.id }
        )

        // Send confirmation
        await mailer.send("order-confirmation", ctx.user.email, { order })
        await notifications.push(ctx.user.id, "Order confirmed!")

        return order
      }),
  })
```

---

## Real-World Examples

### User Verification Flow

```typescript
const user = entity("user", {
  email: string.email().unique(),
  verified: bool.default(false),
  verificationToken: string.optional(),
})
  .actions({
    // POST /api/users/resend-verification
    resendVerification: action()
      .rules("authenticated")
      .handler(async (ctx) => {
        const token = generateSecureToken()
        await ctx.driver.update("user",
          { id: ctx.user.id },
          { verificationToken: token }
        )

        const mailer = ctx.resolve<MailerService>("mailer")
        await mailer.send("verification", ctx.user.email, { token })

        return { message: "Verification email sent" }
      }),

    // POST /api/users/:id/verify
    verify: action()
      .onResource()
      .input({ token: string })
      .handler(async (ctx) => {
        const user = await ctx.driver.findOne("user", { id: ctx.resourceId })

        if (!user) {
          throw notFoundError("User not found")
        }

        if (user.verificationToken !== ctx.input.token) {
          throw forbiddenError("Invalid verification token")
        }

        return ctx.driver.update("user",
          { id: ctx.resourceId },
          { verified: true, verificationToken: null }
        )
      }),
  })
```

### E-commerce Order Processing

```typescript
const order = entity("order", {
  status: string.default("pending"),
  items: json,
  total: float,
  customer: belongsTo(() => user),
})
  .ownedBy("customer")
  .actions({
    // POST /api/orders/:id/cancel
    cancel: action()
      .onResource()
      .rules("owner")
      .handler(async (ctx) => {
        const order = ctx.resource
        if (order.status === "shipped") {
          throw conflictError("Cannot cancel shipped orders")
        }

        const inventory = ctx.resolve<InventoryService>("inventory")
        await inventory.release(order.items)

        return ctx.driver.update("order",
          { id: ctx.resourceId },
          { status: "cancelled", cancelledAt: new Date() }
        )
      }),

    // POST /api/orders/:id/ship
    ship: action()
      .onResource()
      .input({ trackingNumber: string })
      .rules("admin")
      .handler(async (ctx) => {
        const order = ctx.resource
        if (order.status !== "paid") {
          throw conflictError("Order must be paid before shipping")
        }

        const updated = await ctx.driver.update("order",
          { id: ctx.resourceId },
          {
            status: "shipped",
            trackingNumber: ctx.input.trackingNumber,
            shippedAt: new Date(),
          }
        )

        const mailer = ctx.resolve<MailerService>("mailer")
        const customer = await ctx.driver.findOne("user", { id: order.customerId })
        await mailer.send("order-shipped", customer.email, {
          order: updated,
          trackingNumber: ctx.input.trackingNumber,
        })

        return updated
      }),

    // POST /api/orders/:id/refund
    refund: action()
      .onResource()
      .input({ reason: string, amount: float.optional() })
      .rules("admin")
      .handler(async (ctx) => {
        const stripe = ctx.resolve<Stripe>("stripe")
        const order = ctx.resource

        const refundAmount = ctx.input.amount || order.total

        await stripe.refunds.create({
          payment_intent: order.paymentId,
          amount: refundAmount * 100,
        })

        return ctx.driver.update("order",
          { id: ctx.resourceId },
          {
            status: "refunded",
            refundAmount,
            refundReason: ctx.input.reason,
            refundedAt: new Date(),
          }
        )
      }),
  })
```

### Content Publishing Workflow

```typescript
const article = entity("article", {
  title: string,
  content: text,
  status: string.default("draft"),
  author: belongsTo(() => user),
  reviewer: belongsTo(() => user).optional(),
})
  .ownedBy("author")
  .actions({
    // POST /api/articles/:id/submit
    submit: action()
      .onResource()
      .rules("owner")
      .handler(async (ctx) => {
        if (ctx.resource.status !== "draft") {
          throw conflictError("Only drafts can be submitted")
        }

        return ctx.driver.update("article",
          { id: ctx.resourceId },
          { status: "pending_review", submittedAt: new Date() }
        )
      }),

    // POST /api/articles/:id/approve
    approve: action()
      .onResource()
      .input({ notes: string.optional() })
      .rules("admin")
      .handler(async (ctx) => {
        return ctx.driver.update("article",
          { id: ctx.resourceId },
          {
            status: "approved",
            reviewerId: ctx.user.id,
            reviewNotes: ctx.input.notes,
            approvedAt: new Date(),
          }
        )
      }),

    // POST /api/articles/:id/reject
    reject: action()
      .onResource()
      .input({ reason: string })
      .rules("admin")
      .handler(async (ctx) => {
        const mailer = ctx.resolve<MailerService>("mailer")
        const author = await ctx.driver.findOne("user", {
          id: ctx.resource.authorId
        })

        await mailer.send("article-rejected", author.email, {
          article: ctx.resource,
          reason: ctx.input.reason,
        })

        return ctx.driver.update("article",
          { id: ctx.resourceId },
          {
            status: "rejected",
            reviewerId: ctx.user.id,
            rejectionReason: ctx.input.reason,
            rejectedAt: new Date(),
          }
        )
      }),

    // POST /api/articles/:id/publish
    publish: action()
      .onResource()
      .rules("admin")
      .handler(async (ctx) => {
        if (ctx.resource.status !== "approved") {
          throw conflictError("Article must be approved before publishing")
        }

        return ctx.driver.update("article",
          { id: ctx.resourceId },
          { status: "published", publishedAt: new Date() }
        )
      }),
  })
```

---

## Client Usage 🖥️

Actions are automatically available through the Nevr client. Here's how to call them from your frontend:

### Setup Client

```typescript
import { createTypedClient, entityClient } from "nevr/client"
import type { API } from "./server/api"

const api = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [entityClient({ entities: ["user", "post", "product"] })],
})
```

### Call Collection Actions

```typescript
// Collection action (no resource ID)
const result = await client.users.action("bulkProcess", {
  ids: ["user_1", "user_2", "user_3"],
})

// With custom input
const stats = await client.orders.action("exportReport", {
  startDate: "2024-01-01",
  format: "csv",
})
```

### Call Resource Actions

```typescript
// Resource action (with ID)
await client.orders.action("cancel", "order_123", {
  reason: "Customer request",
})

// Or using the HTTP API
await fetch("/api/orders/order_123/cancel", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ reason: "Customer request" }),
})
```

### React Integration

```tsx
import { client } from "./lib/client"

function OrderActions({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    setLoading(true)
    try {
      await client.orders.action("cancel", orderId, {
        reason: "User cancelled",
      })
      toast.success("Order cancelled!")
    } catch (error) {
      toast.error("Failed to cancel order")
    }
    setLoading(false)
  }

  return (
    <button onClick={handleCancel} disabled={loading}>
      {loading ? "Cancelling..." : "Cancel Order"}
    </button>
  )
}
```

### HTTP API Reference

| Action Type | HTTP Endpoint | Method |
|-------------|---------------|--------|
| Collection | `/api/{entity}/{action-name}` | POST (default) |
| Resource | `/api/{entity}/:id/{action-name}` | POST (default) |
| GET Resource | `/api/{entity}/:id/{action-name}` | GET |

```bash
# Collection action
POST /api/users/bulk-process
{"ids": ["user_1", "user_2"]}

# Resource action  
POST /api/orders/order_123/cancel
{"reason": "Customer request"}

# GET action
GET /api/users/user_123/stats
```

---

## Next Steps

- [Creating Actions](/actions/creating) - Detailed action patterns
- [Pre-built Actions](/actions/prebuilt) - Ready-to-use actions
- [Workflows](/actions/workflows) - Multi-step operations with compensation
- [Saga Pattern](/actions/saga-pattern) - Distributed transactions
