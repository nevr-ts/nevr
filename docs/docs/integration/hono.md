# Hono Integration

Hono is a fast, lightweight web framework built on Web Standards. It works on Cloudflare Workers, Fastly Compute, Deno, Bun, and Node.js.

## Installation

```bash
npm install hono
```

## Basic Usage

```typescript
import { Hono } from "hono"
import { nevr } from "nevr"
import { honoAdapter } from "nevr/adapters/hono"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { user, post } from "./entities"

const db = new PrismaClient()
const app = new Hono()

// 1. Initialize Nevr
const api = nevr({
  entities: [user, post],
  driver: prisma(db)
})

// 2. Mount Nevr (Hono handles body parsing automatically)
app.route("/api", honoAdapter(api))

// 3. Export for your runtime
export default app
```

## With Authentication

```typescript
import { Hono } from "hono"
import { nevr } from "nevr"
import { honoAdapter } from "nevr/adapters/hono"
import { prisma } from "nevr/drivers/prisma"
import { auth } from "nevr/plugins/auth"
import { PrismaClient } from "@prisma/client"
import { post } from "./entities"

const db = new PrismaClient()
const app = new Hono()

const api = nevr({
  entities: [post],
  driver: prisma(db),
  plugins: [
    auth({
      mode: "session",
      emailAndPassword: true,
    })
  ]
})

app.route("/api", honoAdapter(api))

export default app
```

## Adapter Options

```typescript
honoAdapter(api, {
  // Custom user extraction
  getUser: async (c) => {
    return { id: "123", role: "admin" }
  },

  // Debug logging
  debugLogs: true,
})
```

## Edge Compatibility

When using Hono with Nevr on edge runtimes (like Cloudflare Workers), ensure your **Driver** is edge-compatible. Standard Prisma Client requires:
- Prisma Data Proxy, or
- An edge-compatible adapter (like `@prisma/adapter-pg`)
