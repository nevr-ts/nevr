# Field Relations

> 🔗 **Connect your entities with rich, type-safe relationships.**

## Why Nevr Relations?

### The Problem: Manual Joins & Foreign Keys

| Feature | Raw SQL/No Relations | Nevr Relations |
|---------|----------------------|----------------|
| **Schema** | Manually add `userId` column | Automatic FK generation |
| **Queries** | Manual `JOIN` or multiple fetches | Simple `.include({ user: true })` |
| **Integrity** | Manual cascade logic | built-in `.onDelete("cascade")` |
| **Types** | Manual join types | Auto-inferred nested types |

> 🟢 **Beginner Tip**: `belongsTo` adds the foreign key column (e.g., `authorId`). `hasMany` is just the "other side" of the link and adds no columns.

> 🔴 **Advanced**: Use `selfRef()` for recursive structures like comments or category trees.

---

## Relation Types

| Function | Cardinality | Description |
|----------|-------------|-------------|
| `belongsTo()` | Many-to-One | This entity belongs to one of another |
| `hasMany()` | One-to-Many | This entity has many of another |
| `hasOne()` | One-to-One | This entity has exactly one of another |
| `selfRef()` | Self-Reference | Entity references itself (parent-child) |

---

## belongsTo()

Creates a many-to-one relationship. The current entity "belongs to" one instance of another entity.

```typescript
import { entity, string, belongsTo } from "nevr"

const user = entity("user", {
  name: string,
  email: string.unique(),
})

const post = entity("post", {
  title: string,
  content: string,

  // Many posts belong to one user
  author: belongsTo(() => user),
})
```

**Generated database schema:**
- `post` table gets `authorId` column (foreign key)
- References `user.id`

**API behavior:**
```typescript
// Create with relation
POST /api/posts
{
  "title": "My Post",
  "content": "...",
  "authorId": "usr_123"
}

// Query with include
GET /api/posts?include=author

// Response
{
  "id": "post_456",
  "title": "My Post",
  "authorId": "usr_123",
  "author": {
    "id": "usr_123",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

## hasMany()

Creates a one-to-many relationship. The current entity "has many" instances of another entity.

```typescript
const user = entity("user", {
  name: string,
  email: string.unique(),

  // One user has many posts
  posts: hasMany(() => post),
})

const post = entity("post", {
  title: string,
  content: string,
  author: belongsTo(() => user),
})
```

**API behavior:**
```typescript
// Query with include
GET /api/users/usr_123?include=posts

// Response
{
  "id": "usr_123",
  "name": "John Doe",
  "posts": [
    { "id": "post_1", "title": "First Post" },
    { "id": "post_2", "title": "Second Post" }
  ]
}
```

::: tip
`hasMany()` doesn't create a column in the database. It's the inverse of `belongsTo()`.
:::

---

## hasOne()

Creates a one-to-one relationship. The current entity "has exactly one" instance of another entity.

```typescript
const user = entity("user", {
  name: string,
  email: string.unique(),

  // One user has one profile
  profile: hasOne(() => profile),
})

const profile = entity("profile", {
  bio: text.optional(),
  avatar: string.optional(),
  website: string.url().optional(),

  // Profile belongs to one user
  user: belongsTo(() => user),
})
```

**API behavior:**
```typescript
GET /api/users/usr_123?include=profile

{
  "id": "usr_123",
  "name": "John Doe",
  "profile": {
    "id": "prof_789",
    "bio": "Software developer",
    "avatar": "https://..."
  }
}
```

---

## selfRef()

Creates a self-referencing relationship. Use when an entity needs to reference itself.

```typescript
const category = entity("category", {
  name: string,
  slug: string.unique(),

  // Self-reference for parent category
  parent: selfRef().optional(),

  // Self-reference for children
  children: selfRef("hasMany"),
})
```

**Use cases:**
- Categories with subcategories
- Comments with replies
- Employees with managers
- Folders with subfolders

### Self-Reference Types

```typescript
// Default: belongsTo (many-to-one)
parent: selfRef().optional()

// hasMany (one-to-many)
children: selfRef("hasMany")

