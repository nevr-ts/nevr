# Express Adapter

Use Nevr with Express.js.

## Installation

```bash
npm install express
npm install -D @types/express
```

## Setup

```typescript
import express from "express"
import { expressAdapter } from "nevr/adapters/express"
import { api } from "./config"

const app = express()

// Required: JSON body parsing
app.use(express.json())

// Mount Nevr
app.use("/api", expressAdapter(api))

app.listen(3000)
```

## Options

```typescript
expressAdapter(api, {
   debugLogs: true,
  cors: true,
  getUser: sessionAuth(driver),
})
```

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
import { expressAdapter } from "nevr/adapters/express"
import { api } from "./config"

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
