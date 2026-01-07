# Custom Endpoints

Build custom API endpoints with multi-entity transactions, route mapping, and entity operations.

---

## Overview

Custom endpoints let you:
- Execute multiple entity operations atomically
- Map public routes to internal entity operations
- Build complex business logic endpoints
- Handle cross-entity transactions

---

## transaction()

Execute multiple entity operations atomically. If one fails, all roll back.

```typescript
import { transaction } from "nevr"

const signUpHandler = transaction({
  atomic: true,
  operations: [
    {
      entity: "user",
      operation: "create",
      data: (ctx) => ({
        email: ctx.body.email,
        password: ctx.body.password,
      }),
    },
    {
      entity: "profile",
      operation: "create",
      data: (ctx) => ({
        userId: ctx.results.user.id,  // Access previous result
        displayName: ctx.body.name,
      }),
    },
    {
      entity: "settings",
      operation: "create",
      data: (ctx) => ({
        userId: ctx.results.user.id,
        theme: "light",
        notifications: true,
      }),
    },
  ],
})
```

### TransactionConfig

```typescript
interface TransactionConfig {
  /** Operations to execute in order */
  operations: EntityOperation[]

  /** If true, all operations must succeed or all fail */
  atomic?: boolean

  /** Custom error handler */
  onError?: (error: Error, ctx: EndpointContext) => void | Promise<void>

  /** Called after all operations complete */
  onSuccess?: (results: Record<string, unknown>, ctx: EndpointContext) => void | Promise<void>
}
```

### EntityOperation

```typescript
interface EntityOperation<TEntity extends string = string> {
  /** Target entity name */
  entity: TEntity

  /** Operation type */
  operation: "create" | "update" | "delete" | "read" | "list"

  /** Data for create/update (static or function) */
  data?: Record<string, unknown> | ((ctx: EndpointContext) => Record<string, unknown>)

  /** Where clause for update/delete/read */
  where?: Record<string, unknown> | ((ctx: EndpointContext) => Record<string, unknown>)

  /** Transform the result */
  transform?: (result: unknown, ctx: EndpointContext) => unknown

  /** Condition to run this operation */
  condition?: (ctx: EndpointContext) => boolean
}
```

---

## Operation Types

### Create

```typescript
{
  entity: "user",
  operation: "create",
  data: (ctx) => ({
    email: ctx.body.email,
    name: ctx.body.name,
  }),
}
```

### Update

```typescript
{
  entity: "user",
  operation: "update",
  where: (ctx) => ({ id: ctx.params.id }),
  data: (ctx) => ({
    name: ctx.body.name,
    updatedAt: new Date(),
  }),
}
```

### Delete

```typescript
{
  entity: "session",
  operation: "delete",
  where: (ctx) => ({ userId: ctx.user.id }),
}
```

### Read (Single)

```typescript
{
  entity: "user",
  operation: "read",
  where: (ctx) => ({ id: ctx.params.id }),
}
```

### List (Multiple)

```typescript
{
  entity: "order",
  operation: "list",
  where: (ctx) => ({ userId: ctx.user.id }),
}
```

---

## Accessing Previous Results

Use `ctx.results` to access results from earlier operations:

```typescript
transaction({
  atomic: true,
  operations: [
    // Step 1: Create user
    {
      entity: "user",
      operation: "create",
      data: (ctx) => ({ email: ctx.body.email }),
    },
    // Step 2: Create profile with user ID
    {
      entity: "profile",
      operation: "create",
      data: (ctx) => ({
        userId: ctx.results.user.id,  // From step 1
        bio: ctx.body.bio,
      }),
    },
    // Step 3: Create wallet with user ID
    {
      entity: "wallet",
      operation: "create",
      data: (ctx) => ({
        userId: ctx.results.user.id,  // From step 1
        balance: 0,
      }),
    },
  ],
})
```

---

## Conditional Operations

Run operations based on conditions:

