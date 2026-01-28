# Type Safety

End-to-end type safety from database to client with zero code generation.

## The Problem

Traditional API development has types in multiple places:

```
Database Schema → Backend DTOs → API Handlers → Frontend Types
     (SQL)         (Classes)      (Interfaces)    (Interfaces)
```

If you change a database column, you must manually update every layer.

## The Nevr Solution

**Entity Definition = Single Source of Truth**

```typescript
const user = entity("user", {
  email: string.email().unique(),
  age: int.min(18),
  role: string.default("user"),
})
```

From this single definition:
- Database schema is inferred
- API validation is automatic
- Client types are derived
- No code generation needed

---

## $Infer Pattern

Export types from your server for client consumption:

```typescript
// server.ts
const db = new PrismaClient()
const api = nevr({ ...config, driver: prisma(db) })

// Export inferred types
export type API = typeof api
```

```typescript
// client.ts
import type { API } from "../server"

// Extract entity types
type Entities = API["$Infer"]["Entities"]
type User = Entities["user"]
type Post = Entities["post"]

// User is fully typed:
// { id: string; email: string; age: number; role: string; createdAt: Date; updatedAt: Date }
```

---

## InferEntityData

Get types for a single entity:

```typescript
import { InferEntityData } from "nevr"

// Full entity data
type User = InferEntityData<typeof user>
// { id: string; email: string; age: number; role: string; ... }

// Create input (no id, optional fields nullable)
type CreateUser = InferEntityData<typeof user, "create">
// { email: string; age: number; role?: string }

// Update input (all optional)
type UpdateUser = InferEntityData<typeof user, "update">
// { email?: string; age?: number; role?: string }
```

---

## Typed Client

Client operations are fully typed:

```typescript
import { createTypedClient, entityClient } from "nevr/client"
import type { API } from "../server"

const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [entityClient({ entities: ["user", "post"] })],
})

// Fully typed operations
const { data } = await client.users.create({
  email: "test@example.com",
  age: 25,
  // role is optional with default "user"
})

// TypeScript knows data.email is string
console.log(data?.email)

// TypeScript errors on invalid fields
await client.users.create({
  email: "test@example.com",
  age: "not a number", // Error: Type 'string' is not assignable to type 'number'
  invalid: true,       // Error: Object literal may only specify known properties
})
```

---

## Filter Type Safety

Filters are typed based on entity fields:

```typescript
// Only valid fields and operators allowed
const { data } = await client.users.list({
  filter: {
    email: { contains: "@gmail.com" },
    age: { gte: 18 },
    role: { in: ["user", "admin"] },
    invalid: true, // Error: 'invalid' does not exist
  },
})
```

---

## Action Type Safety

Actions have typed input and output:

```typescript
const order = entity("order", { ... })
  .actions({
    checkout: action()
      .input({ paymentMethodId: string })
      .onResource()
      .handler(async (ctx) => {
        // ctx.input is typed as { paymentMethodId: string }
        const { paymentMethodId } = ctx.input
        return { orderId: ctx.resourceId, status: "paid" }
      }),
  })

// Client call is typed
const result = await client.orders.action("checkout", "order_123", {
  paymentMethodId: "pm_xxx",
  // invalid: true, // Error
})
// result is typed as { orderId: string; status: string }
```

---

## Relation Type Safety

Relations are automatically typed:

```typescript
const post = entity("post", {
  title: string,
  content: text,
  author: belongsTo(() => user),
})

// Include relations with proper types
const { data } = await client.posts.list({
  include: ["author"],
})

// TypeScript knows author exists and its type
data?.data.forEach((post) => {
  console.log(post.title)        // string
  console.log(post.author?.name) // string | undefined
})
```

---

## JSON Type Safety

Use `jsonTyped<T>()` for typed JSON fields:

```typescript
interface OrderItem {
  productId: string
  quantity: number
  price: number
}

interface ShippingAddress {
  street: string
  city: string
  zip: string
}

const order = entity("order", {
  items: jsonTyped<OrderItem[]>(),
  shipping: jsonTyped<ShippingAddress>().optional(),
  total: float,
})

// Client types are fully typed
const { data } = await client.orders.get("order_123")

// TypeScript knows the structure
data?.items.forEach((item) => {
  console.log(item.productId) // string
  console.log(item.quantity)  // number
})

console.log(data?.shipping?.city) // string | undefined
```

---

## Plugin Type Safety

Plugin endpoints are typed:

```typescript
// Define plugin with typed endpoints
const authPlugin = createPlugin({
  id: "auth",
  name: "Auth Plugin",
  version: "1.0.0",
  endpoints: {
    signIn: {
      method: "POST",
      path: "/sign-in",
      input: { body: { email: "string", password: "string" } },
      output: { user: "object", session: "object" },
    },
  },
})

// Client infers plugin endpoints
const { data } = await client.auth.signIn({
  email: "test@example.com",
  password: "secret123",
})

// data.user and data.session are typed
```

---

## Type Flow Diagram

```
Entity Definition
       ↓
  ┌────┴────┐
  ↓         ↓
Database   $Infer
Schema     Types
  ↓         ↓
Prisma   ┌──┴──┐
Types    ↓     ↓
  ↓    Server  Client
  └──→ Types   Types
           ↓
      Type-Safe
         API
```

---

## Best Practices

1. **Export API type from server**
   ```typescript
   export type API = typeof api
   ```

2. **Use $Infer for client types**
   ```typescript
   type Entities = API["$Infer"]["Entities"]
   ```

3. **Use jsonTyped&lt;T&gt;() for complex JSON**
   ```typescript
   items: jsonTyped<Item[]>()
   ```

4. **Share types via package or path import**
   ```typescript
   import type { API } from "@myapp/server"
   ```

---

## Next Steps

- [Entity-First Design](/concepts/entity-first)
- [Client Type Inference](/reference/inference)
- [Typed JSON Fields](/fields/types)
