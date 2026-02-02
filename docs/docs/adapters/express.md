# Express Adapter

Use Nevr with Express.js.

## Scaffolding (Recommended)

```bash
npm create nevr@latest my-app --template express
```

This creates a complete Express.js project with Nevr pre-configured.

## Manual Installation

```bash
npm install nevr express
npm install -D @types/express
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
import express from "express"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter } from "nevr/adapters/express"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = express()
app.use(express.json())
app.use("/api", expressAdapter(api))

app.listen(3000)
```

::: tip Single source of truth
`nevr({ ...config, driver })` spreads your entities and plugins from the config and adds the runtime driver. No duplication between config and server.
:::

## Authentication (`getUser`)

Every request that hits your API can carry an authenticated user. The `getUser` callback resolves that user from the HTTP request — typically by validating a session token against the database.

Nevr provides `sessionAuth()` for this. It reads the session cookie (or `Authorization: Bearer` header), looks up the session in the database, checks expiry, and returns the user.

```typescript
import express from "express"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter, sessionAuth } from "nevr/adapters/express"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = express()
app.use(express.json())
app.use("/api", expressAdapter(api, {
  getUser: sessionAuth(driver),
}))
```

The flow:

1. User signs in → auth plugin creates a session in the database and sets a `nevr.session_token` cookie
2. User makes a request → `sessionAuth(driver)` reads the cookie, finds the session, returns the `User`
3. Nevr checks entity rules (e.g., `"authenticated"`, `"owner"`) against that user

::: tip Without the auth plugin
You can provide any `getUser` function — it just needs to return `User | null`:

```typescript
expressAdapter(api, {
  getUser: async (req) => {
    const token = req.headers.authorization?.replace("Bearer ", "")
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
expressAdapter(api, {
  debugLogs: true,
  cors: true,
  getUser: sessionAuth(driver),
})
```

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `getUser` | `(req) => User \| null` | - | Resolves authenticated user from request |
| `cors` | `boolean \| string \| string[]` | `false` | Enable CORS |
| `debugLogs` | `boolean` | `false` | Log requests to console |
| `trustProxy` | `boolean` | `false` | Trust `X-Forwarded-For` for IP |

## Middleware Integration

Use Express middleware before Nevr:

```typescript
import cors from "cors"
import helmet from "helmet"

app.use(cors())
app.use(helmet())
app.use(express.json())
app.use("/api", expressAdapter(api))
```

## Webhook Support (Payment Plugin)

If you're using the payment plugin with Stripe webhooks, use `nevrJson(express)` instead of `express.json()`. This preserves the raw request body needed for webhook signature verification:

```typescript
import express from "express"
import { expressAdapter, sessionAuth, nevrJson } from "nevr/adapters/express"

const app = express()

// Use nevrJson(express) instead of express.json()
app.use(nevrJson(express))

app.use("/api", expressAdapter(api, {
  getUser: sessionAuth(driver),
}))
```

::: tip
`nevrJson(express)` is a drop-in replacement for `express.json()` that stores `req.rawBody` for webhook signature verification. It accepts the same options as `express.json()`.
:::

## Custom Routes Alongside Nevr

```typescript
// Nevr handles /api/*
app.use("/api", expressAdapter(api))

// Your custom routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

app.post("/webhook", (req, res) => {
  // Handle webhooks
})
```

## Example Server

```typescript
import express from "express"
import cors from "cors"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter } from "nevr/adapters/express"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const api = nevr({ ...config, driver: prisma(db) })

const app = express()

app.use(cors())
app.use(express.json())

// Health check
app.get("/health", (_, res) => res.json({ ok: true }))

// Nevr API
app.use("/api", expressAdapter(api))

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: "Server error" })
})

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000")
})
```

## Next Steps

- [Hono Adapter](/adapters/hono)
- [Custom Adapters](/adapters/custom)