```typescript
transaction({
  operations: [
    {
      entity: "user",
      operation: "create",
      data: (ctx) => ({ email: ctx.body.email }),
    },
    {
      entity: "subscription",
      operation: "create",
      condition: (ctx) => ctx.body.plan !== "free",  // Only if paid plan
      data: (ctx) => ({
        userId: ctx.results.user.id,
        plan: ctx.body.plan,
        startsAt: new Date(),
      }),
    },
    {
      entity: "referral",
      operation: "create",
      condition: (ctx) => !!ctx.body.referralCode,  // Only if referral
      data: (ctx) => ({
        userId: ctx.results.user.id,
        code: ctx.body.referralCode,
      }),
    },
  ],
})
```

---

## mapRoute()

Map a public endpoint to entity operations with validation and response formatting:

```typescript
import { mapRoute } from "nevr"

const signUpRoute = mapRoute({
  path: "/sign-up",
  method: "POST",
  description: "Create a new user account",

  // Validate input
  validate: (body) => {
    const errors: string[] = []
    if (!body.email) errors.push("Email required")
    if (!body.password) errors.push("Password required")
    return { valid: errors.length === 0, errors }
  },

  // Entity operations
  operations: [
    {
      entity: "user",
      operation: "create",
      data: (ctx) => ({
        email: ctx.body.email,
        password: hashPassword(ctx.body.password),
      }),
    },
    {
      entity: "profile",
      operation: "create",
      data: (ctx) => ({
        userId: ctx.results.user.id,
        displayName: ctx.body.name || ctx.body.email.split("@")[0],
      }),
    },
  ],

  // Format response
  response: {
    entity: "user",
    omit: ["password"],  // Never return password
  },
})
```

### RouteMapping

```typescript
interface RouteMapping {
  /** Public endpoint path */
  path: string

  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

  /** Description for documentation */
  description?: string

  /** Entity operations (single or array) */
  operations: EntityOperation | EntityOperation[]

  /** Wrap in transaction (default: true for multiple) */
  atomic?: boolean

  /** Input validation */
  validate?: (body: unknown) => { valid: boolean; errors?: string[] }

  /** Response formatting */
  response?: {
    entity?: string        // Which entity result to return
    pick?: string[]        // Fields to include
    omit?: string[]        // Fields to exclude
    transform?: (results: Record<string, unknown>) => unknown
  }
}
```

---

## Response Formatting

### Return Specific Entity

```typescript
response: {
  entity: "user",  // Return only user result
}
```

### Pick Fields

```typescript
response: {
  entity: "user",
  pick: ["id", "email", "name"],  // Only these fields
}
```

### Omit Fields

```typescript
response: {
  entity: "user",
  omit: ["password", "internalId"],  // Exclude these
}
```

### Custom Transform

```typescript
response: {
  transform: (results) => ({
    user: results.user,
    profile: results.profile,
    message: "Account created successfully",
  }),
}
```

---

## EntityContext

For manual entity operations in handlers:

```typescript
import { createEntityContext } from "nevr"

const handler = async (ctx: EndpointContext) => {
  const entities = createEntityContext(ctx.context.driver)

  // Create
  const user = await entities.create("user", { email: "test@test.com" })

  // Read
  const found = await entities.findOne("user", { id: user.id })

  // List
  const users = await entities.findMany("user", { role: "admin" })

  // Update
  const updated = await entities.update("user", { id: user.id }, { name: "New Name" })

  // Delete
  await entities.delete("user", { id: user.id })

  // Transaction
  const result = await entities.transaction(async (tx) => {
    const user = await tx.create("user", { email: "a@b.com" })
    const profile = await tx.create("profile", { userId: user.id })
    return { user, profile }
  })

  return result
}
```

### EntityContext Interface

```typescript
interface EntityContext {
  create: <T>(entity: string, data: Record<string, unknown>) => Promise<T>
  findOne: <T>(entity: string, where: Record<string, unknown>) => Promise<T | null>
  findMany: <T>(entity: string, where?: Record<string, unknown>) => Promise<T[]>
  update: <T>(entity: string, where: Record<string, unknown>, data: Record<string, unknown>) => Promise<T>
  delete: (entity: string, where: Record<string, unknown>) => Promise<void>
  transaction: <T>(fn: (ctx: EntityContext) => Promise<T>) => Promise<T>
}
```

