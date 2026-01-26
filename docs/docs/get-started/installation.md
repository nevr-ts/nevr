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

### 2. Create Configuration

Create `nevr.config.ts` in your project root:

```typescript
import { defineConfig } from "nevr"
import { user } from "./src/entities/user"

export default defineConfig({
  database: "sqlite",  // or "postgresql", "mysql"
  entities: [user],
  plugins: [],
})
```

::: tip Why is config required?
The `nevr.config.ts` file is **required** for the CLI to work. It tells the generator which entities and plugins to include in your Prisma schema.
:::

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
