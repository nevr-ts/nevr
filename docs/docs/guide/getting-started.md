# Getting Started

## Quick Start (Recommended)

Scaffold a new project with the CLI:

```bash
npm create nevr@latest my-api
cd my-api
```

Then:

```bash
npm run dev        # Start server on http://localhost:3000
```


## Manual Setup

Install packages in an existing project:

```bash
npm install nevr @prisma/client
npm install -D prisma tsx
```

### 1. Define Entities

```typescript
// src/entities/user.ts
import { entity, string, boolean } from "nevr"

export const user = entity("user", {
  email: string.unique(),
  name: string,
  verified: boolean.default(false),
})
```

```typescript
// src/entities/post.ts
import { entity, string, text, boolean, belongsTo } from "nevr"
import { user } from "./user"

export const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  published: boolean.default(false),
  author: belongsTo(() => user),
})
  .ownedBy("author")
  .rules({
    create: ["authenticated"],
    update: ["owner"],
    delete: ["owner"],
  })
```

### 2. Create Configuration (Required)

Create `src/nevr.config.ts` with `defineConfig`:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { user } from "./entities/user"
import { post } from "./entities/post"

export const config = defineConfig({
  database: "postgresql",  // or "sqlite", "mysql"
  entities: [user, post],
  plugins: [],
})

export default config
```

The CLI automatically discovers this config file:

```bash
npx nevr generate    # Generates Prisma schema from config
npx nevr db:push     # Push schema to database
```

### 3. Create Server

Your config is the single source of truth — spread it into `nevr()` and add the runtime driver:

::: code-group

```typescript [Express]
// src/server.ts
import express from "express"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter } from "nevr/adapters/express"
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

```typescript [Hono]
// src/server.ts
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { honoAdapter } from "nevr/adapters/hono"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = new Hono()
app.route("/api", honoAdapter(api))

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log("Server running on http://localhost:3000")
})
```

:::

### 5. Generate Database Schema

```bash
# Generate Prisma schema (auto-loads nevr.config.ts)
npx nevr generate

# Push to database
npx nevr db:push
```

Or add to your `package.json` scripts:

```json
{
  "scripts": {
    "generate": "nevr generate",
    "db:push": "nevr db:push",
    "db:migrate": "nevr db:migrate"
  }
}
```

## Adding Custom Actions

Beyond CRUD, add custom operations:

```typescript
import { entity, string, action } from "nevr"

const user = entity("user", {
  email: string.unique(),
  verified: boolean.default(false),
}).actions({
  // POST /users/:id/verify
  verify: action()
    .onResource()
    .rules("authenticated")
    .handler(async (ctx) => {
      await ctx.driver.update("user",
        { id: ctx.resourceId },
        { verified: true }
      )
      return { success: true }
    }),

  // POST /users/invite
  invite: action()
    .input({ email: string })
    .handler(async (ctx) => {
      const mailer = ctx.resolve("mailer")
      await mailer.sendInvite(ctx.input.email)
      return { sent: true }
    }),
})
```

## Adding Services

Register services for dependency injection:

```typescript
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"
import Stripe from "stripe"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })

// Register services
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY!))
api.registerService("mailer", () => new Mailer({
  host: process.env.SMTP_HOST!,
}))

// Use in actions
checkout: action().handler(async (ctx) => {
  const stripe = ctx.resolve("stripe")
  const charge = await stripe.charges.create({ ... })
  return { chargeId: charge.id }
})
```

## Adding Workflows

For complex multi-step operations with rollback:

```typescript
import { entity, action, step, float, string } from "nevr"

const order = entity("order", {
  total: float,
  status: string.default("pending"),
}).actions({
  checkout: action()
    .input({ paymentMethodId: string })
    .workflow([
      // Step 1: Reserve inventory
      step("reserve",
        async (ctx) => {
          const inventory = ctx.resolve("inventory")
          return await inventory.reserve(ctx.resourceId)
        },
        async (ctx, reservation) => {
          const inventory = ctx.resolve("inventory")
          await inventory.release(reservation.id)
        }
      ),

      // Step 2: Charge payment
      step("charge",
        async (ctx) => {
          const stripe = ctx.resolve("stripe")
          return await stripe.charges.create({
            amount: ctx.resource.total * 100,
            payment_method: ctx.input.paymentMethodId,
          })
        },
        async (ctx, charge) => {
          const stripe = ctx.resolve("stripe")
          await stripe.refunds.create({ charge: charge.id })
        }
      ),

      // Step 3: Finalize (no compensation needed)
      step("finalize",
        async (ctx) => {
          await ctx.driver.update("order",
            { id: ctx.resourceId },
            { status: "completed" }
          )
          return { success: true }
        }
      ),
    ], { useTransaction: true })
})
```

If any step fails, all previous steps are compensated in reverse order.

## Adding Plugins

**Nevr has a plugin system to extend functionality**.
It allows adding features like authentication, payments, storage, and more out of the box.

Add plugins to your `nevr.config.ts`:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { user } from "./entities/user"
import { post } from "./entities/post"

export const config = defineConfig({
  database: "sqlite",
  entities: [user, post],
  plugins: [
    auth({
      secret: process.env.AUTH_SECRET!,
      emailAndPassword: { enabled: true },
      session: { expiresIn: 60 * 60 * 24 * 7 },
    }),
  ],
})

export default config
```

Your server stays clean — `nevr({ ...config, driver })` picks up the plugins automatically.

This adds:
- `/auth/sign-up` - User registration
- `/auth/sign-in` - User login
- `/auth/sign-out` - User logout
- `/auth/me` - Current user
- Session management
- Email verification
- and more...


## Development Workflow

```bash
# Start development server with hot reload
npm run dev

# Regenerate after entity changes
npm run generate

# Push schema changes to database
npm run db:push

# Create a migration
npm run db:migrate

# Run tests
npm test
```

## Next Steps

Now that you have a basic setup, explore:

- [Entities](/guide/entities) - Complete field types and relations
- [Actions](/guide/actions) - Custom operations on entities
- [Workflows](/guide/workflows) - Multi-step operations with rollback
- [Services](/guide/services) - Dependency injection
- [Authorization](/entities/authorization) - Access control rules
- [Plugins](/guide/plugins) - Auth, payments, storage
- [Remote Joiner](/guide/remote-joiner) - External service integration
