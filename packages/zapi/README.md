# Nevr

> Nevr write boilerplate again - Entity-first, type-safe API framework

[![Beta](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/nevr-ts/nevr)
[![npm version](https://badge.fury.io/js/nevr.svg)](https://www.npmjs.com/package/nevr)
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
npm install nevr
# or
pnpm add nevr
```

## Quick Start

```typescript
import { entity, string, text, belongsTo, zapi } from "nevr"

// 1. Define entities
const user = entity("user", {
  email: string.unique(),
  name: string.min(1).max(100),
}).build()

const post = entity("post", {
  title: string,
  content: text,
  author: belongsTo(() => user),
})
  .ownedBy("author")
  .build()

// 2. Mount to your framework (Express + Prisma example)
import express from "express"
import { expressAdapter, expressDevAuth } from "nevr/adapters/express"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const app = express()
const db = new PrismaClient()

const api = zapi({
  entities: [user, post],
  driver: prisma(db),
})

app.use("/api", expressAdapter(api, { getUser: expressDevAuth, cors: true }))
app.listen(3000)
```

## Entity DSL

```typescript
import { entity, string, text, int, bool, datetime, belongsTo } from "nevr"

const task = entity("task", {
  title: string.min(1).max(200),
  description: text.optional(),
  priority: int.default(0).min(0).max(3),
  completed: bool.default(false),
  dueDate: datetime.optional(),
  project: belongsTo(() => project),
  assignee: belongsTo(() => user),
})
  .ownedBy("assignee")
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner", "admin"],
    delete: ["admin"],
  })
  .build()
```

## Adapters

```typescript
// Express
import { expressAdapter, expressDevAuth } from "nevr/adapters/express"

// Hono
import { honoAdapter } from "nevr/adapters/hono"
```

## Drivers

```typescript
// Prisma
import { prisma } from "nevr/drivers/prisma"
```

## Plugins

```typescript
// Timestamps
import { timestamps } from "nevr/plugins/timestamps"
```

## Documentation

See the [main documentation](https://github.com/nevr-ts/nevr) for full guides.

## License

MIT
