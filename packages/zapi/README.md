# Zapi

> Zero to API in seconds - Entity-first, type-safe API framework

[![Beta](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/zapi-ts/zapi)
[![npm version](https://badge.fury.io/js/zapi.svg)](https://www.npmjs.com/package/zapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> ⚠️ **Beta Software**: APIs may change before v1.0. Use in production at your own risk.

## Features

- 🚀 **Entity-first** - Define your entities, get your API
- 🔒 **Type-safe** - Full TypeScript support with inference
- 🔌 **Framework agnostic** - Express, Hono, and more
- 🗄️ **Database agnostic** - Prisma, and more coming
- 🧩 **Plugin system** - Auth, timestamps, and custom plugins
- ⚡ **Zero config** - Sensible defaults, override when needed

## Installation

```bash
npm install @zapi-ts/core
# or
pnpm add @zapi-ts/core
```

## Quick Start

```typescript
import { entity, string, text, belongsTo } from "@zapi-ts/core"
import { zapi } from "@zapi-ts/core"

// 1. Define entities
const user = entity("user", {
  email: string.unique(),
  name: string.min(1).max(100),
})
  .build()

const post = entity("post", {
  title: string,
  content: text,
  author: belongsTo(() => user),
})
  .ownedBy("author")
  .build()

// 2. Mount to your framework (Express + Prisma example)
import express from "express"
import { expressAdapter, expressDevAuth } from "@zapi-ts/core/adapters/express"
import { prisma } from "@zapi-ts/core/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const app = express()
const prisma = new PrismaClient()

const api = zapi({
  entities: [user, post],
  driver: prisma(prisma),
})

app.use("/api", expressAdapter(api, { getUser: expressDevAuth, cors: true }))

app.listen(3000)
```

## Entity DSL

```typescript
import { entity, string, text, int, bool, datetime, belongsTo, hasMany } from "@zapi-ts/core"

const task = entity("task", {
  // String fields
  title: string.min(1).max(200),
  description: text.optional(),
  
  // Other types
  priority: int.default(0).min(0).max(3),
  completed: bool.default(false),
  dueDate: datetime.optional(),
  
  // Relations
  project: belongsTo(() => project),
  assignee: belongsTo(() => user),
})
  .ownedBy("assignee")  // Auto-set owner on create
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner", "admin"],
    delete: ["admin"],
  })
  .build()
```

## Adapters

Import only what you need:

```typescript
// Express
import { expressAdapter, expressDevAuth, expressJwtAuth } from "zapi/adapters/express"

// Hono
import { honoAdapter, honoDevAuth, honoJwtAuth, cookieAuth } from "zapi/adapters/hono"
```

## Drivers

```typescript
// Prisma
import { prisma } from "zapi/drivers/prisma"
```

## Plugins

```typescript
// Timestamps (adds createdAt/updatedAt globally)
import { timestamps } from "zapi/plugins/timestamps"

// Auth helpers are provided via adapters (dev/jwt) to keep Zapi auth-agnostic
// import { expressDevAuth, expressJwtAuth } from "zapi/adapters/express"
```

## Generated Files

Use the generator to create Prisma schema, TypeScript types, and API client:

```typescript
import { generate } from "@zapi-ts/generator"
import { entities } from "./entities"

generate(entities, {
  outDir: "./generated",
  prismaProvider: "sqlite",
})
```

This generates:
- `generated/prisma/schema.prisma` - Prisma schema
- `generated/types.ts` - TypeScript interfaces
- `generated/client.ts` - Type-safe API client

## API Endpoints

For each entity, zapi generates:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List with filter/sort/pagination |
| POST | `/users` | Create |
| GET | `/users/:id` | Get by ID |
| PUT | `/users/:id` | Update |
| DELETE | `/users/:id` | Delete |

## Query Parameters

```bash
# Filtering
GET /users?filter[role]=admin

# Sorting
GET /posts?sort=-createdAt

# Pagination
GET /posts?limit=10&offset=20

# Include relations
GET /posts?include=author
```

## License

MIT © 2025
