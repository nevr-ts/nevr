# Entities

Entities are the **heart of Nevr**. An entity defines:
- The shape of your data (fields)
- Authorization rules (who can do what)
- Relationships with other entities

When you define an entity, Nevr automatically:
1. Creates database tables via Prisma
2. Generates REST API endpoints (CRUD)
3. Validates all incoming data
4. Enforces authorization rules
5. Generates TypeScript types

---

## Creating Your First Entity

Use the `entity()` function to define an entity:

```typescript
import { entity, string, bool } from "nevr"

export const task = entity("task", {
  title: string,
  completed: bool.default(false)
})
```

### The `entity()` Function

```typescript
entity(name, fields)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | The entity name. Used for table name and API routes. Must start with lowercase. |
| `fields` | `object` | An object where keys are field names and values are field definitions. |

### Naming Rules

Entity names must:
- Start with a **lowercase letter**
- Contain only **alphanumeric characters**

```typescript
// ✅ Valid names
entity("user", { ... })
entity("blogPost", { ... })
entity("orderItem", { ... })

// ❌ Invalid names
entity("User", { ... })     // Cannot start with uppercase
entity("blog-post", { ... }) // No hyphens
entity("123abc", { ... })    // Cannot start with number
```

### Generated API Routes

For an entity named `task`, Nevr generates:

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/tasks` | List all tasks |
| `GET` | `/tasks/:id` | Get one task |
| `POST` | `/tasks` | Create a task |
| `PUT` | `/tasks/:id` | Update a task |
| `DELETE` | `/tasks/:id` | Delete a task |

---

## Complete Entity Example

Here's a real-world example with all features:

```typescript
import { entity, string, text, bool, email, belongsTo } from "nevr"
import { user } from "./user"

export const post = entity("post", {
  // Simple fields
  title: string.min(1).max(200),
  content: text,
  published: bool.default(false),
  
  // Email validation
  contactEmail: email.optional(),
  
  // Relationship
  author: belongsTo(() => user)
})
  // Authorization: author owns their posts
  .ownedBy("author")
  
  // Custom rules (optional, ownedBy sets defaults)
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner"],
    delete: ["owner", "admin"]
  })
```

---

## Entity Methods

### `.ownedBy(relationField)`

Marks a relation field as the "owner" of the entity. This enables the `owner` rule and sets sensible defaults.

```typescript
const post = entity("post", {
  author: belongsTo(() => user)
}).ownedBy("author")
```

When you use `.ownedBy()`, these rules are set automatically:
- `create`: `["authenticated"]` — Must be logged in to create
- `read`: `["everyone"]` — Anyone can read
- `update`: `["owner"]` — Only the author can update
- `delete`: `["owner"]` — Only the author can delete
- `list`: `["everyone"]` — Anyone can list

### `.rules(config)`

Define custom authorization rules for each operation.

```typescript
const post = entity("post", { ... })
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner", "admin"],
    delete: ["admin"]
  })
```

See the [Authorization Guide](/entity/authorization) for full details.

### `.noTimestamps()`

By default, Nevr adds `createdAt` and `updatedAt` fields to every entity. Use this to disable them.

```typescript
const config = entity("config", {
  key: string.unique(),
  value: string
}).noTimestamps()
```

---

## Best Practices

### 1. One Entity Per File

Keep each entity in its own file for maintainability:

```
src/
  entities/
    user.ts
    post.ts
    comment.ts
    index.ts  // Re-exports all entities
```

### 2. Use an Index File

```typescript
// src/entities/index.ts
export * from "./user"
export * from "./post"
export * from "./comment"
```

### 3. Define Relationships Carefully

When two entities reference each other, use the arrow function syntax to avoid circular import issues:

```typescript
// user.ts
export const user = entity("user", {
  posts: hasMany(() => post)  // Arrow function!
})

// post.ts
export const post = entity("post", {
  author: belongsTo(() => user)  // Arrow function!
})
```

---

## Next Steps

- [Fields Reference](/entity/fields) — Learn all field types
- [Validation](/entity/validation) — Add validation rules
- [Relationships](/entity/relationships) — Connect entities together
- [Authorization](/entity/authorization) — Control access with rules
