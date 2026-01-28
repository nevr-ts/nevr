# Nevr

> **The Entity-First TypeScript Framework.**
> Define your data model once. Get a type-safe API, database schema, auth, and client — automatically.

<p align="center">
  <a href="https://www.npmjs.com/package/nevr"><img src="https://img.shields.io/npm/v/nevr.svg?style=flat-square&color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/nevr"><img src="https://img.shields.io/npm/dm/nevr.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/nevr-ts/nevr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license"></a>
  <a href="https://github.com/nevr-ts/nevr"><img src="https://img.shields.io/badge/status-beta-orange.svg?style=flat-square" alt="status"></a>
</p>

<p align="center">
  Define your entities. Get a full REST API with authentication, validation, and type-safe clients — automatically.
</p>

## 🎯 What is Nevr?

**Nevr** is the **Entity-First TypeScript Framework** that eliminates boilerplate by turning your domain models into production-ready APIs.

Your **Entity** is the single source of truth — Nevr derives your database schema, REST API, validation, authorization, and typed client from it automatically.

## 🛠️ How it Works

Nevr extends standard backend development with four powerful layers:

1. **The Driver Layer** (Database Agnostic)
   Connects to any database or ORM (Prisma supported now; Drizzle, Kysely coming soon).

2. **The Intelligence Layer** (Plugins)
   Automatically injects complex capabilities like Authentication (OAuth/JWT), Payments,Timestamps,Vector Search (RAG), AI-gateway, and File Storage without writing glue code.

3. **The Adapter Layer** (Framework Agnostic)
   Mounts your API onto any framework (Next.js, Express, Hono, Fastify, etc.) or deploy as a standalone server.

4. **The Consumption Layer** (Client)
   End-to-end type-safety Full TypeScript inference from database to client.

---

> Read full documentation at 👉🏻 https://nevr-ts.github.io/nevr/

## ✨ Features

- 🚀 **Entity-first design** — Define entities, get complete CRUD APIs automatically
- 🔒 **End-to-end type safety** — Full TypeScript inference from database to client
- 🔐 **Built-in authentication** — Email/password, OAuth, sessions, JWT
- 🔌 **Framework agnostic** — Works with NextJs, Express, Hono, and more
- 🗄️ **Database agnostic** — Prisma driver included, more coming soon
- 🧩 **Unified Plugin System** — Extend with auth, timestamps, payments, storage plugins
- ⚡ **Zero config** — Sensible defaults, full customization when needed
- 🔄 **Workflow Engine** — Multi-step transactions with compensation (saga pattern)
- 💉 **Service Container** — Functional dependency injection with lifecycle management
- 🧠 **RAG & AI Gateway** — Built-in vector search, embeddings, and multi-provider AI gateway
- ✅ **Cross-field Validation** — Complex business rules with declarative syntax

## 📦 Installation

```bash
npm install nevr
# or
pnpm add nevr
# or
yarn add nevr
```

## 🆕 Create a New Nevr Project

```bash
# Quick installation with project scaffolding
npm create nevr@latest my-nevr-app
```

## 🚀 Quick Start

```typescript
// src/entities/index.ts
import { entity, string, text, belongsTo } from "nevr"

export const user = entity("user", {
  email: string.unique(),
  name: string.min(1).max(100),
})

export const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  author: belongsTo(() => user),
})
  .ownedBy("author")
```

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { user, post } from "./entities/index.js"

export const config = defineConfig({
  database: "sqlite",
  entities: [user, post],
})

export default config
```

```typescript
// src/server.ts
import express from "express"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { expressAdapter } from "nevr/adapters/express"
import { config } from "./nevr.config.js"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })

const app = express()
app.use("/api", expressAdapter(api, { cors: true }))
app.listen(3000, () => console.log("API running at http://localhost:3000/api"))
```

That's it! You now have a full REST API with:
- `GET/POST /api/users` — List & create users
- `GET/PUT/DELETE /api/users/:id` — Read, update, delete user
- `GET/POST /api/posts` — List & create posts
- `GET/PUT/DELETE /api/posts/:id` — Read, update, delete post

---

## 📖 Entity-First DSL

### Field Types

```typescript
import { entity, string, text, int, float, bool, datetime, json, belongsTo, email } from "nevr"

