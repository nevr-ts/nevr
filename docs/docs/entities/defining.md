# Defining Entities

> 🏗️ **Entities are the blueprint of your application, defining data structure, API endpoints, and type definitions in one place.**

## Why Nevr Entities?

### The Problem: Fragmented Definitions

| Approach | Data Model | API Routes | Types | Validation | Auth |
|----------|------------|------------|-------|------------|------|
| **Traditional** | SQL/ORM | Express/Fastify | Interface | Zod/Joi | Middleware |
| **Nevr** | `entity()` | **Automatic** | **Automatic** | **Automatic** | **Automatic** |

### The Solution: Single Source of Truth

Define your entity **once**, and Nevr generates everything else:

```typescript
import { entity, string, belongsTo } from "nevr"

const user = entity("user", { ... })
// 1. Creates database table
// 2. Generates REST API (/api/users)
// 3. Infers TypeScript interfaces
// 4. Enforces validation rules
// 5. Applies access control
```

> 🟢 **Beginner Tip**: You don't need to write migration files manually. Just define your entity and run `nevr db:push`.

::: tip Recommended project structure
Keep each entity in its own file, with a barrel `index.ts` that re-exports them:

**Express / Hono:**
```
src/
├── entities/
│   ├── user.ts          # export const user = entity("user", { ... })
│   ├── post.ts          # export const post = entity("post", { ... })
│   ├── product.ts
│   └── index.ts         # export { user } from "./user.js"
├── nevr.config.ts       # defineConfig — imports from entities/
└── server.ts            # nevr({ ...config, driver })
```

**Next.js:**
```
lib/
├── entities/
│   ├── user.ts
│   ├── post.ts
│   ├── product.ts
│   └── index.ts
├── nevr.config.ts       # defineConfig — imports from entities/
└── nevr.ts              # nevr({ ...config, driver })
app/
└── api/
    └── [...nevr]/
        └── route.ts     # nextjsAdapter(api)
```

Then in your config:
```typescript
import { defineConfig } from "nevr"
import { user, post, product } from "./entities/index.js"

export const config = defineConfig({
  database: "sqlite",
  entities: [user, post, product],
})

export default config
```
:::

---

## EntityBuilder Method Reference

| Method | Description | Example |
|--------|-------------|---------|
| `.rules(config)` | Set authorization rules per operation | `.rules({ create: ["authenticated"] })` |
| `.ownedBy(field)` | Set owner relation + default rules | `.ownedBy("author")` |
| `.timestamps(config)` | Configure auto timestamps | `.timestamps(false)` or `.timestamps({ createdAt: "created" })` |
| `.noTimestamps()` | Disable auto timestamps (deprecated) | `.noTimestamps()` |
| `.namespace(ns)` | Group entities for schema splitting | `.namespace("auth")` |
| `.validate(fn, msg, opts?)` | Add cross-field validation | `.validate(d => d.start < d.end, "Invalid range")` |
| `.actions(config)` | Define custom actions/workflows | `.actions({ publish: action().handler(...) })` |
| `.action(name, def)` | Add single action | `.action("verify", action().onResource())` |
| `.build()` | Finalize entity (usually automatic) | `const built = entity.build()` |

---

## Basic Entity

```typescript
import { entity, string, text, int, boolean } from "nevr"

const post = entity("post", {
  title: string,
  content: text,
  views: int.default(0),
  isPublished: boolean.default(false),
})
```

This declaration automatically powers:
1.  **Database**: `CREATE TABLE "Post" ...`
2.  **API**: `GET /api/posts`, `POST /api/posts`, etc.
3.  **Types**: `type Post = { id: string; title: string; ... }`

---

## Entity Naming

Entity names must:
- Start with a lowercase letter
- Contain only alphanumeric characters
- Use camelCase convention

```typescript
// ✅ Valid names
entity("user", { ... })
entity("blogPost", { ... })
entity("orderItem", { ... })

// ❌ Invalid names
entity("User", { ... })      // Can't start with uppercase
entity("blog_post", { ... }) // No underscores
entity("123user", { ... })   // Can't start with number
```

## Complete Entity Example

