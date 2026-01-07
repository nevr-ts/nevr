# Authorization Rules

> 🛡️ **Declarative, rule-based access control for your entities.**

## Why Rule-Based Auth?

### The Problem: Controller Spaghetti

| Logic | Traditional approach | Nevr Rules |
|-------|----------------------|------------|
| **Can Update?** | `if (user.id === post.authorId OR user.role === 'admin')` in every controller | `.rules({ update: ["owner", "admin"] })` |
| **Can Delete?** | `if (user.role === 'admin')` scattered everywhere | `.rules({ delete: ["admin"] })` |
| **Consistency** | Hard to maintain sync | Single source of truth |

> 🟢 **Beginner Tip**: Start with `.ownedBy("author")`—it handles the most common case (users own their data) automatically.

> 🔴 **Advanced**: Combine predefined rules with custom `defineRule()` logic for complex, multi-tenant permission systems.




## Basic Rules

Define rules using the `.rules()` method:

```typescript
const post = entity("post", {
  title: string,
  content: text,
  author: belongsTo(() => user),
})
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner"],
    delete: ["owner", "admin"],
  })
```

## Operations

| Operation | Description | HTTP Method |
|-----------|-------------|-------------|
| `create` | Creating new records | POST |
| `read` | Reading single record by ID | GET /:id |
| `update` | Updating existing records | PUT/PATCH |
| `delete` | Deleting records | DELETE |
| `list` | Listing/querying records | GET |

## Built-in Rules

### everyone

Allows access without authentication.

```typescript
.rules({
  read: ["everyone"],  // Anyone can read
  list: ["everyone"],  // Anyone can list
})
```

**Use cases:**
- Public content (blog posts, products)
- Landing pages
- Public API endpoints

---

### authenticated

Requires a logged-in user.

```typescript
.rules({
  create: ["authenticated"],  // Must be logged in to create
})
```

**Use cases:**
- Creating content
- Accessing user-specific features
- Protected resources

---

### owner

Requires the current user to own the record. Works with `ownedBy()`.

```typescript
const post = entity("post", {
  author: belongsTo(() => user),
})
  .ownedBy("author")  // Sets authorId as owner field
  .rules({
    update: ["owner"],  // Only author can update
    delete: ["owner"],  // Only author can delete
  })
```

**How it works:**
1. `ownedBy("author")` sets the owner field to `authorId`
2. `owner` rule compares `record.authorId` with `currentUser.id`
3. Access granted only if they match

---

### admin

Requires the user to have admin role.

```typescript
.rules({
  delete: ["admin"],  // Only admins can delete
})
```

**Determination:**
- Checks `user.role === "admin"` or `user.isAdmin === true`
- Configure via auth plugin or custom logic

## Rule Composition

### Multiple Rules (OR Logic)

When multiple rules are specified, access is granted if **any** rule passes:

```typescript
.rules({
  // Owner OR admin can update
  update: ["owner", "admin"],

  // Owner OR admin can delete
  delete: ["owner", "admin"],
})
```

### Different Rules per Operation

```typescript
.rules({
  create: ["authenticated"],      // Any logged-in user
  read: ["everyone"],             // Public
  update: ["owner"],              // Only owner
  delete: ["owner", "admin"],     // Owner or admin
  list: ["authenticated"],        // Logged-in users only
})
```

## Custom Rules

Define custom rules as functions for complex authorization logic:

```typescript
import { defineRule } from "nevr"

// Role-based rule
const moderator = defineRule("moderator", (ctx) => {
  return ctx.user?.role === "moderator" || ctx.user?.role === "admin"
})

// Subscription-based rule
const premiumUser = defineRule("premium", async (ctx) => {
  if (!ctx.user) return false
  const subscription = await ctx.driver.findOne("subscription", {
    where: { userId: ctx.user.id, status: "active" }
  })
  return subscription?.plan === "premium"
})

// Time-based rule
const businessHours = defineRule("businessHours", () => {
  const hour = new Date().getHours()
  return hour >= 9 && hour < 17
})

// Use custom rules
const document = entity("document", { ... })
  .rules({
    read: ["authenticated", moderator],
    create: [premiumUser],
    update: ["owner", moderator],
  })
```

### Rule Context

Custom rules receive a context object:

```typescript
interface RuleContext {
  user: {
    id: string
    role?: string
    [key: string]: unknown
  } | null
  record: Record<string, unknown> | null  // The record being accessed
  operation: "create" | "read" | "update" | "delete" | "list"
  driver: DatabaseDriver  // For additional queries
}
```

### Async Rules

Rules can be async for database lookups:

```typescript
const teamMember = defineRule("teamMember", async (ctx) => {
  if (!ctx.user || !ctx.record) return false

  const membership = await ctx.driver.findOne("teamMember", {
    where: {
      userId: ctx.user.id,
      teamId: ctx.record.teamId,
    }
  })

  return !!membership
})
```

## ownedBy Shorthand

The `ownedBy()` method simplifies owner-based authorization:

```typescript
// This...
const post = entity("post", {
  author: belongsTo(() => user),
})
  .ownedBy("author")

// Is equivalent to:
const post = entity("post", {
  author: belongsTo(() => user),
})
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner"],
    delete: ["owner"],
    list: ["everyone"],
  })
```

