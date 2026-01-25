# HTTP Adapters

Adapters connect Nevr to HTTP frameworks.

## What Are Adapters?

Adapters convert HTTP framework requests to Nevr's internal format and vice versa.

```
Express Request → Adapter → NevrRequest → Core → NevrResponse → Adapter → Express Response
```

## Available Adapters

| Adapter | Framework | Best For |
|---------|-----------|----------|
| `toNextHandler` | Next.js | Full-stack React apps |
| `expressAdapter` | Express.js | REST APIs, traditional Node.js |
| `honoAdapter` | Hono | Edge, Cloudflare Workers |

## Usage

### Next.js (Recommended)

```typescript
// app/api/[...nevr]/route.ts
import { toNextHandler } from "nevr/adapters/nextjs"
import { api } from "@/lib/nevr"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api)
```

### Express

```typescript
import express from "express"
import { expressAdapter } from "nevr/adapters/express"
import { api } from "./config"

const app = express()
app.use(express.json())
app.use("/api", expressAdapter(api))
```

### Hono

```typescript
import { Hono } from "hono"
import { honoAdapter } from "nevr/adapters/hono"
import { api } from "./config"

const app = new Hono()
app.route("/api", honoAdapter(api))
```

## Adapter Options

```typescript
expressAdapter(api, {
  // Base path prefix
  basePath: "/api",

  // CORS configuration
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
})
```

## Next Steps

- [Next.js Adapter](/adapters/nextjs) (Recommended)
- [Express Adapter](/adapters/express)
- [Hono Adapter](/adapters/hono)
- [Custom Adapters](/adapters/custom)
