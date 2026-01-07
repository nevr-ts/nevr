# Type Inference

> ⚡ **Nevr provides full end-to-end type safety from database schema to frontend client.**

## Why Type Inference Matters

### The Problem: Types Get Out of Sync

| Layer | Without Nevr | With Nevr |
|-------|-------------|-----------|
| **Database** | Prisma schema | Generated from entities |
| **Server** | Manual types | Inferred from entities |
| **API Response** | `any` or duplicate types | Automatic inference |
| **Client** | Fetch with `any` | Full typed client |

> 🟢 **Beginner Tip**: Define your entity once, and TypeScript knows the types everywhere—even in your React components.

---

## How It Works

```
┌─────────────────┐
│  Entity DSL     │ ← You define this
│  entity("user") │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Infer   │  ← TypeScript magic
    └────┬────┘
         │
    ┌────▼──────────────────────────────┐
    │ • Prisma Schema (generated)       │
    │ • Server types (inferred)         │
    │ • API response types (inferred)   │
    │ • Client types (synchronized)     │
    └───────────────────────────────────┘
```

---

## Basic Type Inference

### Entity Types

```typescript
import { entity, string, int, datetime } from "nevr"

const user = entity("user", {
  name: string,
  email: string.email().unique(),
  age: int.optional(),
  createdAt: datetime,
})

// TypeScript automatically knows:
// {
//   id: string
//   name: string
//   email: string
//   age: number | null
//   createdAt: Date
// }
```

### Infer Entity Type

```typescript
import type { InferEntity } from "nevr"

// Get the full entity type
type User = InferEntity<typeof user>
// { id: string; name: string; email: string; age: number | null; createdAt: Date }

// Use in your code
function displayUser(user: User) {
  console.log(user.name)  // ✅ Type-safe
  console.log(user.foo)   // ❌ TypeScript error
}
```

---

## Client Type Inference

### Typed Client

```typescript
import { createTypedClient, entityClient } from "nevr/client"
import type { API } from "./server/api"

// Create a typed client from your server
const client = createTypedClient<API>({
  baseURL: "/api",
  plugins: [entityClient({ entities: ["user"] })]
})

// Full type inference on all operations
const user = await client.users.findOne("user_123")
//    ^? { id: string; name: string; email: string; ... }

const users = await client.users.findMany({ where: { age: { gt: 18 } } })
//    ^? Array<{ id: string; name: string; ... }>
```

### InferEntitiesFromServer

For maximum type safety, infer types from your server:

```typescript
// server.ts
export const api = nevr({
  entities: { user, post, comment },
  driver: prisma(db),
})

export type Api = typeof api

// client.ts
import type { Api } from "./server"
import type { InferEntitiesFromServer } from "nevr/client"

type Entities = InferEntitiesFromServer<Api>
// {
//   user: { id: string; name: string; ... }
//   post: { id: string; title: string; ... }
//   comment: { id: string; content: string; ... }
// }
```

---

## Relation Type Inference

Relations are also fully typed:

```typescript
const post = entity("post", {
  title: string,
  content: text,
  author: belongsTo(() => user),
})

// Include relation in query
const postWithAuthor = await client.posts.findOne("post_123", {
  include: { author: true }
})

// TypeScript knows author is included
postWithAuthor.author.name  // ✅ Type-safe
```

---

## Action Input/Output Inference

Action inputs and outputs are also inferred:

```typescript
const order = entity("order", { ... })
  .actions({
    cancel: action()
      .input({ reason: string.optional() })
      .handler(async (ctx) => {
        // ctx.input is typed: { reason?: string }
        return { cancelled: true, reason: ctx.input.reason }
      }),
  })

// Client knows the action types
const result = await client.orders.action("cancel", "order_123", {
  reason: "Changed my mind"
})
// result: { cancelled: boolean; reason?: string }
```

---

## Advanced: Conditional Types

Nevr uses TypeScript conditional types for smart inference:

```typescript
// Optional fields become T | null
age: int.optional()  // number | null

// Default values don't require input
status: string.default("pending")
// Create input: status is optional
// Read output: status is always string

// Omitted fields excluded from responses
password: string.password().omit()
// Response type doesn't include password
```

---

## Type Helpers

```typescript
import type {
  // Entity inference
  InferEntity,
  InferEntityInput,
  InferEntityOutput,
  
  // Client inference
  InferEntitiesFromServer,
  InferEntityMethods,
  TypedClient,
  
  // Action inference
  InferActions,
  InferActionInput,
  InferActionOutput,
} from "nevr"
```

---

## React Integration with Types

```tsx
import type { InferEntity } from "nevr"
import { user } from "./entities/user"

type User = InferEntity<typeof user>

function UserCard({ user }: { user: User }) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {user.age && <span>Age: {user.age}</span>}
    </div>
  )
}
```

---

## Best Practices

1. **Export entity types** for use across your codebase
2. **Use `satisfies`** for type checking without widening
3. **Avoid `any`** - let Nevr infer types
4. **Share types** between server and client via barrel exports

```typescript
// entities/index.ts
export { user } from "./user"
export { post } from "./post"

// Export inferred types
export type { InferEntity } from "nevr"
```

---

## Next Steps

- [Client Guide](/guide/client) - Full client documentation
- [Fields Overview](/fields/overview) - Field types and validation
- [Actions](/actions/overview) - Custom actions with typed input/output
