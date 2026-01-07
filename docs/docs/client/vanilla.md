# Vanilla Client

Framework-agnostic Nevr client for any JavaScript environment.

## Setup

```typescript
import { createTypedClient, entityClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [
    entityClient({ entities: ["user"] }),
    authClient(),
  ],
})
```

---

## Configuration

```typescript
const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  basePath: "/api",

  // Client plugins
  plugins: [entityClient({ entities: ["user"] })],

  // Request middleware
  middleware: [authMiddleware, logMiddleware],

  // Response interceptors
  interceptors: [refreshInterceptor],

  // Default fetch options
  fetchOptions: {
    credentials: "include",
    headers: { "X-Custom-Header": "value" },
  },
})
```

---

## CRUD Operations

```typescript
// List with options
const { data, error } = await client.users.list({
  filter: { role: "admin" },
  sort: { createdAt: "desc" },
  take: 10,
  skip: 0,
})

// Get by ID
const { data } = await client.users.get("user_123")

// Create
const { data } = await client.users.create({
  name: "John",
  email: "john@example.com",
})

// Update
const { data } = await client.users.update("user_123", {
  name: "Jane",
})

// Delete
const { data, error } = await client.users.delete("user_123")

// Count
const { data } = await client.users.count({ role: "admin" })
```

---

## Filtering & Sorting

```typescript
const { data } = await client.posts.list({
  // Filter with operators
  filter: {
    published: true,
    authorId: "user_123",
    views: { gte: 100 },
    title: { contains: "TypeScript" },
  },

  // Sort by field
  sort: { createdAt: "desc" },

  // Pagination
  take: 10,
  skip: 0,

  // Include relations
  include: ["author", "comments"],
})
```

---

## Entity Actions

```typescript
// Collection action (no ID)
await client.users.action("invite", { email: "new@example.com" })

// Resource action (with ID)
await client.posts.action("publish", "post_123")

// Resource action with input
await client.orders.action("checkout", "order_123", {
  paymentMethodId: "pm_123",
})
```

---

## Error Handling

```typescript
const { data, error } = await client.users.create({ 
  name: "", 
  email: "invalid" 
})

if (error) {
  console.log(error.status)  // 400
  console.log(error.code)    // "VALIDATION_ERROR"
  console.log(error.message) // Validation errors
  console.log(error.details) // Detailed error info
}
```

---

## Authentication

```typescript
// Sign in (uses cookies automatically)
await client.auth.signIn.email({
  email: "user@example.com",
  password: "password",
})

// Get session
const { data } = await client.auth.getSession()

// Sign out
await client.auth.signOut()
```

---

## Custom Requests

Use `$fetch` for endpoints not covered by plugins:

```typescript
const { data, error } = await client.$fetch<Stats>("/custom/stats", {
  method: "GET",
  query: { period: "7d" },
})
```

---

## Type Safety

For full E2E type safety, import your server types:

```typescript
import { createClient, entityClient } from "nevr/client"
import type { API } from "../server/api"

type Entities = API["$Infer"]["Entities"]

const client = createClient({
  plugins: [entityClient({ entities: ["user", "post"] })],
}) as InferEntitiesFromServer<Entities>

// Now fully typed!
const { data } = await client.users.list()
//    ^? User[]
```

---

## Next Steps

- [React Integration](/client/react)
- [Entity Client](/client/entity-client)
- [Fetch Utilities](/client/fetch)