// hasOne (one-to-one)
successor: selfRef("hasOne").optional()
```

### Why selfRef()?

Using `belongsTo(() => category)` inside the `category` definition causes a TypeScript error because `category` isn't defined yet. `selfRef()` solves this:

```typescript
// Error: 'category' is used before being defined
const category = entity("category", {
  parent: belongsTo(() => category),  // TypeScript error!
})

// Works correctly
const category = entity("category", {
  parent: selfRef().optional(),  // No error
})
```

---

## Relation Options

### foreignKey()

Customize the foreign key column name.

```typescript
const post = entity("post", {
  title: string,

  // Default: writerId
  writer: belongsTo(() => user).foreignKey("writerId"),

  // Custom: creatorId instead of editorId
  editor: belongsTo(() => user).foreignKey("lastEditedBy"),
})
```

### onDelete()

Specify what happens when the referenced record is deleted.

```typescript
const post = entity("post", {
  title: string,

  // Delete posts when user is deleted
  author: belongsTo(() => user).onDelete("cascade"),

  // Set to null when category is deleted
  category: belongsTo(() => category).onDelete("setNull").optional(),

  // Prevent deletion if posts exist
  publisher: belongsTo(() => publisher).onDelete("restrict"),
})
```

| Option | Behavior |
|--------|----------|
| `cascade` | Delete this record too |
| `setNull` | Set foreign key to NULL |
| `restrict` | Prevent deletion |

### optional()

Make the relation optional (allow null foreign key).

```typescript
const post = entity("post", {
  title: string,

  // Required relation
  author: belongsTo(() => user),

  // Optional relation
  category: belongsTo(() => category).optional(),
  reviewer: belongsTo(() => user).optional(),
})
```

---

## Remote Relations

For cross-service or plugin relations that are joined at the API level instead of the database level.

```typescript
const order = entity("order", {
  total: float,

  // Remote relation to Stripe subscription
  subscription: belongsTo(() => stripeSubscription).remote("stripe"),
})
```

**Use cases:**
- Linking to external services (Stripe, Auth)
- Plugin entities
- Microservice data

See [Remote Joiner](/remote-joiner/overview) for more details.

---

## Examples

### Blog System

```typescript
const user = entity("user", {
  name: string,
  email: string.unique(),

  posts: hasMany(() => post),
  comments: hasMany(() => comment),
})

const post = entity("post", {
  title: string,
  content: text,
  slug: string.unique(),

  author: belongsTo(() => user),
  category: belongsTo(() => category).optional(),
  tags: hasMany(() => postTag),
  comments: hasMany(() => comment),
})

const category = entity("category", {
  name: string,
  slug: string.unique(),

  parent: selfRef().optional(),
  children: selfRef("hasMany"),
  posts: hasMany(() => post),
})

const comment = entity("comment", {
  content: text,

  author: belongsTo(() => user),
  post: belongsTo(() => post),

  // Nested comments
  parent: selfRef().optional(),
  replies: selfRef("hasMany"),
})

const tag = entity("tag", {
  name: string.unique(),
  posts: hasMany(() => postTag),
})

const postTag = entity("postTag", {
  post: belongsTo(() => post).onDelete("cascade"),
  tag: belongsTo(() => tag).onDelete("cascade"),
})
```

### E-commerce

```typescript
const customer = entity("customer", {
  name: string,
  email: string.unique(),

  orders: hasMany(() => order),
  addresses: hasMany(() => address),
  defaultAddress: hasOne(() => address).optional(),
})

const address = entity("address", {
  street: string,
  city: string,
  country: string,
  zipCode: string,

  customer: belongsTo(() => customer).onDelete("cascade"),
})

const order = entity("order", {
  orderNumber: string.unique(),
  total: float,
  status: string.default("pending"),

  customer: belongsTo(() => customer),
  shippingAddress: belongsTo(() => address),
  billingAddress: belongsTo(() => address).optional(),
  items: hasMany(() => orderItem),
})

const product = entity("product", {
  name: string,
  sku: string.unique(),
  price: float,

  category: belongsTo(() => productCategory).optional(),
  variants: hasMany(() => productVariant),
  orderItems: hasMany(() => orderItem),
})

const productCategory = entity("productCategory", {
  name: string,

  parent: selfRef().optional(),
  children: selfRef("hasMany"),
  products: hasMany(() => product),
})

