# CRUD Operations

Complete guide to Create, Read, Update, Delete operations in Nevr with both HTTP and TypeScript client examples.

---

## Overview

Nevr auto-generates RESTful CRUD endpoints for every entity. This guide covers:
- HTTP API usage (curl, fetch, any HTTP client)
- TypeScript client usage (type-safe)
- Response formats and error handling

---

## HTTP API Reference

### Base URL Configuration

```typescript
// Server setup
import express from "express"
import { nevr, expressAdapter } from "nevr"

const api = nevr({ entities: [user, post, product] })
const app = express()

app.use("/api", expressAdapter(api))
// All entity routes available at /api/{entities}
```

Entity names are pluralized automatically:
- `user` → `/api/users`
- `post` → `/api/posts`
- `category` → `/api/categories`

---

## List Records

**Endpoint:** `GET /{entities}`

### HTTP Request

```bash
# Basic list
curl http://localhost:3000/api/users

# With pagination
curl "http://localhost:3000/api/users?limit=10&page=1"

# With filtering
curl "http://localhost:3000/api/users?filter[role]=admin"

# With sorting
curl "http://localhost:3000/api/users?sort=-createdAt"

# With relations
curl "http://localhost:3000/api/posts?include=author,comments"
```

### TypeScript Client

```typescript
import { createTypedClient, entityClient } from "nevr/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [entityClient({ entities: ["user", "post", "product"] })]
})

// Basic list
const { data, error } = await client.users.list()

// With options
const { data } = await client.users.list({
  filter: { role: "admin" },
  sort: { createdAt: "desc" },
  take: 10,
  skip: 0,
  include: ["posts"]
})

// Access data
data?.data.forEach(user => {
  console.log(user.id, user.email)
})

// Pagination info
console.log(data?.pagination)
// { total: 100, limit: 10, offset: 0 }
```

### Response Format

```typescript
// Success (200 OK)
{
  data: [
    { id: "user_1", email: "alice@example.com", name: "Alice" },
    { id: "user_2", email: "bob@example.com", name: "Bob" }
  ],
  pagination: {
    total: 50,
    limit: 20,
    offset: 0
  }
}

// Error (400/401/403/500)
{
  error: "Unauthorized",
  code: "UNAUTHORIZED"
}
```

---

## Get Single Record

**Endpoint:** `GET /{entities}/{id}`

### HTTP Request

```bash
# Get by ID
curl http://localhost:3000/api/users/user_123

# With relations
curl "http://localhost:3000/api/users/user_123?include=posts,profile"
```

### TypeScript Client

```typescript
// Get by ID
const { data, error } = await client.users.get("user_123")

if (error) {
  console.error(error.message) // "User not found"
  console.error(error.status)  // 404
  console.error(error.code)    // "NOT_FOUND"
  return
}

console.log(data?.id)    // "user_123"
console.log(data?.email) // "alice@example.com"
```

### Response Format

```typescript
// Success (200 OK)
{
  id: "user_123",
  email: "alice@example.com",
  name: "Alice",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}

// Not Found (404)
{
  error: "Not found",
  code: "NOT_FOUND"
}
```

---

## Create Record

**Endpoint:** `POST /{entities}`

### HTTP Request

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice",
    "password": "secret123"
  }'
```

### TypeScript Client

```typescript
const { data, error } = await client.users.create({
  email: "alice@example.com",
  name: "Alice",
  password: "secret123"
})

if (error) {
  if (error.code === "VALIDATION_ERROR") {
    console.error("Validation failed:", error.details)
  }
  return
}

console.log("Created user:", data?.id)
```

### Response Format

```typescript
// Success (201 Created)
{
  id: "user_abc123",
  email: "alice@example.com",
  name: "Alice",
  createdAt: "2024-01-01T12:00:00.000Z",
  updatedAt: "2024-01-01T12:00:00.000Z"
}

// Validation Error (400)
{
  error: "Validation failed",
  code: "VALIDATION_ERROR",
  details: {
    errors: [
      { field: "email", message: "Invalid email format" },
      { field: "password", message: "Password must be at least 8 characters" }
    ]
  }
}

// Conflict (409)
{
  error: "Email already exists",
  code: "CONFLICT"
}
```

---

## Update Record

**Endpoint:**
- `PUT /{entities}/{id}` - Full replacement
- `PATCH /{entities}/{id}` - Partial update

### HTTP Request

```bash
# Partial update (PATCH)
curl -X PATCH http://localhost:3000/api/users/user_123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Updated"
  }'

# Full update (PUT)
curl -X PUT http://localhost:3000/api/users/user_123 \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice Updated",
    "role": "admin"
  }'
```

### TypeScript Client

```typescript
// Partial update
const { data, error } = await client.users.update("user_123", {
  name: "Alice Updated"
})

// Full update
const { data, error } = await client.users.update("user_123", {
  email: "alice@example.com",
  name: "Alice Updated",
  role: "admin"
})

if (error) {
  if (error.status === 404) {
    console.error("User not found")
  }
  return
}

console.log("Updated:", data?.name)
```

### Response Format

```typescript
// Success (200 OK)
{
  id: "user_123",
  email: "alice@example.com",
  name: "Alice Updated",
  role: "admin",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z"
}

