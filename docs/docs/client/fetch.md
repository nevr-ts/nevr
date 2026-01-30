# Fetch Utilities

Type-safe fetch wrapper for Nevr API calls with middleware and interceptor support.

## Overview

The fetch utilities provide a powerful HTTP client with:
- Type-safe requests and responses
- Middleware chain for request modification
- Response interceptors for global error handling
- Automatic JSON parsing and error formatting

---

## createNevrFetch()

Create a configured fetch function:

```typescript
import { createNevrFetch } from "nevr/client"

const $fetch = createNevrFetch({
  baseURL: "http://localhost:3000",
  basePath: "/api",
  middleware: [authMiddleware, logMiddleware],
  interceptors: [refreshTokenInterceptor],
})

// Use it
const { data, error } = await $fetch<User[]>("/users")
```

### CreateFetchOptions

```typescript
interface CreateFetchOptions {
  /** Base URL (e.g., "http://localhost:3000") */
  baseURL: string

  /** API path prefix (e.g., "/api") */
  basePath: string

  /** Default options for all requests */
  defaultOptions?: NevrFetchOptions

  /** Legacy fetch plugins */
  plugins?: NevrFetchPlugin[]

  /** Client middleware chain */
  middleware?: ClientMiddleware[]

  /** Response interceptors */
  interceptors?: ResponseInterceptor[]
}
```

---

## NevrFetch Response

All fetch calls return a consistent response format:

```typescript
interface NevrFetchResponse<T> {
  /** Response data (null if error) */
  data: T | null
  /** Error details (null if success) */
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

### Usage Pattern

```typescript
const { data, error } = await $fetch<User>("/users/123")

if (error) {
  console.error(`Error ${error.status}: ${error.message}`)
  return
}

// data is typed as User
console.log(data.email)
```

---

## NevrFetchOptions

Options for individual requests:

```typescript
interface NevrFetchOptions {
  /** HTTP method (default: "GET") */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

  /** Request headers */
  headers?: Record<string, string>

  /** Request body (auto-serialized to JSON) */
  body?: any

  /** Query parameters */
  query?: Record<string, any>

  /** Credentials mode (default: "include") */
  credentials?: "include" | "omit" | "same-origin"

  /** Disable signal triggers on success */
  disableSignal?: boolean

  /** Custom fetch function */
  customFetch?: typeof fetch

  /** Lifecycle callbacks */
  onRequest?: (ctx: { url: string; options: RequestInit }) => void | Promise<void>
  onResponse?: (ctx: { response: Response; data: any }) => void | Promise<void>
  onSuccess?: (ctx: { data: any }) => void | Promise<void>
  onError?: (ctx: { error: NevrFetchError }) => void | Promise<void>
}
```

### Examples

```typescript
// GET with query params
const { data } = await $fetch<User[]>("/users", {
  query: { role: "admin", limit: 10 },
})
// Calls: GET /api/users?role=admin&limit=10

// POST with body
const { data } = await $fetch<User>("/users", {
  method: "POST",
  body: { email: "new@example.com", name: "New User" },
})

// With custom headers
const { data } = await $fetch("/protected", {
  headers: { "X-Custom-Header": "value" },
})

// With lifecycle hooks
const { data } = await $fetch("/users", {
  onRequest: ({ url }) => console.log(`Fetching ${url}`),
  onSuccess: ({ data }) => console.log(`Got ${data.length} users`),
  onError: ({ error }) => console.error(`Failed: ${error.message}`),
})
```

---

## Client Middleware

Middleware intercepts requests before they're sent. Use for:
- Adding auth tokens
- Logging
- Retry logic
- Request modification

### ClientMiddleware Type

```typescript
type ClientMiddleware = (
  ctx: MiddlewareRequestContext,
  next: () => Promise<MiddlewareResponseContext>
) => Promise<MiddlewareResponseContext>

interface MiddlewareRequestContext {
  url: string
  path: string
  method: string
  headers: Record<string, string>  // Mutable
  body?: unknown                   // Mutable
  query?: Record<string, any>
  abort: (response: NevrFetchResponse<any>) => void
  aborted: boolean
}

