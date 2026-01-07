<p align="center">
  <img src="docs/docs/public/nevr_pp.png" alt="Nevr Logo" width="120" height="120" />
</p>

<h1 align="center">⚡ Nevr</h1>

<p align="center">
  <strong>The Full-Stack TypeScript Framework That Makes Backend Development Fun Again</strong>
</p>

<p align="center">
  <a href="https://github.com/nevr-ts/nevr"><img src="https://img.shields.io/badge/status-beta-orange.svg" alt="Beta"></a>
  <a href="https://github.com/nevr-ts/nevr/actions/workflows/ci.yml"><img src="https://github.com/nevr-ts/nevr/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://www.npmjs.com/package/nevr"><img src="https://img.shields.io/npm/v/nevr.svg?color=blue" alt="npm version"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-why-nevr">Why Nevr?</a> •
  <a href="#-features">Features</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-ecosystem">Ecosystem</a>
</p>

---

## 🎯 What is Nevr?

**Nevr** is a **full-stack TypeScript framework** that eliminates boilerplate by turning your domain models into fully functional, type-safe APIs. Define your entities once—get CRUD endpoints, validation, authorization, Prisma schema, and typed clients automatically.

```typescript
// This is your entire backend for a blog post resource
import { entity, string, text, belongsTo } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  author: belongsTo(() => user),
})
  .ownedBy("author")
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner"],
    delete: ["owner", "admin"],
  })
```

**That's it.** You now have:
- ✅ `POST /api/posts` — Create (validated, auth-protected)
- ✅ `GET /api/posts` — List (filtered, sorted, paginated)
- ✅ `GET /api/posts/:id` — Read (with relation includes)
- ✅ `PUT /api/posts/:id` — Update (ownership enforced)
- ✅ `DELETE /api/posts/:id` — Delete (ownership enforced)
- ✅ Prisma schema auto-generated
- ✅ TypeScript types inferred end-to-end
- ✅ Type-safe client for your frontend

---

## 🚀 Quick Start

```bash
# Create a new project in 30 seconds
npm create nevr@latest my-api
cd my-api

# Generate schema and start developing
npm run generate
npm run db:push
npm run dev
```

Your API is live at **http://localhost:3000/api** 🎉

---

## 💡 Why Nevr?

### The Problem

Building backends in 2024 still feels like it's 2014:

| Pain Point | Traditional Approach |
|------------|---------------------|
| **Boilerplate Hell** | 50-100 lines across 5+ files for one resource |
| **Type Drift** | Frontend and backend types go out of sync |
| **Auth Spaghetti** | Manual middleware chains, scattered ownership checks |
| **Validation Chaos** | Duplicate logic in DB schema AND runtime |
| **Documentation Rot** | Swagger/OpenAPI decorators that lie |

### The Nevr Solution

| Pain Point | Nevr Approach |
|------------|---------------|
| **Boilerplate Hell** | 8 lines, 1 file. Zero controllers, zero services. |
| **Type Drift** | Build fails if entity changes—client types are inferred |
| **Auth Spaghetti** | Declarative: `.ownedBy("author")` or `.rules({...})` |
| **Validation Chaos** | Single source of truth: `string.min(1).max(200)` |
| **Documentation Rot** | Schema IS the documentation—always in sync |

---

## ✨ Features

### 🏗️ Entity-First Architecture

Your entities are the API. No controllers, no services, no routes.

```typescript
const user = entity("user", {
  email: string.email().unique(),
  name: string.min(1).max(100),
  role: string.default("user"),
  password: string.password().omit(), // Hashed, never returned
})
```

### 🔐 Industrial-Grade Security

```typescript
// Field-level encryption
ssn: string.encrypted(),

// Automatic password hashing
password: string.password().omit(),

// Declarative authorization
.rules({
  create: ["authenticated"],
  update: ["owner", "admin"],
})
```

### 🔄 Workflow Engine (Saga Pattern)

Handle complex multi-step operations with automatic rollback:

```typescript
const checkoutWorkflow = workflow("checkout")
  .step("reserve", reserveInventory, cancelReservation)
  .step("charge", chargePayment, refundPayment)
  .step("fulfill", createShipment, cancelShipment)
  .build()

// If any step fails, previous steps are automatically compensated
await runWorkflow(checkoutWorkflow, { cartId, paymentMethod })
```

### 🧩 Plugin Ecosystem

```typescript
const api = nevr({
  entities: [user, post],
  plugins: [
    auth({
      secret: "",
      emailAndPassword: {
        enable: true,
        
      },
      socialProviders: { google: {
        clientId: "",
        clientSecret: "",
        },
        github: {
          clientId: "",
          clientSecret: "",
        },
    }),
    timestamps(),      // Auto createdAt/updatedAt
    storage({ s3: {} }),
    payments({ stripe: {} }),
  ],
})
```

