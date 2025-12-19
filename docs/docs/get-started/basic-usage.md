# Basic Usage

Once installed, here is the typical workflow.

## 1. Define Entities

Describe your data model using the Nevr DSL.

```typescript
// src/entities/post.ts
import { entity, string, text, bool } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(100),
  content: text,
  published: bool.default(false),
})
```

## 2. Generate Artifacts

Run the generator to create the Prisma schema and TypeScript types.

```bash
npm run generate
npm run db:push
```

## 3. Create the Server

We recommend separating your configuration from your server entry point.

**`src/config.ts`** — The Nevr configuration
```typescript
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { post } from "./entities/post"

const db = new PrismaClient()

export const api = nevr({
  entities: [post],
  driver: prisma(db),
})
```

**`src/server.ts`** — The HTTP Server
```typescript
import express from "express"
import { expressAdapter } from "nevr/adapters/express"
import { api } from "./config"

const app = express()

app.use(express.json())
app.use("/api", expressAdapter(api))

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000")
})
```

## 4. Consume the API

You can now make requests to your API.

```bash
# Create a post
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello Nevr", "content": "This is amazing!"}'

# List posts
curl http://localhost:3000/api/posts
```
