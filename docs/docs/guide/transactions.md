# Transactions

Nevr supports multi-entity transactions for atomic operations. All operations succeed together or fail together.

## Why Transactions?

Consider user registration that creates multiple records:

```typescript
// Without transaction - partial failure possible
await driver.create("user", { email, password })
await driver.create("profile", { userId, name })      // If this fails...
await driver.create("settings", { userId, theme })    // User exists without profile!
```

With transactions:

```typescript
// All succeed or all fail
await transaction({
  atomic: true,
  operations: [
    { entity: "user", operation: "create", data: { email, password } },
    { entity: "profile", operation: "create", data: (ctx) => ({ userId: ctx.results.user.id }) },
    { entity: "settings", operation: "create", data: (ctx) => ({ userId: ctx.results.user.id }) },
  ],
})
```

## Using the transaction() Function

### Basic Transaction

```typescript
import { transaction } from "nevr/plugins/core/endpoint"

const createUserWithProfile = transaction({
  atomic: true,
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
        userId: ctx.results.user.id,  // Access previous result
        displayName: ctx.body.name,
      }),
    },
  ],
})

// Use in endpoint handler
const result = await createUserWithProfile(endpointContext)
```

### Operation Types

```typescript
// Create
{
  entity: "user",
  operation: "create",
  data: { email: "john@example.com" },
}

// Read
{
  entity: "user",
  operation: "read",
  where: { id: "123" },
}

// List
{
  entity: "user",
  operation: "list",
  where: { role: "admin" },
}

// Update
{
  entity: "user",
  operation: "update",
  where: { id: "123" },
  data: { verified: true },
}

// Delete
{
  entity: "user",
  operation: "delete",
  where: { id: "123" },
}
```

### Dynamic Data

Use functions for data that depends on context or previous operations:

```typescript
transaction({
  operations: [
    {
      entity: "order",
      operation: "create",
      data: (ctx) => ({
        customerId: ctx.body.customerId,
        total: ctx.body.items.reduce((sum, i) => sum + i.price, 0),
      }),
    },
    {
      entity: "orderItem",
      operation: "create",
      data: (ctx) => ({
        orderId: ctx.results.order.id,  // From previous operation
        items: JSON.stringify(ctx.body.items),
      }),
    },
  ],
})
```

### Conditional Operations

Skip operations based on conditions:

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
      condition: (ctx) => ctx.body.plan !== "free",  // Only for paid plans
      data: (ctx) => ({
        userId: ctx.results.user.id,
        plan: ctx.body.plan,
      }),
    },
  ],
})
```

### Transform Results

Transform operation results:

```typescript
transaction({
  operations: [
    {
      entity: "user",
      operation: "create",
      data: { email: "john@example.com", password: "hashed" },
      transform: (result) => {
        // Remove sensitive fields
        const { password, ...safe } = result
        return safe
      },
    },
  ],
})
```

## Transaction Callbacks

### onSuccess

Called when all operations complete:

```typescript
transaction({
  operations: [...],
  onSuccess: async (results, ctx) => {
    // Send welcome email
    const mailer = ctx.context.resolve("mailer")
    await mailer.send({
      to: results.user.email,
      subject: "Welcome!",
    })
  },
})
```

### onError

Called when any operation fails:

```typescript
transaction({
  operations: [...],
  onError: async (error, ctx) => {
    // Log error, notify admins, etc.
    console.error("Transaction failed:", error)

    const alerter = ctx.context.resolve("alerter")
    await alerter.notify("Transaction failed: " + error.message)
  },
})
```

## Route Mapping

Use `mapRoute` to create endpoints from transactions:

```typescript
import { mapRoute } from "nevr/plugins/core/endpoint"

// Simple: Single operation
const createUser = mapRoute({
  path: "/sign-up",
  method: "POST",
  operations: {
    entity: "user",
    operation: "create",
    data: (ctx) => ({
      email: ctx.body.email,
      password: hashPassword(ctx.body.password),
    }),
  },
  response: {
    entity: "user",
    omit: ["password"],  // Don't return password
  },
})

// Complex: Multiple operations
const fullSignUp = mapRoute({
  path: "/sign-up",
  method: "POST",
  atomic: true,
  operations: [
    { entity: "user", operation: "create", data: (ctx) => ({ ... }) },
    { entity: "profile", operation: "create", data: (ctx) => ({ ... }) },
    { entity: "settings", operation: "create", data: (ctx) => ({ ... }) },
  ],
  response: {
    transform: (results) => ({
      user: results.user,
      profile: results.profile,
    }),
  },
})
```

### Route with Validation

```typescript
mapRoute({
  path: "/sign-up",
  method: "POST",
  validate: (body) => {
    const errors = []
    if (!body.email?.includes("@")) errors.push("Invalid email")
    if (body.password?.length < 8) errors.push("Password too short")
    return { valid: errors.length === 0, errors }
  },
  operations: { ... },
})
```

### Response Formatting

```typescript
// Return specific entity
response: {
  entity: "user",
}

