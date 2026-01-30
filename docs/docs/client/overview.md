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

The main factory function to create a Nevr client with full type inference:

```typescript
import { createClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

// Use curried pattern for full type inference
const client = createClient<API>()({
  baseURL: "http://localhost:3000",
  basePath: "/api",
  plugins: [authClient()],
  entities: ["user", "product"],  // Runtime entity methods
})
```

::: tip Why the curried pattern?
`createClient<API>()({...})` ensures TypeScript infers both your API entity types AND plugin action types. Without it, plugin types may not be inferred correctly.
:::

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

Use the `entities` option to auto-generate typed CRUD methods:

```typescript
import { createClient } from "nevr/client"
import type { API } from "./server/api"

const client = createClient<API>()({
  baseURL: "http://localhost:3000",
  entities: ["user", "product", "order"],  // Creates runtime CRUD methods
})

// Auto-generated methods with types from API
await client.users.list()
await client.users.create({ email: "test@test.com" })
await client.users.get("user_123")
await client.users.update("user_123", { name: "New Name" })
await client.users.delete("user_123")
await client.users.count({ role: "admin" })
await client.users.action("verify", "user_123", { token: "abc" })
```

::: info Entity names are pluralized
The entity name `"user"` becomes `client.users.*`, `"product"` becomes `client.products.*`, etc.
:::

---

## Auth Plugin

All auth methods are namespaced under `client.auth.*`:

```typescript
import { createClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

const client = createClient<API>()({
  plugins: [authClient()]
})

// Auth methods under `auth` namespace
await client.auth.signUp.email({ email: "...", password: "...", name: "..." })
await client.auth.signIn.email({ email: "...", password: "..." })
await client.auth.signOut()
const session = await client.auth.getSession()

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

::: code-group

```typescript [src/nevr.config.ts]
import { defineConfig } from "nevr"
import { createPlugin } from "nevr/plugins"
import { user } from "./entities/user.js"

export const analyticsPlugin = createPlugin({
  id: "analytics",
  endpoints: {
    track: { method: "POST", path: "/track", handler: async (ctx) => { ... } },
    getStats: { method: "GET", path: "/stats", handler: async (ctx) => { ... } },
  },
})

export const config = defineConfig({
  database: "sqlite",
  entities: [user],
  plugins: [analyticsPlugin],
})

export default config
```

```typescript [src/server.ts]
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

export const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
export type Api = typeof api
```

```typescript [src/client.ts]
import { createClient } from "nevr/client"
import { analyticsPlugin } from "./nevr.config.js"
import type { Api } from "./server"

const client = createClient<Api>()({
  baseURL: "/api",
  plugins: [analyticsPlugin],  // Just pass the server plugin!
})

// Auto-wired methods!
await client.analytics.track.create({ event: "page_view" })
const { data } = await client.analytics.getStats.list({ period: "7d" })
```

:::

### Pre-built Plugins

| Plugin | Namespace | Example |
|:--|:--|:--|
| `authClient()` | `client.auth.*` | `client.auth.signIn.email()` |
| `usernameClient()` | `client.auth.*` | `client.auth.signIn.username()` |
| `phoneNumberClient()` | `client.auth.*` | `client.auth.phoneNumber.sendOTP()` |
| `organizationClient()` | `client.org.*` | `client.org.create()` |
| `storageClient()` | `client.storage.*` | `client.storage.upload()` |
| `paymentClient()` | `client.payment.*` | `client.payment.subscribe()` |
| `aiClient()` | `client.ai.*` | `client.ai.chat()` |
| `ragClient()` | `client.rag.*` | `client.rag.search()` |

```typescript
import { createClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import { usernameClient } from "nevr/plugins/auth/username/client"
import { organizationClient } from "nevr/plugins/organization/client"
import type { API } from "./server/api"

const client = createClient<API>()({
  entities: ["user", "product"],
  plugins: [
    authClient(),
    usernameClient(),
    organizationClient(),
  ],
})

// Entities
await client.users.list()

// Auth (namespaced)
await client.auth.signIn.email({ email, password })
await client.auth.signIn.username({ username, password })

// Organization (namespaced)
await client.org.create({ name: "My Org" })
```

> **💡 Tip**: For custom plugins, define endpoints on the server and pass the plugin to the client. No need for separate client plugin definitions.

---

## Middleware

Add middleware for all requests:

```typescript
const client = createClient<API>()({
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
const client = createClient<API>()({
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

::: code-group

```typescript [src/entities/user.ts]
import { entity, string, int, belongsTo } from "nevr"

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
```

```typescript [src/nevr.config.ts]
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { user, product } from "./entities/user.js"

export const config = defineConfig({
  database: "sqlite",
  entities: [user, product],
  plugins: [auth()],
})

export default config
```

```typescript [src/server.ts]
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

export const api = nevr({ ...config, driver: prisma(new PrismaClient()) })

// Export types for client consumption
export type API = typeof api
export type User = API["$Infer"]["Entities"]["user"]
export type Product = API["$Infer"]["Entities"]["product"]
```

```typescript [src/client.ts]
import { createClient, entityClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API, User, Product } from "./server"  // Type-only import!

const client = createClient<API>()({
  baseURL: "http://localhost:3000",
  entities: ["user", "product"],
  plugins: [
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

:::

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
| `createClient<T>(options)` | Create typed client instance |
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
