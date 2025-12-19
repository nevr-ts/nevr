# Nevr

> **Nevr** write boilerplate again — Entity-first, type-safe API framework for TypeScript

<p align="center">
  <a href="https://www.npmjs.com/package/nevr"><img src="https://img.shields.io/npm/v/nevr.svg?style=flat-square&color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/nevr"><img src="https://img.shields.io/npm/dm/nevr.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/nevr-ts/nevr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license"></a>
  <a href="https://github.com/nevr-ts/nevr"><img src="https://img.shields.io/badge/status-beta-orange.svg?style=flat-square" alt="status"></a>
</p>

<p align="center">
  Define your entities. Get a full REST API with authentication, validation, and type-safe clients—automatically.
</p>

---

> ⚠️ **Beta Software**: Nevr is under active development. APIs may change before v1.0.

## ✨ Features

- 🚀 **Entity-first design** — Define entities, get complete CRUD APIs automatically
- 🔒 **End-to-end type safety** — Full TypeScript inference from database to client
- 🔐 **Built-in authentication** — [Better Auth](https://better-auth.com) integration with OAuth, sessions, JWT
- 🔌 **Framework agnostic** — Works with Express, Hono, and more
- 🗄️ **Database agnostic** — Prisma driver included, more coming soon
- 🧩 **Plugin system** — Extend with auth, timestamps, or custom plugins
- ⚡ **Zero config** — Sensible defaults, full customization when needed
- 📦 **Auto-generated clients** — Type-safe API clients for your frontend

## 📦 Installation

```bash
npm install nevr
# or
pnpm add nevr
# or
yarn add nevr
```

## 🚀 Quick Start

```typescript
import { entity, string, text, belongsTo, nevr } from "nevr"
import { expressAdapter, expressDevAuth } from "nevr/adapters/express"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import express from "express"

// 1️⃣ Define your entities
const user = entity("user", {
  email: string.unique(),
  name: string.min(1).max(100),
}).build()

const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  author: belongsTo(() => user),
})
  .ownedBy("author")
  .build()

// 2️⃣ Create your API
const api = nevr({
  entities: [user, post],
  driver: prisma(new PrismaClient()),
})

// 3️⃣ Mount to Express
const app = express()
app.use("/api", expressAdapter(api, { getUser: expressDevAuth, cors: true }))
app.listen(3000, () => console.log("API running at http://localhost:3000/api"))
```

That's it! You now have a full REST API with:
- `GET/POST /api/users` — List & create users
- `GET/PUT/DELETE /api/users/:id` — Read, update, delete user
- `GET/POST /api/posts` — List & create posts
- `GET/PUT/DELETE /api/posts/:id` — Read, update, delete post

## 📖 Entity DSL

### Field Types

```typescript
import { entity, string, text, int, float, bool, datetime, json, belongsTo } from "nevr"

const task = entity("task", {
  // String fields
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
}).build()
```

### Field Modifiers

| Modifier | Description | Example |
|----------|-------------|---------|
| `.optional()` | Make field nullable | `string.optional()` |
| `.unique()` | Add unique constraint | `string.unique()` |
| `.default(value)` | Set default value | `bool.default(false)` |
| `.min(n)` / `.max(n)` | Validation bounds | `string.min(1).max(100)` |

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
  .build()
```

**Built-in Rules:**
- `everyone` — No authentication required
- `authenticated` — Must be logged in
- `owner` — Must own the resource (via `ownedBy`)
- `admin` — Must have admin role

### Relations with Auth Plugin

Using the auth plugin's user entity:

```typescript
import { auth, authUser } from "nevr/plugins/auth"

const post = entity("post", {
  title: string,
  content: text,
  author: belongsTo(authUser),  // Reference auth plugin's user
})
  .ownedBy("author")
  .build()

const api = nevr({
  entities: [post],
  plugins: [auth({ emailAndPassword: true })],
  driver: prisma(db),
})
```

## 🔌 Adapters

### Express

```typescript
import { expressAdapter, expressDevAuth } from "nevr/adapters/express"

const app = express()

// Development (auto-login as user 1)
app.use("/api", expressAdapter(api, { 
  getUser: expressDevAuth,
  cors: true 
}))

// Production (custom auth)
app.use("/api", expressAdapter(api, { 
  getUser: async (req) => {
    const token = req.headers.authorization?.split(" ")[1]
    return token ? await verifyToken(token) : null
  },
  cors: true
}))
```

### Hono

```typescript
import { Hono } from "hono"
import { mountNevr, honoDevAuth } from "nevr/adapters/hono"

const app = new Hono()
mountNevr(app, "/api", api, { getUser: honoDevAuth })

export default app
```

## 🗄️ Drivers

### Prisma

```typescript
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const api = nevr({
  entities: [user, post],
  driver: prisma(new PrismaClient()),
})
```

Generate your Prisma schema with [@nevr/cli](https://www.npmjs.com/package/@nevr/cli):

```bash
npx @nevr/cli generate
npx prisma db push --schema=./generated/prisma/schema.prisma
```

## 🧩 Plugins

### Authentication (Better Auth)

Full-featured auth with email/password, OAuth, sessions, and JWT:

```typescript
import { auth } from "nevr/plugins/auth"

const api = nevr({
  entities: [post],
  plugins: [
    auth({
      emailAndPassword: true,
      mode: "session",  // "session" | "bearer" | "jwt"
      // OAuth providers
      // providers: { google: {...}, github: {...} }
    })
  ],
  driver: prisma(db),
})
```

**Generated routes:**
- `POST /api/auth/sign-up` — Create account
- `POST /api/auth/sign-in` — Sign in
- `POST /api/auth/sign-out` — Sign out
- `GET /api/auth/session` — Get current session

### Timestamps

Auto-manage `createdAt` and `updatedAt`:

```typescript
import { timestamps } from "nevr/plugins/timestamps"

const api = nevr({
  entities: [post],
  plugins: [timestamps()],
  driver: prisma(db),
})
```

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

## 📚 Related Packages

| Package | Description |
|---------|-------------|
| [`nevr`](https://www.npmjs.com/package/nevr) | Core framework (this package) |
| [`@nevr/cli`](https://www.npmjs.com/package/@nevr/cli) | CLI for schema generation |
| [`@nevr/generator`](https://www.npmjs.com/package/@nevr/generator) | Prisma/TypeScript generator |
| [`create-nevr`](https://www.npmjs.com/package/create-nevr) | Project scaffolder |

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](https://github.com/nevr-ts/nevr/blob/main/CONTRIBUTING.md) for details.

## 📄 License

[MIT](https://github.com/nevr-ts/nevr/blob/main/LICENSE) © Nevr Contributors
