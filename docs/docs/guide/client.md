# Type-Safe Client

Nevr provides end-to-end type safety from server to client. Define entities on the server, get fully typed API calls on the frontend.

## Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         SERVER                               │
│  entity("user", { email: string, name: string })             │
│  entity("post", { title: string, author: belongsTo(user) })  │
└──────────────────────────────────────────────────────────────┘
                            ↓ Types flow automatically
┌──────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│  client.users.list()     // Returns User[]                   │
│  client.posts.create()   // Requires { title, authorId }     │
│  client.auth.signIn()    // From auth plugin                 │
└──────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install nevr
```

For React:
```bash
npm install @nanostores/react
```

## Creating a Client

### Vanilla Client

Framework-agnostic client:

```typescript
import { createTypedClient } from "nevr/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  basePath: "/api",
})

// Type-safe API calls
const { data, error } = await client.users.list()
const { data: user } = await client.users.read("123")
const { data: newPost } = await client.posts.create({
  title: "Hello World",
  authorId: "user-123",
})
```

### React Client

With React hooks for reactive state:

```typescript
import { createTypedClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

export const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [authClient()],
})
```

## CRUD Operations

Every entity gets automatic CRUD methods:

```typescript
// List all users with pagination
const { data, error } = await client.users.list({
  filter: { verified: true },
  sort: { createdAt: "desc" },
  take: 10,
  skip: 0,
})
// data: { data: User[], pagination: { total, limit, offset } }

// Create a new user
const { data: user } = await client.users.create({
  email: "john@example.com",
  name: "John Doe",
})

// Read a single user
const { data: user } = await client.users.read("user-123")

// Update a user
const { data: updated } = await client.users.update("user-123", {
  name: "John Updated",
})

// Delete a user
const { error } = await client.users.delete("user-123")
```

## React Hooks

### useSession

Access the current session reactively:

```tsx
import { useSession } from "nevr/client/react"
import { client } from "./client"

function Profile() {
  const { data, isPending, error } = useSession(client.useSession)

  if (isPending) return <Loading />
  if (error) return <Error message={error.message} />
  if (!data) return <LoginPrompt />

  return (
    <div>
      <h1>Hello, {data.user.name}</h1>
      <p>Email: {data.user.email}</p>
    </div>
  )
}
```

### useQuery

Fetch data with automatic loading state:

```tsx
import { useQuery } from "nevr/client/react"
import { client } from "./client"