// Not Found (404)
{
  error: "Not found",
  code: "NOT_FOUND"
}
```

---

## Delete Record

**Endpoint:** `DELETE /{entities}/{id}`

### HTTP Request

```bash
curl -X DELETE http://localhost:3000/api/users/user_123
```

### TypeScript Client

```typescript
const { data, error } = await client.users.delete("user_123")

if (error) {
  console.error("Delete failed:", error.message)
  return
}

console.log("Deleted successfully")
```

### Response Format

```typescript
// Success (200 OK)
{
  success: true
}

// Not Found (404)
{
  error: "Not found",
  code: "NOT_FOUND"
}

// Forbidden (403)
{
  error: "Cannot delete: record has dependencies",
  code: "FORBIDDEN"
}
```

---

## Count Records

**Endpoint:** `GET /{entities}/count`

### HTTP Request

```bash
# Count all
curl http://localhost:3000/api/users/count

# Count with filter
curl "http://localhost:3000/api/users/count?filter[role]=admin"
```

### TypeScript Client

```typescript
// Count all
const { data } = await client.users.count()
console.log(data?.count) // 150

// Count with filter
const { data } = await client.users.count({ role: "admin" })
console.log(data?.count) // 5
```

---

## Entity Actions

Call custom actions defined on entities.

### HTTP Request

```bash
# Resource action (with ID)
curl -X POST http://localhost:3000/api/posts/post_123/publish

# Resource action with input
curl -X POST http://localhost:3000/api/orders/order_123/checkout \
  -H "Content-Type: application/json" \
  -d '{ "paymentMethodId": "pm_xxx" }'

# Collection action (no ID)
curl -X POST http://localhost:3000/api/products/bulk-publish \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["prod_1", "prod_2", "prod_3"] }'
```

### TypeScript Client

```typescript
// Resource action with ID
await client.posts.action("publish", "post_123")

// Resource action with ID and input
await client.orders.action("checkout", "order_123", {
  paymentMethodId: "pm_xxx"
})

// Collection action (no ID)
await client.products.action("bulkPublish", {
  ids: ["prod_1", "prod_2", "prod_3"]
})
```

---

## Batch Operations

### TypeScript Client

```typescript
// Parallel requests
const [users, posts, products] = await Promise.all([
  client.users.list({ take: 5 }),
  client.posts.list({ filter: { published: true } }),
  client.products.list({ filter: { inStock: true } })
])

// Sequential with dependencies
const { data: user } = await client.users.get("user_123")
if (user) {
  const { data: posts } = await client.posts.list({
    filter: { authorId: user.id }
  })
}
```

---

## Error Handling

### TypeScript Client

```typescript
const { data, error } = await client.users.create({
  email: "test@example.com",
  name: "Test User"
})

if (error) {
  switch (error.status) {
    case 400:
      // Validation error
      console.error("Invalid input:", error.details)
      break
    case 401:
      // Unauthorized
      console.error("Please log in")
      break
    case 403:
      // Forbidden
      console.error("Permission denied")
      break
    case 404:
      // Not found
      console.error("Resource not found")
      break
    case 409:
      // Conflict (duplicate)
      console.error("Already exists")
      break
    case 500:
      // Server error
      console.error("Server error, please retry")
      break
    default:
      console.error("Unknown error:", error.message)
  }
  return
}

// Success
console.log("Created:", data)
```

### HTTP Error Codes

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Success (GET, PUT, PATCH, DELETE) |
| 201 | Created | Success (POST create) |
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Permission denied |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate or constraint violation |
| 500 | Internal Error | Server error |

---

## React Integration

```tsx
import { useQuery, useMutation } from "nevr/client/react"

function UserList() {
  // List with auto-refetch
  const { data, error, isPending, refetch } = useQuery(
    () => client.users.list({ take: 10 })
  )

  // Create mutation
  const createUser = useMutation(
    (input) => client.users.create(input)
  )

  // Delete mutation
  const deleteUser = useMutation(
    (id) => client.users.delete(id)
  )

  if (isPending) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <form onSubmit={async (e) => {
        e.preventDefault()
        const form = new FormData(e.target)
        await createUser.execute({
          email: form.get("email"),
          name: form.get("name")
        })
        refetch()
      }}>
        <input name="email" type="email" required />
        <input name="name" required />
        <button disabled={createUser.isPending}>
          {createUser.isPending ? "Creating..." : "Create User"}
        </button>
      </form>

      <ul>
        {data?.data.map(user => (
          <li key={user.id}>
            {user.name} ({user.email})
            <button onClick={async () => {
              await deleteUser.execute(user.id)
              refetch()
            }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

## Vanilla JavaScript

```javascript
// Using fetch directly
async function createUser(userData) {
  const response = await fetch("http://localhost:3000/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify(userData)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }

  return response.json()
}

// Usage
try {
  const user = await createUser({
    email: "test@example.com",
    name: "Test User"
  })
  console.log("Created:", user)
} catch (error) {
  console.error("Failed:", error.message)
}
```

---

## Next Steps

- [Filtering & Sorting](/guides/filtering) - Advanced query options
- [Custom Endpoints](/guides/custom-endpoints) - Business logic endpoints
- [Entity Client](/client/entity-client) - TypeScript client details
- [React Integration](/client/react) - React hooks and patterns