// Pick specific fields
response: {
  entity: "user",
  pick: ["id", "email", "createdAt"],
}

// Omit sensitive fields
response: {
  entity: "user",
  omit: ["password", "apiKey"],
}

// Custom transform
response: {
  transform: (results) => ({
    success: true,
    userId: results.user.id,
    profileId: results.profile.id,
  }),
}
```

## Entity Context

For direct entity operations in handlers:

```typescript
import { createEntityContext } from "nevr/plugins/core/endpoint"

const handler = async (ctx) => {
  const entities = createEntityContext(ctx.driver)

  // Simple operations
  const user = await entities.create("user", { email: "..." })
  const profile = await entities.findOne("profile", { userId: user.id })

  // Transactional operations
  const result = await entities.transaction(async (tx) => {
    const order = await tx.create("order", { ... })
    await tx.create("orderItem", { orderId: order.id, ... })
    return order
  })
}
```

### EntityContext API

```typescript
interface EntityContext {
  create<T>(entity: string, data: Record<string, unknown>): Promise<T>
  findOne<T>(entity: string, where: Record<string, unknown>): Promise<T | null>
  findMany<T>(entity: string, where?: Record<string, unknown>): Promise<T[]>
  update<T>(entity: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<T>
  delete(entity: string, where: Record<string, unknown>): Promise<void>
  transaction<T>(fn: (ctx: EntityContext) => Promise<T>): Promise<T>
}
```

## Input/Output Filtering

Automatically filter protected and hidden fields:

```typescript
import { filterInput, filterOutput } from "nevr/plugins/core/endpoint"

// Field definitions
const userFields = {
  email: { type: "string", required: true },
  password: { type: "string", returned: false },      // Never returned
  role: { type: "string", input: false },             // Protected from input
  apiKey: { type: "string", input: false, returned: false },  // Secret
}

// Filter client input (removes protected fields)
const safeInput = filterInput(ctx.body, userFields)
// { email: "..." } - password allowed, role filtered out

// Filter output (removes hidden fields)
const safeOutput = filterOutput(user, userFields)
// { id, email, role } - password and apiKey removed
```

## Complete Example

User registration with profile, settings, and welcome email:

```typescript
import { mapRoute, transaction } from "nevr/plugins/core/endpoint"

const signUpEndpoint = mapRoute({
  path: "/auth/sign-up",
  method: "POST",
  description: "Create new user account",
  atomic: true,

  validate: (body) => {
    const errors = []
    if (!body.email?.includes("@")) errors.push("Invalid email")
    if (body.password?.length < 8) errors.push("Password must be 8+ characters")
    if (!body.name?.trim()) errors.push("Name is required")
    return { valid: errors.length === 0, errors }
  },

  operations: [
    // 1. Create user
    {
      entity: "user",
      operation: "create",
      data: (ctx) => ({
        email: ctx.body.email.toLowerCase(),
        password: hashPassword(ctx.body.password),
      }),
    },

    // 2. Create profile
    {
      entity: "profile",
      operation: "create",
      data: (ctx) => ({
        userId: ctx.results.user.id,
        displayName: ctx.body.name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${ctx.body.email}`,
      }),
    },

    // 3. Create settings
    {
      entity: "settings",
      operation: "create",
      data: (ctx) => ({
        userId: ctx.results.user.id,
        theme: "light",
        notifications: true,
      }),
    },

    // 4. Create subscription (if not free plan)
    {
      entity: "subscription",
      operation: "create",
      condition: (ctx) => ctx.body.plan && ctx.body.plan !== "free",
      data: (ctx) => ({
        userId: ctx.results.user.id,
        plan: ctx.body.plan,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }),
    },
  ],

  response: {
    transform: (results) => ({
      user: {
        id: results.user.id,
        email: results.user.email,
      },
      profile: results.profile,
      message: "Account created successfully",
    }),
  },
})

// Register in Nevr
const api = nevr({
  entities: [User, Profile, Settings, Subscription],
  driver: prisma(new PrismaClient()),
  endpoints: [signUpEndpoint],
})
```

## Best Practices

1. **Always use atomic: true** for related data
2. **Validate before transaction** - Fail fast on invalid input
3. **Handle partial data** - Use conditions for optional operations
4. **Transform sensitive data** - Filter passwords, API keys in responses
5. **Use callbacks** - Send emails, notifications after success

## Next Steps

- [Actions](/guide/actions) - Entity-specific actions
- [Workflows](/guide/workflows) - Multi-step with compensation
- [Services](/guide/services) - Dependency injection
