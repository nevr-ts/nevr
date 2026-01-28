# Hono Adapter

Use Nevr with Hono.

## Scaffolding (Recommended)

```bash
npm create nevr@latest my-app --template hono
```

This creates a complete Hono project with Nevr pre-configured.

## Manual Installation

```bash
npm install nevr hono @hono/node-server
npm install -D typescript @types/node
```

## Setup

### 1. Config (`src/nevr.config.ts`)

```typescript
import { defineConfig } from "nevr"
import * as entities from "./entities/index.js"

export const config = defineConfig({
  database: "sqlite",
  entities: Object.values(entities).filter(e => e && typeof e === "object"),
  plugins: [],
})

export default config
```

### 2. Server (`src/server.ts`)

```typescript
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { honoAdapter } from "nevr/adapters/hono"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = new Hono()
app.route("/api", honoAdapter(api))

serve({ fetch: app.fetch, port: 3000 })
```

::: tip Single source of truth
`nevr({ ...config, driver })` spreads your entities and plugins from the config and adds the runtime driver. No duplication between config and server.
:::

## Authentication (`getUser`)

Every request that hits your API can carry an authenticated user. The `getUser` callback resolves that user from the Hono context — typically by validating a session token against the database.

Nevr provides `sessionAuth()` for this. It reads the session cookie (or `Authorization: Bearer` header), looks up the session in the database, checks expiry, and returns the user.

```typescript
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { honoAdapter, sessionAuth } from "nevr/adapters/hono"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = new Hono()
app.route("/api", honoAdapter(api, {
  getUser: sessionAuth(driver),
}))

serve({ fetch: app.fetch, port: 3000 })
```

The flow:

1. User signs in → auth plugin creates a session in the database and sets a `nevr.session_token` cookie
2. User makes a request → `sessionAuth(driver)` reads the cookie, finds the session, returns the `User`
3. Nevr checks entity rules (e.g., `"authenticated"`, `"owner"`) against that user

::: tip Without the auth plugin
You can provide any `getUser` function — it just needs to return `User | null`:

```typescript
honoAdapter(api, {
  getUser: async (c) => {
    const token = c.req.header("authorization")?.replace("Bearer ", "")
    if (!token) return null
    // Your own verification logic
    return { id: "user-id", role: "admin" }
  },
})
```
:::

### `sessionAuth(driver, options?)`

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `cookieName` | `string` | `"nevr.session_token"` | Cookie name to read |

## Options

```typescript
honoAdapter(api, {
  getUser: sessionAuth(driver),
  debugLogs: true,
  cors: true,
})
```

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `getUser` | `(c) => User \| null` | - | Resolves authenticated user from Hono context |
| `cors` | `boolean \| string \| string[]` | `false` | Enable CORS |
| `debugLogs` | `boolean` | `false` | Log requests to console |
| `trustProxy` | `boolean` | `false` | Trust `X-Forwarded-For` for IP |

## Middleware Integration

```typescript
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

const app = new Hono()

app.use("*", cors())
app.use("*", logger())
app.route("/api", honoAdapter(api))
```

## Custom Routes

```typescript
const app = new Hono()

// Health check
app.get("/health", (c) => c.json({ ok: true }))

// Nevr API
app.route("/api", honoAdapter(api))

// Webhooks
app.post("/webhook", async (c) => {
  const body = await c.req.json()
  return c.json({ received: true })
})
```

## Edge Runtime

Hono works on edge runtimes:

```typescript
// Cloudflare Workers
export default {
  fetch: app.fetch,
}

// Vercel Edge
export const config = { runtime: "edge" }
export default app
```

## Example Server

```typescript
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { honoAdapter } from "nevr/adapters/hono"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const api = nevr({ ...config, driver: prisma(db) })

const app = new Hono()

app.use("*", cors())
app.use("*", logger())

app.get("/health", (c) => c.json({ ok: true }))
app.route("/api", honoAdapter(api))

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log("Server running on http://localhost:3000")
})
```

## Next Steps

- [NextJs Adapter](/adapters/nextjs)
- [Custom Adapters](/adapters/custom)