interface MiddlewareResponseContext {
  request: MiddlewareRequestContext
  data: any
  error: NevrFetchError | null
  status: number
  ok: boolean
}
```

### Middleware Examples

#### Auth Middleware

```typescript
const authMiddleware: ClientMiddleware = async (ctx, next) => {
  const token = localStorage.getItem("token")
  if (token) {
    ctx.headers["Authorization"] = `Bearer ${token}`
  }
  return next()
}
```

#### Logging Middleware

```typescript
const logMiddleware: ClientMiddleware = async (ctx, next) => {
  const start = Date.now()
  console.log(`[Request] ${ctx.method} ${ctx.path}`)

  const result = await next()

  const duration = Date.now() - start
  console.log(`[Response] ${result.status} (${duration}ms)`)

  return result
}
```

#### Retry Middleware

```typescript
const retryMiddleware: ClientMiddleware = async (ctx, next) => {
  let result = await next()

  // Retry once on 5xx errors
  if (result.error && result.status >= 500) {
    console.log(`Retrying ${ctx.path}...`)
    result = await next()
  }

  return result
}
```

#### Abort Middleware

```typescript
const cacheMiddleware: ClientMiddleware = async (ctx, next) => {
  const cached = cache.get(ctx.url)
  if (cached) {
    // Return cached response without making request
    ctx.abort({ data: cached, error: null })
    return { request: ctx, data: cached, error: null, status: 200, ok: true }
  }

  const result = await next()

  if (result.ok) {
    cache.set(ctx.url, result.data)
  }

  return result
}
```

#### Request Body Transform

```typescript
const transformMiddleware: ClientMiddleware = async (ctx, next) => {
  // Add timestamps to all POST/PUT requests
  if (ctx.body && ["POST", "PUT"].includes(ctx.method)) {
    ctx.body = {
      ...ctx.body,
      _timestamp: Date.now(),
    }
  }
  return next()
}
```

---

## Response Interceptors

Interceptors run after receiving a response. Use for:
- Token refresh on 401
- Global error handling
- Data transformation

### ResponseInterceptor Type

```typescript
type ResponseInterceptor = (
  ctx: MiddlewareResponseContext
) => Promise<MiddlewareResponseContext | { retry: true }>
```

### Interceptor Examples

#### Token Refresh

```typescript
const refreshInterceptor: ResponseInterceptor = async (ctx) => {
  if (ctx.error?.status === 401) {
    // Try to refresh token
    const refreshed = await refreshToken()

    if (refreshed) {
      // Signal to retry the original request
      return { retry: true }
    }

    // Refresh failed, redirect to login
    window.location.href = "/login"
  }

  return ctx
}
```

#### Date Transform

```typescript
const dateInterceptor: ResponseInterceptor = async (ctx) => {
  if (ctx.data) {
    ctx.data = transformDates(ctx.data)
  }
  return ctx
}

function transformDates(obj: any): any {
  if (!obj) return obj

  if (typeof obj === "string" && isISODate(obj)) {
    return new Date(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(transformDates)
  }

  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, transformDates(v)])
    )
  }

  return obj
}
```

#### Error Normalization

```typescript
const errorInterceptor: ResponseInterceptor = async (ctx) => {
  if (ctx.error) {
    // Normalize error format
    ctx.error = {
      ...ctx.error,
      message: ctx.error.message || "An unexpected error occurred",
      code: ctx.error.code || "UNKNOWN_ERROR",
    }

    // Log errors
    console.error(`[API Error] ${ctx.error.code}: ${ctx.error.message}`)
  }

  return ctx
}
```

---

## Full Client Setup

```typescript
import { createClient } from "nevr/client"
import type { API } from "./server/api"

// ... (middleware defined above)

// Use curried pattern for full type inference
const client = createClient<API>()({
  baseURL: "http://localhost:3000",
  basePath: "/api",
  middleware: [authMiddleware, logMiddleware],
  interceptors: [refreshInterceptor],
  entities: ["user", "post", "product"],
})

// Use the client
const { data, error } = await client.users.list()

// Or use $fetch directly for custom endpoints
const { data: stats } = await client.$fetch<Stats>("/stats")
```

---

## Middleware Execution Order

Middleware executes in order, wrapping each subsequent middleware:

```typescript
const client = createClient<API>()({
  middleware: [first, second, third],
})

// Execution:
// 1. first (before)
// 2. second (before)
// 3. third (before)
// 4. actual fetch
// 5. third (after)
// 6. second (after)
// 7. first (after)
```

```
Request → first → second → third → fetch() → third → second → first → Response
```

---

## Query String Building

Query parameters are automatically serialized:

```typescript
$fetch("/users", {
  query: {
    role: "admin",
    status: ["active", "pending"],  // Arrays supported
    page: 1,
    limit: 10,
  },
})
// URL: /api/users?role=admin&status=active&status=pending&page=1&limit=10
```

---

## Error Handling Patterns

### Pattern 1: Per-Request

```typescript
const { data, error } = await $fetch("/users")

if (error) {
  if (error.status === 404) {
    console.log("Not found")
  } else if (error.status === 401) {
    console.log("Unauthorized")
  } else {
    console.log(`Error: ${error.message}`)
  }
  return
}
```

### Pattern 2: Global Interceptor

```typescript
const errorInterceptor: ResponseInterceptor = async (ctx) => {
  if (ctx.error) {
    switch (ctx.error.status) {
      case 401:
        window.location.href = "/login"
        break
      case 403:
        toast.error("Access denied")
        break
      case 500:
        toast.error("Server error, please try again")
        break
    }
  }
  return ctx
}
```

### Pattern 3: onError Callback

```typescript
$fetch("/users", {
  onError: ({ error }) => {
    Sentry.captureException(new Error(error.message))
  },
})
```

---

## TypeScript Types

```typescript
import type {
  NevrFetch,
  NevrFetchOptions,
  NevrFetchResponse,
  NevrFetchError,
  ClientMiddleware,
  ResponseInterceptor,
  MiddlewareRequestContext,
  MiddlewareResponseContext,
} from "nevr/client"
```

---

## Next Steps

- [Client Overview](/client/overview) - Full client setup
- [Entity Client](/client/entity-client) - Auto-generated CRUD
- [React Integration](/client/react) - React hooks