const productVariant = entity("productVariant", {
  sku: string.unique(),
  name: string,
  price: float,
  stock: int.default(0),

  product: belongsTo(() => product).onDelete("cascade"),
})

const orderItem = entity("orderItem", {
  quantity: int,
  price: float,

  order: belongsTo(() => order).onDelete("cascade"),
  product: belongsTo(() => product),
  variant: belongsTo(() => productVariant).optional(),
})
```

### Organization Structure

```typescript
const organization = entity("organization", {
  name: string,

  departments: hasMany(() => department),
  employees: hasMany(() => employee),
})

const department = entity("department", {
  name: string,

  organization: belongsTo(() => organization),
  manager: belongsTo(() => employee).optional(),
  employees: hasMany(() => employee),

  // Department hierarchy
  parent: selfRef().optional(),
  subDepartments: selfRef("hasMany"),
})

const employee = entity("employee", {
  name: string,
  email: string.unique(),
  title: string,

  organization: belongsTo(() => organization),
  department: belongsTo(() => department),

  // Employee hierarchy
  manager: selfRef().optional(),
  directReports: selfRef("hasMany"),
})
```

---

## Query Includes

Use the `include` query parameter to load related data:

```typescript
// Single relation
GET /api/posts?include=author

// Multiple relations
GET /api/posts?include=author,category,comments

// Nested relations
GET /api/posts?include=author.profile,comments.author

// All posts with their author and author's profile
GET /api/posts?include=author.profile
```

---

## Relation Reference

### belongsTo()

```typescript
belongsTo(entity: () => Entity)
  .foreignKey(key: string)     // Custom FK column name
  .onDelete(action)            // cascade | setNull | restrict
  .optional()                  // Allow null
  .remote(serviceId?: string)  // API-level join
```

### hasMany()

```typescript
hasMany(entity: () => Entity)
  // Note: hasMany doesn't support most options
  // as it's just the inverse of belongsTo
```

### hasOne()

```typescript
hasOne(entity: () => Entity)
  // Similar to hasMany, defines inverse relationship
```

### selfRef()

```typescript
selfRef(type?: "belongsTo" | "hasMany" | "hasOne")
  .foreignKey(key: string)
  .onDelete(action)
  .optional()
```

---

## Best Practices

### 1. Always use arrow functions

```typescript
// Good - lazy evaluation prevents circular issues
author: belongsTo(() => user)

// Bad - may cause undefined errors
author: belongsTo(user)
```

### 2. Use cascade carefully

```typescript
// Good - clean up related data
orderItems: hasMany(() => orderItem)  // items have .onDelete("cascade")

// Careful - might delete more than expected
posts: hasMany(() => post)  // if posts cascade-delete comments...
```

### 3. Make inverse relations explicit

```typescript
// Both sides of the relationship
const user = entity("user", {
  posts: hasMany(() => post),  // Inverse
})

const post = entity("post", {
  author: belongsTo(() => user),  // Primary
})
```

### 4. Use selfRef() for hierarchies

```typescript
// Good
parent: selfRef().optional()

// Error-prone
parent: belongsTo(() => category)  // TypeScript error
```

### 5. Consider query performance

```typescript
// Be mindful of deep includes
GET /api/posts?include=author.posts.author.posts  // Too deep!

// Better: limit depth
GET /api/posts?include=author,comments
```


## Self-References (Recursive Relations)

For entities that reference themselves (e.g., categories with sub-categories), use `selfRef()` to avoid circular dependency issues in TypeScript.

### One-to-Many (Tree Structure)

```typescript
export const category = entity("Category", {
  name: string,
  parentId: string.optional(),
  
  // Parent category
  parent: selfRef("belongsTo"),
  
  // Child categories
  children: selfRef("hasMany")
})
```

### One-to-One (Linked List)

```typescript
export const task = entity("Task", {
  title: string,
  
  // Next task in the chain
  nextTask: selfRef("hasOne")
})
```

## Next Steps

- [Defining Entities](/entities/defining) - Complete entity configuration
- [Authorization Rules](/entities/authorization) - Entity-level access control
- [Remote Joiner](/remote-joiner/overview) - Cross-service relations

