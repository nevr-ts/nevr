# Entity Actions

Actions are custom operations beyond CRUD that you can attach to entities. They're perfect for business logic like "verify email", "checkout", "publish", or "archive".

## Basic Action

```typescript
import { entity, action, string } from "nevr"

const user = entity("user", {
  email: string,
  verified: boolean.default(false),
}).actions({
  verify: action()
    .onResource()
    .handler(async (ctx) => {
      await ctx.driver.update("user", { id: ctx.resourceId }, { verified: true })
      return { success: true }
    }),
})
```

**Generated Route:** `POST /users/:id/verify`

## Action Builder API

The `action()` function returns a fluent builder:

```typescript
action()
  .method("POST")        // HTTP method (default: POST)
  .get()                 // Shorthand for .method("GET")
  .post()                // Shorthand for .method("POST")
  .onResource()          // Requires :id param
  .rules("authenticated", "owner")  // Authorization
  .input({ code: string })          // Input validation
  .handler(async (ctx) => {...})    // Handler function
  .workflow([...])                  // Workflow steps
  .meta({ summary: "..." })         // OpenAPI metadata
```

## Action Types

### Collection Actions (No ID)

```typescript
// POST /users/invite
invite: action()
  .input({ email: string })
  .handler(async (ctx) => {
    // Send invite email
    return { sent: true }
  })
```

### Resource Actions (With ID)

```typescript
// POST /users/:id/verify
verify: action()
  .onResource()
  .handler(async (ctx) => {
    // ctx.resourceId is available
    // ctx.resource is the fetched entity
    return { verified: true }
  })
```

### GET Actions

```typescript
// GET /orders/:id/track
track: action()
  .get()
  .onResource()
  .handler(async (ctx) => {
    const tracking = await ctx.resolve("shipping").getTracking(ctx.resource.shipmentId)
    return tracking
  })
```

## Action Context

The handler receives an `EntityActionContext`:

```typescript
interface EntityActionContext<TInput> {
  entity: string              // Entity name
  action: string              // Action name
  input: TInput               // Validated input
  resourceId?: string         // ID from URL params
  resource?: Record<string, unknown>  // Fetched entity (if onResource)
  user: User | null           // Authenticated user
  driver: Driver              // Database driver
  resolve: <T>(id: string) => T       // Service container
  resolveAsync: <T>(id: string) => Promise<T>
  set: (key: string, value: any) => void  // Workflow data
  get: (key: string) => any               // Workflow data
}
```

## Input Validation

Define input schema with field builders:

```typescript
import { string, int, boolean } from "nevr"

checkout: action()
  .input({
    paymentMethodId: string,
    quantity: int.min(1),
    giftWrap: boolean.default(false),
  })
  .handler(async (ctx) => {
    const { paymentMethodId, quantity, giftWrap } = ctx.input
    // Input is validated and typed
  })
```

## Authorization Rules

```typescript
// Only authenticated users
publish: action()
  .onResource()
  .rules("authenticated")
  .handler(...)

// Only the owner
delete: action()
  .onResource()
  .rules("authenticated", "owner")
  .handler(...)

// Only admins
ban: action()
  .onResource()
  .rules("admin")
  .handler(...)
```

## Using Services

Access registered services via `ctx.resolve()`:

```typescript
sendVerification: action()
  .onResource()
  .handler(async (ctx) => {
    const mailer = ctx.resolve("mailer")
    const token = ctx.resolve("crypto").generateToken()

    await mailer.send({
      to: ctx.resource.email,
      subject: "Verify your email",
      body: `Click here: /verify?token=${token}`,
    })

    return { sent: true }
  })
```

## Pre-built Actions

Nevr provides common actions out of the box:

```typescript
import {
  softDeleteAction,
  restoreAction,
  archiveAction,
  unarchiveAction,
  cloneAction,
  bulkUpdateAction,
  bulkDeleteAction,
  toggleAction,
  exportAction,
  countAction,
  existsAction,
} from "nevr/plugins/core/actions"

const post = entity("post", {...}).actions({
  softDelete: softDeleteAction(),        // POST /:id/soft
  restore: restoreAction(),              // POST /:id/restore
  archive: archiveAction(),              // POST /:id/archive
  clone: cloneAction(),                  // POST /:id/clone
  bulkUpdate: bulkUpdateAction(),        // PUT /bulk
  bulkDelete: bulkDeleteAction(),        // DELETE /bulk
  togglePublished: toggleAction("published"),  // POST /:id/toggle-published
  export: exportAction(),                // GET /export
  count: countAction(),                  // GET /count
  exists: existsAction(),                // GET /:id/exists
})
```

## OpenAPI Metadata

Add metadata for documentation:

```typescript
verify: action()
  .onResource()
  .meta({
    summary: "Verify user email",
    description: "Marks the user's email as verified after token validation",
    tags: ["Authentication"],
  })
  .handler(...)
```

## Multiple Actions

```typescript
const post = entity("post", {
  title: string,
  status: string.default("draft"),
}).actions({
  publish: action()
    .onResource()
    .rules("owner")
    .handler(async (ctx) => {
      await ctx.driver.update("post", { id: ctx.resourceId }, { status: "published" })
      return { published: true }
    }),

  unpublish: action()
    .onResource()
    .rules("owner")
    .handler(async (ctx) => {
      await ctx.driver.update("post", { id: ctx.resourceId }, { status: "draft" })
      return { unpublished: true }
    }),

  duplicate: action()
    .onResource()
    .rules("owner")
    .handler(async (ctx) => {
      const { id, createdAt, updatedAt, ...data } = ctx.resource
      const copy = await ctx.driver.create("post", { ...data, title: `${data.title} (Copy)` })
      return copy
    }),
})
```

## Next Steps

- [Workflows](/guide/workflows) - Multi-step actions with compensation
- [Service Container](/guide/services) - Dependency injection
- [Authorization](/entities/authorization) - Access control rules