const task = entity("task", {
  // String fields with validation
  title: string.min(1).max(200),           // VARCHAR with validation
  slug: string.unique(),                    // Unique constraint
  description: text.optional(),             // Long text, nullable

  // Number fields
  priority: int.default(0).min(0).max(5),   // Integer with range
  progress: float.default(0),               // Floating point

  // Boolean & DateTime
  completed: bool.default(false),
  dueDate: datetime.optional(),
  
  // JSON data
  metadata: json.optional(),

  // Relations
  project: belongsTo(() => project),        // Many-to-one relation
  assignee: belongsTo(() => user),
})
```

### Field Modifiers

| Modifier | Description | Example |
|----------|-------------|---------|
| `.optional()` | Make field nullable | `string.optional()` |
| `.unique()` | Add unique constraint | `string.unique()` |
| `.default(value)` | Set default value | `bool.default(false)` |
| `.min(n)` / `.max(n)` | Validation bounds | `string.min(1).max(100)` |
| `.trim()` | Trim whitespace | `string.trim()` |
| `.lower()` / `.upper()` | Case transformation | `string.lower()` |

### Security & Privacy (Entity-First)

Control field visibility and mutability with the Entity-First DSL:

```typescript
const user = entity("user", {
  email: string.email().unique(),
  
  // 🔐 Password: auto-hashed, never returned in responses
  password: string.password().omit(),
  
  // 🔒 Protected fields: can't be set by clients
  role: string.default("user").writable("none"),
  emailVerified: bool.default(false).writable("none"),
  
  // 📖 Read-only computed fields
  lastLoginAt: datetime.writable("none").optional(),
})
```

| Builder Method | Description |
|----------------|-------------|
| `.password()` | Hash on save, compare securely |
| `.omit()` | Never return in API responses |
| `.writable("none")` | Server-only, no client writes |
| `.writable("create")` | Set on create only |
| `.email()` | Email validation |

### Access Control

```typescript
const post = entity("post", { /* fields */ })
  .ownedBy("author")  // Track ownership via 'author' field
  .rules({
    create: ["authenticated"],              // Must be logged in
    read: ["everyone"],                     // Public access
    update: ["owner", "admin"],             // Owner or admin only
    delete: ["admin"],                      // Admin only
  })
```

**Built-in Rules:**
- `everyone` — No authentication required
- `authenticated` — Must be logged in
- `owner` — Must own the resource (via `ownedBy`)
- `admin` — Must have admin role

---

## 🔌 Adapters

### Next.js API Routes 

```typescript
// app/api/[...nevr]/route.ts
import { toNextHandler } from "nevr/adapters/nextjs"
import { api } from "@/lib/nevr"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api)
```

### Express

```typescript
import { expressAdapter, devAuth } from "nevr/adapters/express"
import express from "express"
const app = express()
app.use("/api", expressAdapter(api, { 
  getUser: devAuth,
  cors: true 
}))
```

### Hono

```typescript
import { Hono } from "hono"
import { honoAdapter } from "nevr/adapters/hono"

const app = new Hono()
app.route("/api", honoAdapter(api))

export default app
```

---

## 🗄️ Drivers

### Prisma

```typescript
// src/server.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
```

Generate your Prisma schema and push to database:

```bash
npx nevr generate
npx nevr db:push
```

---

## 🧩 Plugins

### Authentication

Full-featured auth with email/password, OAuth, sessions, and JWT:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"

export const config = defineConfig({
  database: "postgresql",
  entities: [post],
  plugins: [
    auth({
      emailAndPassword: { enabled: true },
      socialProviders: {
        google: { clientId: "...", clientSecret: "..." },
        github: { clientId: "...", clientSecret: "..." },
      },
    }),
  ],
})
```

**Generated routes:**
- `POST /api/auth/sign-up` — Create account
- `POST /api/auth/sign-in` — Sign in
- `POST /api/auth/sign-out` — Sign out
- `GET /api/auth/session` — Get current session
- `GET /api/auth/callback/:provider` — OAuth callback
### Organizations
Multi-tenant support with organizations and roles:

```typescript
// Add to your nevr.config.ts plugins array
import { organization } from "nevr/plugins/organization"

plugins: [
  organization({
    allowUserToCreate: true,
    creatorRole: "owner",
    teams: { enabled: true },
  }),
]
```
### Payments
Stripe integration for subscriptions and one-time payments:

```typescript
// Add to your nevr.config.ts plugins array
import { payment } from "nevr/plugins/payment"

plugins: [
  payment({
    provider: "stripe",
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    createCustomerOnSignUp: true,
    subscription: {
      enabled: true,
      plans: [
        { name: "free", priceId: "price_free" },
        { name: "pro", priceId: "price_pro", limits: { projects: 10 } },
        { name: "enterprise", priceId: "price_enterprise", limits: { projects: -1 } },
      ],
    },
  }),
]
```
### AI-Gateway 