### 🔗 Remote Data Stitching

Join data across microservices without GraphQL:

```typescript
const order = entity("order", {
  // Local fields
  total: int,
  // Remote relation - fetched from user-service
    subscription: belongsTo(() => stripeSubscription).remote("stripe"),
})
```

### 📊 Service Container (Dependency Injection)

```typescript
const emailService = createService("email", () => ({
  send: async (to, subject, body) => { /* ... */ },
}))

// Available in all hooks and workflows
ctx.services.email.send(user.email, "Welcome!", "...")
```

### 🎯 End-to-End Type Safety

```typescript
// Server
const api = nevr({ entities: [user, post] })
export type API = typeof api

// Client (types inferred automatically)
import type { API } from "./server"
const client = createTypedClient<API>({ baseURL: "/api" })

const posts = await client.posts.list() // Fully typed!
```

---

## 📊 The Numbers Don't Lie

| Metric | Traditional (Express + Prisma + Zod) | Nevr |
|--------|--------------------------------------|------|
| Lines of code per resource | ~80-120 | ~10 |
| Files per resource | 5+ | 1 |
| Time to add a new entity | 30+ min | 2 min |
| Type safety | Manual maintenance | Automatic |
| Authorization logic | Scattered | Declarative |

---

## 🌐 Framework Agnostic

Nevr works with your favorite tools:

```
                    ┌─────────────────────────────────────────┐
                    │              NEVR CORE                  │
                    │  Entities • Validation • Authorization   │
                    │  Workflows • Services • Remote Joiner   │
                    └──────────────────┬──────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
   ┌─────────┐                   ┌─────────┐                   ┌───────────┐
   │ Adapter │                   │ Driver  │                   │  Plugin   │
   └─────────┘                   └─────────┘                   └───────────┘
        │                              │                              │
        ▼                              ▼                              ▼
   • Express                      • Prisma                      • Auth
   • Hono                         • Drizzle (soon)              • Timestamps
   • Next.js (soon)               • Kysely (soon)               • Storage
   • Fastify (soon)                                             • Payments
```

---

## 📦 Ecosystem

| Package | Description |
|---------|-------------|
| [`nevr`](https://www.npmjs.com/package/nevr) | Core framework |
| [`@nevr/cli`](https://www.npmjs.com/package/@nevr/cli) | CLI for development |
| [`@nevr/generator`](https://www.npmjs.com/package/@nevr/generator) | Schema & type generator |
| [`create-nevr`](https://www.npmjs.com/package/create-nevr) | Project scaffolder |

---

## 📚 Documentation

- **[Getting Started](docs/docs/get-started/introduction.md)** — Your first Nevr project
- **[Entity DSL Reference](docs/docs/entities/defining.md)** — Master the entity syntax
- **[Plugin System](docs/docs/plugins/overview.md)** — Extend Nevr with plugins
- **[Workflows](docs/docs/actions/workflows.md)** — Build complex operations
- **[Type Inference](docs/docs/reference/inference.md)** — End-to-end type safety

Run docs locally:

```bash
cd docs
npm install
npm run docs:dev
```

---

## 🗺️ Roadmap

### ✅ Shipped
- Entity DSL with full validation
- Relations (belongsTo, hasMany, hasOne)
- Authorization rules & ownership
- Prisma driver
- Express & Hono adapters
- Auth plugin (Better Auth integration)
- Workflow engine with saga pattern
- Service container (DI)
- Remote data joiner
- Field encryption & password hashing
- CLI & project scaffolder

### 🚧 Coming Soon
- **Drizzle & Kysely drivers**
- **Next.js & Fastify adapters**
- **Real-time subscriptions (WebSocket)**
- **GraphQL adapter**
- **Admin dashboard generator**
- **Multi-tenancy plugin**
- **Audit logging plugin**

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Clone and install
git clone https://github.com/nevr-ts/nevr.git
cd nevr
npm install

# Run tests
npm test

# Build all packages
npm run build
```

---

## 💬 Community

- [GitHub Discussions](https://github.com/nevr-ts/nevr/discussions) — Ask questions
- [GitHub Issues](https://github.com/nevr-ts/nevr/issues) — Report bugs
- [Twitter](https://twitter.com/nevr_ts) — Stay updated

---

## 📄 License

[MIT](LICENSE) © Nevr Contributors

---

<p align="center">
  <strong>Stop writing boilerplate. Start shipping products.</strong>
  <br><br>
  <a href="https://github.com/nevr-ts/nevr">⭐ Star us on GitHub</a>
</p>
