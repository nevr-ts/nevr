# Hono Adapter

Use Nevr with Hono.

## Installation

```bash
npm install hono @hono/node-server
```

## Setup

```typescript
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { honoAdapter} from "nevr/adapters/hono"
import { api } from "./config"

const app = new Hono()

app.route("/api", honoAdapter(api))

serve({ fetch: app.fetch, port: 3000 })
```

## Options

```typescript
honoAdapter(api, {
  // Custom error handler
  onError: (error, c) => {
    console.error(error)
    return c.json({ error: "Internal error" }, 500)
  },
})
```

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
import { honoAdapter} from "nevr/adapters/hono"
import { api } from "./config"

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

- [Express Adapter](/adapters/express)
- [Custom Adapters](/adapters/custom)
