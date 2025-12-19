# Hono Integration

Hono is a fast, lightweight web framework built on Web Standards. It works on Cloudflare Workers, Fastly Compute, Deno, Bun, and Node.js.

## Installation

```bash
npm install hono
```

## Usage

The `honoAdapter` allows you to mount Nevr into a Hono application.

```typescript
import { Hono } from "hono"
import { nevr } from "nevr"
import { honoAdapter } from "nevr/adapters/hono"
// ... imports for entities and driver

const app = new Hono()

// 1. Initialize Nevr
const api = nevr({
  entities: [/* ... */],
  driver: /* ... */
})

// 2. Mount Nevr
// Note: Hono handles body parsing automatically
app.route("/api", honoAdapter(api))

// 3. Export for your runtime (e.g., Cloudflare Workers)
export default app
```

## Edge Compatibility

When using Hono with Nevr on edge runtimes (like Cloudflare Workers), ensure that your **Driver** is also edge-compatible. Standard Prisma Client requires the Prisma Data Proxy or an edge-compatible driver (like `pg` with `prisma-adapter-pg-worker`).
