# Express Integration

Express is the most popular web framework for Node.js. Nevr provides a first-class adapter for Express.

## Installation

```bash
npm install express
npm install -D @types/express
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
import express from "express"
import { nevr } from "nevr"
import { expressAdapter } from "nevr/adapters/express"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = express()
app.use(express.json())
app.use("/api", expressAdapter(api))

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000")
})
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

Now you have authentication endpoints at:
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`

## Adapter Options

```typescript
expressAdapter(api, {
  // Custom user extraction (for custom auth)
  getUser: async (req) => {
    return { id: "123", role: "admin" }
  },

  // Enable CORS
  cors: true,  // or specific origins: ["http://localhost:3000"]

  // Debug logging
  debugLogs: true,
})
```

## Middleware

Use standard Express middleware before Nevr:

```typescript
import cors from "cors"
import morgan from "morgan"

app.use(cors())
app.use(morgan("dev"))
app.use("/api", expressAdapter(api))
```