```typescript
import {
  entity,
  string,
  text,
  int,
  float,
  boolean,
  datetime,
  email,
  jsonTyped,
  belongsTo,
  hasMany,
} from "nevr"

interface ProductMetadata {
  weight: number
  dimensions: { width: number; height: number; depth: number }
  materials: string[]
}

const product = entity("product", {
  // Basic fields
  name: string.trim().min(2).max(200),
  slug: string.trim().lower().unique(),
  description: text.trim().optional(),

  // Pricing
  price: float.gt(0, "Price must be positive"),
  compareAtPrice: float.optional(),
  costPrice: float.adminOnly().optional(),

  // Inventory
  sku: string.trim().upper().unique(),
  quantity: int.gte(0).default(0),
  lowStockThreshold: int.default(10),

  // Status
  status: string.default("draft"),
  isPublished: boolean.default(false),
  publishedAt: datetime.optional(),

  // Typed JSON
  metadata: jsonTyped<ProductMetadata>().optional(),

  // Relations
  category: belongsTo(() => category).optional(),
  variants: hasMany(() => productVariant),
  reviews: hasMany(() => review),
})
  .ownedBy("vendor")
  .rules({
    read: ["everyone"],
    create: ["vendor", "admin"],
    update: ["owner", "admin"],
    delete: ["admin"],
  })
```

## Entity Methods

### rules()

Set authorization rules for CRUD operations.

```typescript
const post = entity("post", { ... })
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner", "admin"],
    delete: ["owner", "admin"],
    list: ["everyone"],
  })
```

**Available operations:**
- `create` - Creating new records
- `read` - Reading single records
- `update` - Updating records
- `delete` - Deleting records
- `list` - Listing/querying records

**Built-in rules:**
- `"everyone"` - No authentication required
- `"authenticated"` - Must be logged in
- `"owner"` - Must own the record
- `"admin"` - Must have admin role

See [Authorization Rules](/entities/authorization) for custom rules.

---

### ownedBy()

Marks an entity as owned by a user through a relation. Automatically sets sensible defaults for owner-based authorization.

```typescript
const post = entity("post", {
  title: string,
  author: belongsTo(() => user),
})
  .ownedBy("author")
```

**Effects:**
1. Sets `ownerField` to the relation's foreign key (`authorId`)
2. Applies default rules:
   - `create: ["authenticated"]`
   - `read: ["everyone"]`
   - `update: ["owner"]`
   - `delete: ["owner"]`
   - `list: ["everyone"]`

**Override defaults:**
```typescript
const post = entity("post", { ... })
  .ownedBy("author")
  .rules({
    delete: ["owner", "admin"], // Override delete rule
  })
```

---

### timestamps()

Disables automatic `createdAt` and `updatedAt` fields.

```typescript
const setting = entity("setting", {
  key: string.unique(),
  value: text,
})
  .timestamps(false)
```

**Use cases:**
- Configuration tables
- Lookup/reference data
- Junction tables for many-to-many

See [Timestamps](/entities/timestamps) for details.

---

### namespace()

Groups entities for schema organization in large codebases.

```typescript
const user = entity("user", { ... }).namespace("auth")
const session = entity("session", { ... }).namespace("auth")
const product = entity("product", { ... }).namespace("catalog")
const order = entity("order", { ... }).namespace("orders")
```

See [Namespaces](/entities/namespaces) for details.

---

### validate()

Adds cross-field validation rules.

```typescript
const event = entity("event", {
  startDate: datetime,
  endDate: datetime,
})
  .validate(
    (data) => data.startDate < data.endDate,
    "Start date must be before end date"
  )
```

See [Cross-Field Validation](/entities/cross-field-validation) for details.

---

### actions()

Defines custom actions and workflows.

```typescript
const user = entity("user", { ... })
  .actions({
    verify: action()
      .onResource()
      .rules("admin")
      .handler(async (ctx) => {
        await ctx.driver.update("user", ctx.resourceId, { verified: true })
        return { success: true }
      }),
  })
```

See [Actions Overview](/actions/overview) for details.

## Generated API Endpoints