function PostList() {
  const { data, error, isPending, refetch } = useQuery(
    () => client.posts.list({ filter: { published: true } }),
    {
      refetchInterval: 30,        // Refetch every 30 seconds
      refetchOnWindowFocus: true, // Refetch when tab gains focus
    }
  )

  if (isPending) return <Loading />
  if (error) return <Error message={error.message} />

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      <ul>
        {data?.data.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

### useMutation

Handle create/update/delete with loading state:

```tsx
import { useMutation } from "nevr/client/react"
import { client } from "./client"

function CreatePost() {
  const { execute, data, error, isPending, reset } = useMutation(
    (input: { title: string; content: string }) => client.posts.create(input)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)

    const result = await execute({
      title: formData.get("title") as string,
      content: formData.get("content") as string,
    })

    if (result.data) {
      // Success - redirect or show message
      console.log("Created:", result.data)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />

      {error && <p className="error">{error.message}</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Post"}
      </button>
    </form>
  )
}
```

## Authentication

With the auth plugin, you get type-safe auth methods:

```typescript
import { createTypedClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [authClient()],
})

// Sign up
const { data, error } = await client.auth.signUp({
  email: "user@example.com",
  password: "securepassword",
  name: "John Doe",
})

// Sign in
const { data, error } = await client.auth.signIn({
  email: "user@example.com",
  password: "securepassword",
})

// Sign out
await client.auth.signOut()

// Get current session
const { data: session } = await client.auth.getSession()
```

### Protected Routes

```tsx
import { useSession } from "nevr/client/react"
import { client } from "./client"
import { Navigate } from "react-router-dom"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession(client.useSession)

  if (isPending) return <Loading />
  if (!data) return <Navigate to="/login" />

  return <>{children}</>
}

// Usage
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

## Custom Actions

Call custom entity actions:

```typescript
// Server defines action
const order = entity("order", { ... }).actions({
  checkout: action()
    .input({ paymentMethodId: string })
    .handler(async (ctx) => { ... }),
})

// Client calls it with full type safety
const { data, error } = await client.orders.checkout("order-123", {
  paymentMethodId: "pm_xxx",
})
```

## Error Handling

All responses follow the same pattern:

```typescript
interface NevrFetchResponse<T> {
  data: T | null
  error: NevrFetchError | null
}

interface NevrFetchError {
  status: number
  statusText: string
  message: string
  code?: string
  details?: any
}
```

Usage:

```typescript
const { data, error } = await client.users.create({
  email: "invalid",
})

if (error) {
  switch (error.code) {
    case "VALIDATION_ERROR":
      // Handle validation errors
      console.log(error.details)
      break
    case "UNAUTHORIZED":
      // Redirect to login
      break
    default:
      console.error(error.message)
  }
}

if (data) {
  // Success
  console.log("Created user:", data.id)
}
```

## Reactive State with Nanostores

The client uses [nanostores](https://github.com/nanostores/nanostores) for reactive state:

```typescript
import { useStore } from "@nanostores/react"
import { client } from "./client"

function SessionIndicator() {
  // Subscribe to session atom
  const session = useStore(client.useSession)

  if (session.isPending) return <span>Loading...</span>
  if (!session.data) return <span>Not logged in</span>

  return <span>Logged in as {session.data.user.email}</span>
}
```

## Type Inference

### Infer Entity Types

```typescript
// Get entity type from client
type User = typeof client.$Infer.entities.user
type Post = typeof client.$Infer.entities.post

// Use in components
function UserCard({ user }: { user: User }) {
  return <div>{user.name}</div>
}
```

### Infer Session Type

```typescript
type Session = typeof client.$Infer.Session

// { user: User, session: { id, token, expiresAt } }
```

### Error Codes

```typescript
// All error codes from plugins
type ErrorCodes = typeof client.$ERROR_CODES

// { UNAUTHORIZED: "UNAUTHORIZED", VALIDATION_ERROR: "VALIDATION_ERROR", ... }
```

## Configuration Options

```typescript
const client = createClient({
  // API base URL
  baseURL: "http://localhost:3000",

  // API path prefix (default: "/api")
  basePath: "/api",

  // Client plugins
  plugins: [authClient()],

  // Default fetch options
  fetchOptions: {
    credentials: "include",  // Send cookies
    headers: {
      "X-Custom-Header": "value",
    },
  },

  // Session revalidation
  sessionOptions: {
    refetchInterval: 60,        // Refetch every 60 seconds
    refetchOnWindowFocus: true, // Refetch on tab focus
    refetchWhenOnline: true,    // Refetch when network returns
  },
})
```

## Low-Level Fetch

For custom requests, use `$fetch` directly:

```typescript
// Custom endpoint
const { data, error } = await client.$fetch<CustomResponse>("/custom/endpoint", {
  method: "POST",
  body: { foo: "bar" },
  query: { page: 1 },
})

// With callbacks
await client.$fetch("/endpoint", {
  onRequest: ({ url, options }) => {
    console.log("Requesting:", url)
  },
  onResponse: ({ response, data }) => {
    console.log("Response:", response.status)
  },
  onSuccess: ({ data }) => {
    console.log("Success:", data)
  },
  onError: ({ error }) => {
    console.error("Error:", error.message)
  },
})
```

## Complete Example

```tsx
// client.ts
import { createTypedClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

export const client = createTypedClient<API>({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [authClient()],
})

// App.tsx
import { useSession, useQuery, useMutation } from "nevr/client/react"
import { client } from "./client"

function App() {
  const session = useSession(client.useSession)

  if (session.isPending) return <Loading />

  return session.data ? <Dashboard /> : <Login />
}

function Dashboard() {
  const { data, isPending, refetch } = useQuery(() =>
    client.posts.list({ filter: { published: true } })
  )

  const { execute: createPost, isPending: creating } = useMutation(
    (input) => client.posts.create(input)
  )

  const handleCreate = async () => {
    const { data, error } = await createPost({
      title: "New Post",
      content: "Hello World",
    })

    if (data) {
      refetch() // Refresh list
    }
  }

  if (isPending) return <Loading />

  return (
    <div>
      <h1>My Posts</h1>
      <button onClick={handleCreate} disabled={creating}>
        {creating ? "Creating..." : "New Post"}
      </button>
      <ul>
        {data?.data.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}

function Login() {
  const { execute, error, isPending } = useMutation(
    (input: { email: string; password: string }) =>
      client.auth.signIn(input)
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const form = new FormData(e.target as HTMLFormElement)
    execute({
      email: form.get("email") as string,
      password: form.get("password") as string,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" placeholder="Email" />
      <input name="password" type="password" placeholder="Password" />
      {error && <p>{error.message}</p>}
      <button disabled={isPending}>
        {isPending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  )
}
```

## Next Steps

- [Authentication](/guide/authentication) - Auth plugin setup
- [Actions](/guide/actions) - Custom entity actions
- [Entities](/guide/entities) - Defining your data model
