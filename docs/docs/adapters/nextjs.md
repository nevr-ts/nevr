# Next.js Adapter

Use Nevr with Next.js App Router.

## Scaffolding (Recommended)

```bash
npm create nevr@latest my-app --template nextjs
```

This creates a complete Next.js project with Nevr pre-configured.

## Manual Installation

```bash
npm install nevr next react react-dom
npm install -D @types/react @types/react-dom typescript
```

## Setup

### 1. Create Nevr Instance

```typescript
// lib/nevr.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { user, post } from "./entities"

const db = new PrismaClient()

export const api = nevr({
  entities: [user, post],
  driver: prisma(db),
})
```

### 2. Create API Route Handler

```typescript
// app/api/[...nevr]/route.ts
import { toNextHandler } from "nevr/adapters/nextjs"
import { api } from "@/lib/nevr"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api)
```

That's it! Your API is now available at `/api/*`.

## With Authentication

### 1. Add Auth Plugin

```typescript
// lib/nevr.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { auth } from "nevr/plugins/auth"
import { nextCookies } from "nevr/adapters/nextjs"

export const api = nevr({
  entities: [user, post],
  driver: prisma(db),
  plugins: [
    auth({ emailAndPassword: true }),
    nextCookies(), // Required for cookie handling in Server Components
  ],
})
```

### 2. Use Session Auth in Route Handler

```typescript
// app/api/[...nevr]/route.ts
import { toNextHandler, sessionAuth } from "nevr/adapters/nextjs"
import { api } from "@/lib/nevr"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api, {
  getUser: sessionAuth(api),
  debugLogs: process.env.NODE_ENV !== "production",
})
```

### 3. Access Session in Server Components

```typescript
// app/dashboard/page.tsx
import { getServerSession } from "nevr/adapters/nextjs"
import { redirect } from "next/navigation"
import { api } from "@/lib/nevr"

export default async function Dashboard() {
  const session = await getServerSession(api)

  if (!session) {
    redirect("/login")
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {session.user.name}!</p>
    </div>
  )
}
```

### 4. Add Middleware for Route Protection

```typescript
// middleware.ts
import { withNevrMiddleware } from "nevr/adapters/nextjs"

export default withNevrMiddleware({
  protectedRoutes: ["/dashboard/*", "/settings/*"],
  publicRoutes: ["/", "/login", "/register", "/api/auth/*"],
  loginPath: "/login",
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

## API Reference

### `toNextHandler(api, options?)`

Creates Next.js App Router route handlers.

```typescript
import { toNextHandler } from "nevr/adapters/nextjs"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api, {
  // Get authenticated user from request
  getUser: sessionAuth(api),

  // Enable debug logging
  debugLogs: true,

  // Base path to strip (default: "/api")
  basePath: "/api",
})
```

### `nextCookies(options?)`

Plugin for handling cookies in Server Components.

```typescript
import { nextCookies } from "nevr/adapters/nextjs"

const api = nevr({
  // ...
  plugins: [
    auth({ ... }),
    nextCookies({ debug: false }), // Add as last plugin
  ],
})
```

### `getServerSession(api, options?)`

Get session in Server Components.

```typescript
import { getServerSession } from "nevr/adapters/nextjs"

const session = await getServerSession(api, {
  cookieName: "nevr.session_token", // default
})

// session = { user, expiresAt, token } or null
```

### `requireSession(api, options?)`

Require authentication, redirects if not logged in.

```typescript
import { requireSession } from "nevr/adapters/nextjs"

// Throws redirect if not authenticated
const session = await requireSession(api, {
  redirectTo: "/login", // default
})
```

### `sessionAuth(api, options?)`

Create `getUser` function for route handlers.

```typescript
import { sessionAuth } from "nevr/adapters/nextjs"

toNextHandler(api, {
  getUser: sessionAuth(api, {
    cookieName: "nevr.session_token",
  }),
})
```

### `withNevrMiddleware(options)`

Create Next.js middleware for route protection.

```typescript
import { withNevrMiddleware, createMatcher } from "nevr/adapters/nextjs"

export default withNevrMiddleware({
  // Routes requiring authentication
  protectedRoutes: ["/dashboard/*"],

  // Always accessible routes
  publicRoutes: ["/", "/login"],

  // Redirect destination
  loginPath: "/login",

  // Session cookie name
  cookieName: "nevr.session_token",
})

// Helper for matcher config
export const config = createMatcher({
  exclude: ["api/public"],
})
```

## Pages Router (Legacy)

For Next.js Pages Router (legacy):

```typescript
// pages/api/[...nevr].ts
import { toApiHandler, pagesSessionAuth } from "nevr/adapters/nextjs"
import { api } from "@/lib/nevr"

export default toApiHandler(api, {
  cors: true,
  getUser: pagesSessionAuth(api),
})
```

## Project Structure

```
my-nextjs-app/
├── app/
│   ├── api/
│   │   └── [...nevr]/
│   │       └── route.ts      # Nevr API handler
│   ├── dashboard/
│   │   └── page.tsx          # Protected page
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── nevr.ts               # Nevr instance
│   ├── nevr.config.ts        # Nevr config
│   └── entities/
│       ├── user.ts
│       └── post.ts
├── middleware.ts             # Route protection
└── package.json
```

## Edge Runtime

The Next.js adapter uses the Web Fetch API, making it compatible with Edge Runtime:

```typescript
// app/api/[...nevr]/route.ts
export const runtime = "edge"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api)
```

## Tips

1. **Always add `nextCookies()` plugin** when using auth with Server Components
2. **Use `sessionAuth()` for API routes** to automatically validate sessions
3. **Use `getServerSession()` in Server Components** for server-side auth checks
4. **Use `withNevrMiddleware()` for route protection** - faster than checking in every page
5. **Define `nevr.config.ts`** for CLI commands like `npx nevr generate`