AI Gateway provides a unified API for multiple AI providers (OpenAI, Anthropic, Google) with built-in usage tracking, rate limiting, and SSE streaming support.

```typescript
// Add to your nevr.config.ts plugins array
import { aiGateway } from "nevr/plugins"

plugins: [
  aiGateway({
    providers: {
      openai: { apiKey: process.env.OPENAI_API_KEY },
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
      google: { apiKey: process.env.GOOGLE_API_KEY },
    },
    defaultProvider: "openai",
    defaultModel: "gpt-5-mini",
    trackUsage: true,
    rateLimiting: { enabled: true },
  }),
]
```

---

## 🔄 Workflow Engine

Execute multi-step operations with automatic rollback (saga pattern):

```typescript
import { createWorkflow, step, createEntityStep, deleteEntityStep } from "nevr"

const signUpWorkflow = createWorkflow({
  name: "user-signup",
  useTransaction: true,
  execute: async (ctx, input) => {
    // Step 1: Create user
    const user = await step(ctx, {
      name: "create-user",
      execute: () => ctx.driver.create("user", { email: input.email }),
      compensate: (result) => ctx.driver.delete("user", { id: result.id }),
    })
    
    // Step 2: Create profile
    await step(ctx, {
      name: "create-profile",
      execute: () => ctx.driver.create("profile", { userId: user.id }),
      compensate: () => ctx.driver.delete("profile", { userId: user.id }),
    })
    
    // Step 3: Send welcome email
    await step(ctx, {
      name: "send-email",
      execute: () => sendWelcomeEmail(user.email),
      retry: { maxAttempts: 3, delay: 1000 },
    })
    
    return user
  }
})
```

---

## 💉 Service Container

Functional dependency injection with lifecycle management:

```typescript
const api = nevr({ ...config, driver: prisma(new PrismaClient()) })

// Register services
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY!))
api.registerService("email", () => new EmailService(), { lifecycle: "singleton" })

// Resolve in hooks or handlers
const handlePayment = async (ctx) => {
  const stripe = ctx.resolve<Stripe>("stripe")
  return stripe.charges.create({ amount: 1000, currency: "usd" })
}
```

**Lifecycle Options:**
- `singleton` — Single instance for app lifetime (default)
- `transient` — New instance on each resolve
- `scoped` — New instance per request scope

---

## ✅ Cross-Field Validation

Validate complex business rules:

```typescript
const order = entity("order", {
  startDate: datetime,
  endDate: datetime,
  minQty: int,
  maxQty: int,
})
  .validate({
    dateRange: {
      fn: (data) => data.endDate > data.startDate,
      message: "End date must be after start date",
      fields: ["startDate", "endDate"],
    },
    qtyRange: {
      fn: (data) => data.maxQty >= data.minQty,
      message: "Max quantity must be >= min quantity",
    },
  })
  
```

---

## 🔍 Query API

All list endpoints support powerful query parameters:

```bash
# Filtering
GET /api/posts?filter[published]=true
GET /api/posts?filter[authorId]=123

# Sorting
GET /api/posts?sort=createdAt      # Ascending
GET /api/posts?sort=-createdAt     # Descending

# Pagination
GET /api/posts?limit=20&offset=0

# Include relations
GET /api/posts?include=author
GET /api/posts?include=author,comments
```

---

## 🔷 Type Inference

Get end-to-end type safety from server to client:

```typescript
// src/server.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

export const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
export type API = typeof api
```

```typescript
// src/client.ts (can be in a different package!)
import { createTypedClient, entityClient } from "nevr/client"
import type { API } from "./server"

const client = createTypedClient<API>({
  baseURL: "/api",
  plugins: [entityClient({ entities: ["user", "post"] })],
})

// Full autocomplete & type checking!
const users = await client.users.list()
const user = await client.users.create({ email: "..." })
```

---

## 📚 Related Packages

| Package | Description |
|---------|-------------|
| [`nevr`](https://www.npmjs.com/package/nevr) | Core framework (this package) |
| [`create-nevr`](https://www.npmjs.com/package/create-nevr) | Project scaffolder |

---

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](./CONTRIBUTING.md) for details.

---

## 📄 License

[MIT](./LICENSE) © Nevr Contributors
