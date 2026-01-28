# Hono Integration

Hono is a fast, lightweight web framework built on Web Standards. It works on Cloudflare Workers, Fastly Compute, Deno, Bun, and Node.js.

## Installation

```bash
npm install hono
```

## Basic Usage

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { user } from "./entities/user"
import { post } from "./entities/post"

export const config = defineConfig({
  database: "sqlite",
  entities: [user, post],
  plugins: [],
})
```

```typescript
// src/server.ts
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { nevr } from "nevr"
import { honoAdapter } from "nevr/adapters/hono"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = new Hono()
app.route("/api", honoAdapter(api))

serve({ fetch: app.fetch, port: 3000 })
```

## With Authentication

Add the auth plugin to your config:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { post } from "./entities/post"

export const config = defineConfig({
  database: "sqlite",
  entities: [post],
  plugins: [
    auth({
      secret: process.env.AUTH_SECRET!,
      emailAndPassword: { enabled: true },
    }),
  ],
})
```

Your server stays the same — `nevr({ ...config, driver })` picks up the plugin automatically.

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
