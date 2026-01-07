# Client Overview

Type-safe frontend client for Nevr APIs with reactive state management using nanostores.

## Installation

```bash
npm install nevr
# or
pnpm add nevr
```

---

## createClient()

The main factory function to create a Nevr client:

```typescript
import { createTypedClient } from "nevr/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  basePath: "/api",
})
```

> [!NOTE]
> For advanced use cases without type inference, you can use `createClient(options)`.

### NevrClientOptions

```typescript
interface NevrClientOptions {
  /** Base URL for API requests */
  baseURL?: string

  /** Base path prefix (default: "/api") */
  basePath?: string

  /** Client plugins */
  plugins?: NevrClientPlugin[]

  /** Request middleware */
  middleware?: ClientMiddleware[]

  /** Response interceptors */
  interceptors?: ResponseInterceptor[]

  /** Default fetch options */
  fetchOptions?: NevrFetchOptions

  /** Session revalidation options */
  sessionOptions?: SessionRevalidateOptions
}
```

---

## Client Properties

| Property | Type | Description |
|----------|------|-------------|
| `$fetch` | `NevrFetch` | Raw fetch function for custom requests |
| `$store` | `ClientStore` | Reactive store for state management |
| `useSession` | `Atom<SessionState>` | Session state atom |
| `$Infer` | `object` | Type inference helpers |
| `$ERROR_CODES` | `object` | Error codes from plugins |

---

## Entity Methods

Use `entityClient()` plugin to auto-generate CRUD methods:

```typescript
import { createTypedClient, entityClient } from "nevr/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [
    entityClient({ entities: ["user", "product", "order"] })
  ]
})

// Auto-generated methods
await client.users.list()
await client.users.create({ email: "test@test.com" })
await client.users.get("user_123")
await client.users.update("user_123", { name: "New Name" })
await client.users.delete("user_123")
await client.users.count({ role: "admin" })
await client.users.action("verify", "user_123", { token: "abc" })
```

---

## Auth Plugin

```typescript
import { createTypedClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
  plugins: [authClient()]
})

// Auth methods
await client.signUp.email({ email: "...", password: "...", name: "..." })
await client.signIn.email({ email: "...", password: "..." })
await client.signOut()
const session = await client.getSession()

// Reactive session
client.useSession.subscribe(({ data, isPending, error }) => {
  console.log("Session:", data?.user)
})
```

---

## Plugin Clients

Nevr **auto-wires** plugin endpoints to the client. You don't need to manually define client plugins for most cases.

### How It Works

When you use a server plugin with `endpoints{}`, the client automatically creates typed methods:

```typescript
// === Server ===
import { createPlugin } from "nevr/plugins"

export const analyticsPlugin = createPlugin({
  id: "analytics",
  endpoints: {
    track: { method: "POST", path: "/track", handler: async (ctx) => { ... } },
    getStats: { method: "GET", path: "/stats", handler: async (ctx) => { ... } },
  },
})

export const api = nevr({
  entities: [user],
  plugins: [analyticsPlugin],
})

// === Client ===
import { createTypedClient } from "nevr/client"
import type { Api } from "./server"

const client = createTypedClient<Api>({
  baseURL: "/api",
  plugins: [analyticsPlugin],  // Just pass the server plugin!
})

// Auto-wired methods!
await client.analytics.track({ event: "page_view" })
const { data } = await client.analytics.getStats({ period: "7d" })
```

### Pre-built Plugins

| Plugin | Namespace | Description |
|:--|:--|:--|
| `entityClient({ entities })` | `{entity}s` | CRUD methods (list, get, create, update, delete) |
| `authClient()` | `auth` | Auth with reactive session state |

```typescript
import { createTypedClient, entityClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
  plugins: [
    entityClient({ entities: ["user", "product"] }),
    authClient(),
  ],
})

await client.users.list()
await client.signIn.email({ email, password })
```

> **💡 Tip**: For custom plugins, define endpoints on the server and pass the plugin to the client. No need for separate client plugin definitions.

---

## Middleware

Add middleware for all requests:

