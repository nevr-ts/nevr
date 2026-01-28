# Installation

> 🚀 **Get up and running in seconds.**
## Automatic Setup (Recommended)

Run the interactive CLI scaffolder:

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

Then:

```bash
cd my-api
npm install
npm run generate    # Generate Prisma schema
npm run db:push     # Push to database
npm run dev         # Start server
```

Your API is now live at `http://localhost:3000/api`! 🎉

### What you get:
- ✅ **nevr.config.ts** - Configuration with `defineConfig`
- ✅ **TypeScript** - Strict mode enabled
- ✅ **Prisma** - SQLite/PostgreSQL/MySQL
- ✅ **NextJs/Express/Hono** - Your choice of framework

---

## Manual Setup

Adding Nevr to an existing project:

### 1. Install Dependencies

```bash
npm install nevr @prisma/client
npm install -D prisma typescript tsx @types/node
```

### 2. Create your first Entity

Create `src/entities/user.ts`:

```typescript
import { entity, string } from "nevr"

export const user = entity("user", {
  name: string,
  email: string.unique(),
})
```

Export it from `src/entities/index.ts`:

```typescript
export { user } from "./user.js"
```

::: tip Recommended folder structure
Keep entities in a dedicated folder — one file per entity, with a barrel `index.ts` that re-exports them all:

**Express / Hono:**
```
src/
├── entities/
│   ├── user.ts
│   ├── post.ts
│   └── index.ts        # re-exports all entities
├── nevr.config.ts       # defineConfig — imports from entities/
└── server.ts            # nevr({ ...config, driver })
```

**Next.js:**
```
lib/
├── entities/
│   ├── user.ts
│   ├── post.ts
│   └── index.ts        # re-exports all entities
├── nevr.config.ts       # defineConfig — imports from entities/
└── nevr.ts              # nevr({ ...config, driver })
app/
└── api/
    └── [...nevr]/
        └── route.ts     # nextjsAdapter(api)
```
:::

### 3. Create Configuration

Create `src/nevr.config.ts`:

```typescript
import { defineConfig } from "nevr"
import * as entities from "./entities/index.js"

export const config = defineConfig({
  database: "sqlite",  // or "postgresql", "mysql"
  entities: Object.values(entities).filter(e => e && typeof e === "object"),
  plugins: [],
})

export default config
```

::: tip Config is the single source of truth
Define your entities and plugins **once** in `nevr.config.ts`. The CLI uses it for schema generation, and your server imports it at runtime — no duplication.
:::

### 4. Create the Server

::: code-group

```typescript [Express — src/server.ts]
import express from "express"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter } from "nevr/adapters/express"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const api = nevr({ ...config, driver: prisma(db) })

const app = express()
app.use(express.json())
app.use("/api", expressAdapter(api))

app.listen(3000, () => console.log("Server running on http://localhost:3000"))
```

```typescript [Hono — src/server.ts]
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { honoAdapter } from "nevr/adapters/hono"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const api = nevr({ ...config, driver: prisma(db) })

const app = new Hono()
app.route("/api", honoAdapter(api))

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log("Server running on http://localhost:3000")
})
```

```typescript [Next.js — lib/nevr.ts]
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
export const api = nevr({ ...config, driver: prisma(db) })
```

```typescript [Next.js — app/api/[...nevr]/route.ts]
import { toNextHandler } from "nevr/adapters/nextjs"
import { api } from "@/lib/nevr"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api)
```

:::

### 5. Generate and Run

```bash
# Generate Prisma schema from config
npx nevr generate

# Push schema to database
npx nevr db:push

# Start server
npx tsx src/server.ts
```

---

## Configuration Reference

### defineConfig

```typescript
import { defineConfig } from "nevr"

export default defineConfig({
  // Database provider (required for schema generation)
  database: "postgresql",  // "sqlite" | "postgresql" | "mysql"

  // Output directory for Prisma schema
  outDir: "./prisma",      // default: "./prisma"

  // Your entities
  entities: [user, post, comment],

  // Plugins (auth, payments, etc.)
  plugins: [
    // auth({ ... }),
  ],

  // Enable incremental generation (caching)
  incremental: true,       // default: true
})
```

### Config file locations

The CLI auto-discovers config in this order:
1. `nevr.config.ts`
2. `nevr.config.js`
3. `src/nevr.config.ts`
4. `src/nevr.config.js`
5. `lib/nevr.config.ts`,
6. `lib/nevr.config.js`,
7. `lib/nevr.config.mjs`,

Or specify custom path: `npx nevr generate --config ./custom/config.ts`

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `npx nevr generate` | Generate Prisma schema from entities |
| `npx nevr db:push` | Push schema to database |
| `npx nevr db:migrate` | Create a migration |
| `npx nevr db:studio` | Open Prisma Studio |
| `npx nevr db:reset` | Reset database |
| `npx nevr introspect` | Show all entities |

---

## Next Steps

- [Basic Usage](/get-started/basic-usage) - Learn the workflow
- [Entities](/entities/defining) - Define your data model
- [Actions](/actions/overview) - Add custom logic
- [Generator Reference](/reference/generator) - Advanced generation options