---

## Input/Output Filtering

Filter fields based on plugin field definitions:

```typescript
import { filterInput, filterOutput } from "nevr"

// Remove fields where input: false (protected)
const safeInput = filterInput(ctx.body, entityFields)

// Remove fields where returned: false (sensitive)
const safeOutput = filterOutput(result, entityFields)
```

---

## Using the Underlying Framework

Since Nevr mounts as a router, you can define custom routes alongside:

### Express

```typescript
import express from "express"
import { expressAdapter } from "nevr"

const app = express()

// Nevr CRUD routes
app.use("/api", expressAdapter(api))

// Custom endpoint using transaction
app.post("/api/signup", async (req, res) => {
  const handler = transaction({
    atomic: true,
    operations: [
      { entity: "user", operation: "create", data: () => req.body },
      { entity: "profile", operation: "create", data: (ctx) => ({
        userId: ctx.results.user.id,
      })},
    ],
  })

  try {
    const result = await handler({ body: req.body, context: { driver: api.getDriver() } })
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
```

### Hono

```typescript
import { Hono } from "hono"
import { honoAdapter } from "nevr"

const app = new Hono()

// Nevr CRUD routes
app.route("/api", honoAdapter(api))

// Custom endpoint
app.post("/api/signup", async (c) => {
  const body = await c.req.json()
  // Use transaction or EntityContext
  return c.json({ success: true })
})
```

---

## Real-World Examples

### User Registration

```typescript
const registerRoute = mapRoute({
  path: "/register",
  method: "POST",
  atomic: true,
  operations: [
    {
      entity: "user",
      operation: "create",
      data: (ctx) => ({
        email: ctx.body.email,
        password: hashPassword(ctx.body.password),
        verified: false,
        verificationToken: generateToken(),
      }),
    },
    {
      entity: "profile",
      operation: "create",
      data: (ctx) => ({
        userId: ctx.results.user.id,
        displayName: ctx.body.name,
      }),
    },
  ],
  onSuccess: async (results) => {
    await sendVerificationEmail(results.user.email, results.user.verificationToken)
  },
  response: {
    entity: "user",
    omit: ["password", "verificationToken"],
  },
})
```

### E-commerce Checkout

```typescript
const checkoutRoute = mapRoute({
  path: "/checkout",
  method: "POST",
  atomic: true,
  validate: (body) => {
    if (!body.items?.length) return { valid: false, errors: ["Cart empty"] }
    return { valid: true }
  },
  operations: [
    {
      entity: "order",
      operation: "create",
      data: (ctx) => ({
        userId: ctx.user.id,
        status: "pending",
        total: calculateTotal(ctx.body.items),
      }),
    },
    {
      entity: "payment",
      operation: "create",
      data: (ctx) => ({
        orderId: ctx.results.order.id,
        amount: ctx.results.order.total,
        status: "pending",
      }),
    },
  ],
  response: {
    transform: (results) => ({
      orderId: results.order.id,
      paymentId: results.payment.id,
    }),
  },
})
```

### Soft Delete with Cascade

```typescript
const deleteAccountRoute = mapRoute({
  path: "/account",
  method: "DELETE",
  atomic: true,
  operations: [
    {
      entity: "user",
      operation: "update",
      where: (ctx) => ({ id: ctx.user.id }),
      data: () => ({ deletedAt: new Date() }),
    },
    {
      entity: "session",
      operation: "delete",
      where: (ctx) => ({ userId: ctx.user.id }),
    },
  ],
  response: {
    transform: () => ({ success: true }),
  },
})
```

---

## Error Handling

```typescript
transaction({
  operations: [...],
  onError: async (error, ctx) => {
    console.error(`Transaction failed: ${error.message}`)
    await alertService.send({ type: "error", message: error.message })
  },
})
```

---

## Next Steps

- [Actions](/actions/overview) - Entity-level custom operations
- [Workflows](/actions/workflows) - Multi-step with saga pattern
- [Transactions](/database/transactions) - Database transactions