**Override specific rules:**
```typescript
const post = entity("post", { ... })
  .ownedBy("author")
  .rules({
    delete: ["owner", "admin"],  // Add admin to delete
    list: ["authenticated"],     // Restrict list
  })
```

## Field-Level vs Entity-Level

| Level | Scope | Use Case |
|-------|-------|----------|
| Entity | Entire record | CRUD operations |
| Field | Single field | Sensitive data within records |

```typescript
const user = entity("user", {
  name: string,
  email: string.readable("authenticated"),  // Field-level
  salary: float.adminOnly(),                // Field-level
})
  .rules({
    read: ["everyone"],  // Entity-level: can read user records
    // But email is only visible to authenticated users
    // And salary is only visible to admins
  })
```

## Common Patterns

### Public Read, Protected Write

```typescript
const article = entity("article", { ... })
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner", "editor"],
    delete: ["owner", "admin"],
    list: ["everyone"],
  })
```

### Admin-Only Entity

```typescript
const auditLog = entity("auditLog", { ... })
  .rules({
    create: ["admin"],
    read: ["admin"],
    update: [],        // No updates allowed
    delete: [],        // No deletes allowed
    list: ["admin"],
  })
```

### Hierarchical Access

```typescript
const manager = defineRule("manager", async (ctx) => {
  if (!ctx.user || !ctx.record) return false

  // Check if user manages the record's department
  const department = await ctx.driver.findOne("department", {
    where: { id: ctx.record.departmentId }
  })

  return department?.managerId === ctx.user.id
})

const employee = entity("employee", { ... })
  .rules({
    read: ["authenticated"],
    update: ["owner", manager, "hr"],
    delete: ["hr", "admin"],
  })
```

### Team-Based Access

```typescript
const teamMember = defineRule("teamMember", async (ctx) => {
  if (!ctx.user || !ctx.record) return false

  const membership = await ctx.driver.findOne("teamMembership", {
    where: {
      userId: ctx.user.id,
      teamId: ctx.record.teamId,
      status: "active",
    }
  })

  return !!membership
})

const project = entity("project", {
  team: belongsTo(() => team),
})
  .rules({
    read: [teamMember],
    update: [teamMember],
    delete: ["admin"],
  })
```

### Subscription Tiers

```typescript
const hasSubscription = (tier: string) => defineRule(`subscription:${tier}`, async (ctx) => {
  if (!ctx.user) return false

  const subscription = await ctx.driver.findOne("subscription", {
    where: { userId: ctx.user.id, status: "active" }
  })

  const tiers = ["free", "basic", "pro", "enterprise"]
  const userTierIndex = tiers.indexOf(subscription?.tier || "free")
  const requiredTierIndex = tiers.indexOf(tier)

  return userTierIndex >= requiredTierIndex
})

const advancedFeature = entity("advancedFeature", { ... })
  .rules({
    read: [hasSubscription("pro")],
    create: [hasSubscription("enterprise")],
  })
```

## Error Responses

When authorization fails:

**401 Unauthorized** - No authentication provided
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED",
  "message": "Authentication required"
}
```

**403 Forbidden** - Authenticated but not authorized
```json
{
  "error": "Forbidden",
  "code": "FORBIDDEN",
  "message": "You don't have permission to perform this action"
}
```

## Best Practices

### 1. Start Restrictive

```typescript
// ✅ Good: deny by default, allow explicitly
.rules({
  create: ["authenticated"],
  read: ["owner"],
  update: ["owner"],
  delete: ["admin"],
})

// ❌ Bad: too permissive
.rules({
  create: ["everyone"],
  read: ["everyone"],
  update: ["everyone"],
  delete: ["everyone"],
})
```

### 2. Use ownedBy for User Content

```typescript
// ✅ Good: clear ownership
const post = entity("post", {
  author: belongsTo(() => user),
})
  .ownedBy("author")

// ❌ Bad: manual owner checks
const post = entity("post", {
  authorId: string,
})
  .rules({
    update: [customOwnerCheck],  // Reinventing the wheel
  })
```

### 3. Layer Authorization

```typescript
// ✅ Good: entity + field level
const user = entity("user", {
  name: string,
  email: string.readable("owner"),
  ssn: string.adminOnly(),
})
  .rules({
    read: ["authenticated"],  // Can see user records
  })
  // But sensitive fields have additional restrictions
```

### 4. Document Custom Rules

```typescript
// ✅ Good: clear naming and purpose
const departmentHead = defineRule("departmentHead", async (ctx) => {
  // User must be the head of the record's department
  // Used for: performance reviews, salary changes
  ...
})
```

## Rule Reference

| Rule | Description |
|------|-------------|
| `"everyone"` | No auth required |
| `"authenticated"` | Must be logged in |
| `"owner"` | Must own record (via ownedBy) |
| `"admin"` | Must have admin role |
| `defineRule(name, fn)` | Custom rule function |

## Next Steps

- [Field Access Policies](/fields/access-policies) - Field-level permissions
- [Cross-Field Validation](/entities/cross-field-validation) - Multi-field validation
- [Auth Plugin](/plugins/auth) - Authentication setup