```typescript
const client = createTypedClient<API>({
  middleware: [
    // Auth middleware
    async (ctx, next) => {
      const token = localStorage.getItem("token")
      if (token) {
        ctx.headers["Authorization"] = `Bearer ${token}`
      }
      return next()
    },

    // Logging middleware
    async (ctx, next) => {
      console.log(`${ctx.method} ${ctx.path}`)
      const result = await next()
      console.log(`Response: ${result.status}`)
      return result
    },

    // Retry middleware
    async (ctx, next) => {
      let result = await next()
      if (result.error && result.status >= 500) {
        result = await next() // Retry once
      }
      return result
    },
  ],
})
```

### MiddlewareRequestContext

```typescript
interface MiddlewareRequestContext {
  url: string
  path: string
  method: string
  headers: Record<string, string>  // Mutable
  body?: unknown                   // Mutable
  query?: Record<string, any>
  abort: (response: NevrFetchResponse) => void
  aborted: boolean
}
```

---

## Response Interceptors

Handle responses globally:

```typescript
const client = createTypedClient<API>({
  interceptors: [
    // Refresh token on 401
    async (ctx) => {
      if (ctx.error?.status === 401) {
        await refreshToken()
        return { retry: true }
      }
      return ctx
    },

    // Transform dates
    async (ctx) => {
      if (ctx.data) {
        ctx.data = transformDates(ctx.data)
      }
      return ctx
    },
  ],
})
```

---

## $fetch - Raw Fetch

Make custom API calls:

```typescript
// GET request
const { data, error } = await client.$fetch("/custom/endpoint", {
  method: "GET",
  query: { page: 1 },
})

// POST request
const { data, error } = await client.$fetch("/orders/checkout", {
  method: "POST",
  body: { paymentMethodId: "pm_xxx" },
})

// With callbacks
await client.$fetch("/users", {
  onRequest: ({ url, options }) => console.log("Requesting:", url),
  onResponse: ({ response, data }) => console.log("Response:", data),
  onSuccess: ({ data }) => console.log("Success:", data),
  onError: ({ error }) => console.error("Error:", error),
})
```

### NevrFetchOptions

```typescript
interface NevrFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  headers?: Record<string, string>
  body?: any
  query?: Record<string, any>
  credentials?: "include" | "omit" | "same-origin"
  disableSignal?: boolean
  customFetch?: typeof fetch
  onRequest?: (ctx: { url: string; options: RequestInit }) => void
  onResponse?: (ctx: { response: Response; data: any }) => void
  onSuccess?: (ctx: { data: any }) => void
  onError?: (ctx: { error: NevrFetchError }) => void
}
```

### NevrFetchResponse

```typescript
interface NevrFetchResponse<T> {
  data: T | null
  error: NevrFetchError | null
}
```

### NevrFetchError

```typescript
interface NevrFetchError {
  status: number
  statusText: string
  message: string
  code?: string
  details?: any
}
```

---

## Type Inference

Full end-to-end type safety is the core feature that makes Nevr a true full-stack TypeScript framework.

### Server → Client Type Flow

```typescript
// === server.ts ===
import { nevr, entity, string, int, belongsTo } from "nevr"
import { auth } from "nevr/plugins/auth"

export const user = entity("user", {
  name: string,
  email: string.email(),
  role: string.default("user"),
})

export const product = entity("product", {
  name: string,
  price: int,
  ownerId: belongsTo(user),
})

export const api = nevr({
  entities: [user, product],
  plugins: [auth()],
})

// Export types for client consumption
export type API = typeof api
export type User = API["$Infer"]["Entities"]["user"]
export type Product = API["$Infer"]["Entities"]["product"]
```

```typescript
// === client.ts ===
import { createTypedClient, entityClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API, User, Product } from "./server"  // Type-only import!

const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [
    entityClient({ entities: ["user", "product"] }),
    authClient(),
  ],
})

// Fully typed - IDE autocomplete and type checking!
const { data: users } = await client.users.list()
//    ^? User[]

const { data: product } = await client.products.create({
  name: "Widget",      // ✅ Required
  price: 100,          // ✅ Required
  // unknownField: 1,  // ❌ Type error!
})

const session = await client.auth.getSession()
//    ^? { user: User; session: Session } | null
```