Each entity automatically generates REST endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/{entity}` | List all records |
| `GET` | `/api/{entity}/:id` | Get single record |
| `POST` | `/api/{entity}` | Create record |
| `PUT` | `/api/{entity}/:id` | Update record |
| `DELETE` | `/api/{entity}/:id` | Delete record |

**Example for `post` entity:**
```
GET    /api/posts          # List posts
GET    /api/posts/abc123   # Get post by ID
POST   /api/posts          # Create post
PUT    /api/posts/abc123   # Update post
DELETE /api/posts/abc123   # Delete post
```

## Auto-Generated Fields

Every entity automatically includes:

```typescript
{
  id: string,           // CUID primary key
  createdAt: datetime,  // Set on create
  updatedAt: datetime,  // Updated on every change
}
```

You don't need to define these - they're added automatically.

**Disable timestamps:**
```typescript
entity("config", { ... }).timestamps(false)
```

## Type Inference

Nevr provides full end-to-end type safety:

```typescript
const user = entity("user", {
  name: string,
  email: string.email().unique(),
  age: int.optional(),
})

// Extract types from entity
type UserFields = typeof user.config.fields

// Use with client
const client = createTypedClient<typeof api>()

// Fully typed!
const users = await client.user.list()
// users: Array<{ id: string, name: string, email: string, age: number | null, ... }>
```

## Best Practices

### 1. Define Fields Explicitly

```typescript
// ✅ Good: clear field definitions
const user = entity("user", {
  name: string.trim().min(2),
  email: string.trim().lower().email().unique(),
})

// ❌ Bad: minimal definitions lose validation
const user = entity("user", {
  name: string,
  email: string,
})
```

### 2. Use Appropriate Field Types

```typescript
// ✅ Good: semantic types
const post = entity("post", {
  title: string,        // Short text
  content: text,        // Long text
  views: int,           // Whole number
  rating: float,        // Decimal
  isPublished: boolean, // True/false
  publishedAt: datetime,// Date/time
})
```

### 3. Set Sensible Defaults

```typescript
// ✅ Good: defaults for common patterns
const user = entity("user", {
  role: string.default("user"),
  isActive: boolean.default(true),
  loginCount: int.default(0),
})
```

### 4. Validate Early

```typescript
// ✅ Good: validation at the field level
const product = entity("product", {
  price: float.gt(0, "Price must be positive"),
  quantity: int.gte(0, "Quantity cannot be negative"),
  sku: string.regex(/^[A-Z0-9-]+$/, "Invalid SKU format"),
})
```

### 5. Secure Sensitive Data

```typescript
// ✅ Good: protect sensitive fields
const user = entity("user", {
  password: string.password().omit(),
  ssn: string.encrypted().adminOnly(),
  internalNotes: text.omit(),
})
```

## Common Patterns

### User Entity

```typescript
const user = entity("user", {
  name: string.trim().min(2).max(100),
  email: string.trim().lower().email().unique(),
  password: string.min(8).password().omit(),
  avatar: string.url().optional(),
  bio: text.trim().optional(),
  role: string.default("user").adminOnly(),
  isActive: boolean.default(true),
  emailVerified: boolean.default(false).readOnly(),
  lastLoginAt: datetime.optional().readOnly(),
})
```

### Blog Post

```typescript
const post = entity("post", {
  title: string.trim().min(5).max(200),
  slug: string.trim().lower().unique(),
  content: text,
  excerpt: text.optional(),
  featuredImage: string.url().optional(),
  status: string.default("draft"),
  isPublished: boolean.default(false),
  publishedAt: datetime.optional(),
  author: belongsTo(() => user),
  category: belongsTo(() => category).optional(),
  tags: hasMany(() => postTag),
  comments: hasMany(() => comment),
})
  .ownedBy("author")
  .validate(
    (data) => !data.isPublished || data.publishedAt,
    "Published posts must have a publish date"
  )
```

### E-commerce Order

```typescript
const order = entity("order", {
  orderNumber: string.unique(),
  status: string.default("pending"),
  subtotal: float,
  tax: float.default(0),
  shipping: float.default(0),
  total: float,
  notes: text.optional(),
  customer: belongsTo(() => customer),
  items: hasMany(() => orderItem),
  shippingAddress: jsonTyped<Address>(),
  billingAddress: jsonTyped<Address>().optional(),
})
  .ownedBy("customer")
  .validate(
    (data) => data.total === data.subtotal + data.tax + data.shipping,
    "Total must equal subtotal + tax + shipping"
  )
```

## Next Steps

- [Authorization Rules](/entities/authorization) - Control access to entities
- [Cross-Field Validation](/entities/cross-field-validation) - Multi-field validation
- [Timestamps](/entities/timestamps) - Automatic timestamps
- [Actions Overview](/actions/overview) - Custom operations
