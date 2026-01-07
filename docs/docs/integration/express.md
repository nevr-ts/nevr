# Express Integration

Express is the most popular web framework for Node.js. Nevr provides a first-class adapter for Express.

## Installation

```bash
npm install express
npm install -D @types/express
```

## Basic Usage

```typescript
import express from "express"
import { nevr } from "nevr"
import { expressAdapter } from "nevr/adapters/express"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { user, post } from "./entities"

const db = new PrismaClient()
const app = express()

// 1. Initialize Nevr
const api = nevr({
  entities: [user, post],
  driver: prisma(db)
})

// 2. Add Body Parser (Required)
app.use(express.json())

// 3. Mount Nevr
app.use("/api", expressAdapter(api))

// 4. Start Server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000")
})
```

## With Authentication

```typescript
import express from "express"
import { nevr } from "nevr"
import { expressAdapter } from "nevr/adapters/express"
import { prisma } from "nevr/drivers/prisma"
import { auth } from "nevr/plugins/auth"
import { PrismaClient } from "@prisma/client"
import { post } from "./entities"

const db = new PrismaClient()
const app = express()

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

app.use(express.json())
app.use("/api", expressAdapter(api))

app.listen(3000)
```

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