### Infer Types from Client

```typescript
import type { 
  InferSessionFromClient, 
  InferUserFromClient,
  InferEntityClient,
} from "nevr/client"

// Infer session type from client
type Session = InferSessionFromClient<typeof client>
//   ^? { user: User; session: SessionData; expires: Date }

// Infer user type from client
type ClientUser = InferUserFromClient<typeof client>
//   ^? { id: string; name: string; email: string; role: string; ... }

// Infer entity client types
type UserMethods = InferEntityClient<typeof client, "user">
//   ^? { list, get, create, update, delete, count, action }
```

### Typed Filtering & Sorting

```typescript
// Filter with full type safety
const { data } = await client.products.list({
  filter: {
    price: { gte: 100 },        // ✅ Number operators
    name: { contains: "Widget" }, // ✅ String operators
    // unknownField: { eq: 1 },  // ❌ Type error!
  },
  sort: {
    createdAt: "desc",  // ✅ Must be valid field
  },
  take: 10,  // ✅ Number of records to return (limit)
  skip: 0,   // ✅ Number of records to skip (offset)
  include: {
    ownerId: true,
  }, // ✅ Include related entities
})
```

### React Integration with Types

```tsx
import { useEffect, useState } from "react"
import { useStore } from "@nanostores/react"
import { client } from "./client"
import type { User, Product } from "./server"

function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const session = useStore(client.useSession)
  
  useEffect(() => {
    client.products.list().then(({ data }) => {
      if (data) setProducts(data.data)
    })
  }, [])
  
  // session.data?.user is fully typed!
  if (!session.data?.user) {
    return <div>Please sign in</div>
  }
  
  return (
    <div>
      <h1>Welcome, {session.data.user.name}</h1>
      {products.map((p) => (
        <div key={p.id}>{p.name}: ${p.price}</div>
      ))}
    </div>
  )
}
```

### Error Type Inference

```typescript
const { data, error } = await client.products.create({
  name: "Widget",
  price: 100,
})

if (error) {
  // error.code is typed based on registered error codes
  switch (error.code) {
    case "VALIDATION_ERROR":
      console.log("Invalid data:", error.details)
      break
    case "UNAUTHORIZED":
      client.auth.signOut()
      break
    default:
      console.error(error.message)
  }
}
```

---

## Client Exports Reference

**From `nevr/client`:**

| Export | Description |
|--------|-------------|
| `createTypedClient<T>(options)` | Create typed client instance |
| `createClient(options)` | Create Nevr client instance |
| `entityClient(options)` | Plugin for auto-generated CRUD methods |
| `createNevrFetch(options)` | Create standalone fetch function |
| `createClientStore()` | Create reactive store |
| `createSessionAtom()` | Create session state atom |
| `createSignalAtom()` | Create signal-based atom |
| `createDynamicProxy()` | Create dynamic method proxy |

**Types (from `nevr/client`):**

| Type | Description |
|------|-------------|
| `NevrClient` | Client instance type |
| `NevrClientOptions` | Client configuration |
| `NevrClientPlugin` | Plugin interface |
| `ClientMiddleware` | Middleware function type |
| `ResponseInterceptor` | Response interceptor type |
| `NevrFetch` | Fetch function type |
| `SessionState` | Session state shape |
| `ListOptions` | Query options for list() |
| `ListResponse` | Paginated response type |
| `InferClientAPI` | Infer client from server |
| `InferEntityClient` | Infer entity methods |

**From `nevr/plugins/auth/client`:**

| Export | Description |
|--------|-------------|
| `authClient(options)` | Auth plugin with reactive session state |



## Next Steps

- [Entity Client](/client/entity-client) - CRUD methods
- [React Integration](/client/react) - React hooks
- [Store & Atoms](/client/store) - Reactive state
- [Fetch Utilities](/client/fetch) - Custom requests
