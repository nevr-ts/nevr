# Installation

> 🚀 **Get up and running in seconds.**

The fastest way to start with Nevr is using the interactive CLI scaffolder.

---

## Automatic Setup (Recommended)

Run the following command in your terminal:

::: code-group

```bash [npm]
npm create nevr@latest my-api
```

```bash [pnpm]
pnpm create nevr my-api
```

```bash [bun]
bun create nevr my-api
```

:::

### What you get:
- ✅ **TypeScript** configuration (strict mode)
- ✅ **Prisma** Setup (SQLite/Postgres/MySQL)
- ✅ **Express/Hono** Server
- ✅ **Example Entity** (User)

After scaffolding, start the server:

```bash
cd my-api
npm install
npm run db:push
npm run dev
```

Your API is now live at `http://localhost:3000`! 🎉

---

## Manual Setup

Prefer to add Nevr to an existing project?

### 1. Install Dependencies

```bash
npm install nevr @prisma/client
npm install -D prisma typescript tsx @types/node
```

### 2. Initialize Prisma

```bash
npx prisma init --datasource-provider sqlite
```

### 3. Create your first Entity

Create `src/entities/user.ts`:

```typescript
import { entity, string } from "nevr"

export const user = entity("user", {
  name: string,
  email: string.unique(),
})
```

### 4. Create the Server

Create `src/server.ts`:

```typescript
import express from "express"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter } from "nevr/adapters/express"
import { PrismaClient } from "@prisma/client"
import { user } from "./entities/user"

const app = express()
const db = new PrismaClient()

const api = nevr({
  entities: [user],
  driver: prisma(db),
})

app.use(express.json())
app.use("/api", expressAdapter(api))

app.listen(3000, () => console.log("Server running! 🚀"))
```

### 5. Run it

```bash
# Generate schema & Push DB
npx nevr generate && npx prisma db push

# Start server
npx tsx src/server.ts
```

---

## Next Steps

- [Basic Usage](/get-started/basic-usage) - Learn the workflow
- [Entities](/guide/entities) - Define your data model
- [Actions](/guide/actions) - Add custom logic
