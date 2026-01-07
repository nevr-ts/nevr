# HTTP Adapters

Adapters connect Nevr to HTTP frameworks.

## What Are Adapters?

Adapters convert HTTP framework requests to Nevr's internal format and vice versa.

```
Express Request → Adapter → NevrRequest → Core → NevrResponse → Adapter → Express Response
```

## Available Adapters

| Adapter | Framework |
|---------|-----------|
| `expressAdapter` | Express.js |
| `honoAdapter` | Hono |

## Usage

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
import { honoAdapter} from "nevr/adapters/hono"
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

- [Express Adapter](/adapters/express)
- [Hono Adapter](/adapters/hono)
- [Custom Adapters](/adapters/custom)
