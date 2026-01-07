# Core API

Complete API reference for Nevr. For tutorials, see the [Getting Started Guide](/guide/getting-started).

---

## `nevr(config): NevrInstance`

Creates a Nevr instance.

```typescript
import { nevr } from "nevr"

const api = nevr({
  entities: [user, post],
  driver: prisma(db),
  plugins: [auth({ mode: "session" })]
})
```

### Config Options

| Option | Type | Description |
|--------|------|-------------|
| `entities` | `Entity[]` | Your entity definitions |
| `driver` | `Driver` | Database driver (e.g., `prisma(db)`) |
| `plugins` | `Plugin[]` | Optional plugins (auth, timestamps, etc.) |
| `cors` | `CorsOptions \| false` | CORS configuration |
| `context` | `(req) => object` | Add custom context per request |

---

## `entity(name, fields): EntityBuilder`

Defines an entity (table + API endpoints).

```typescript
import { entity, string, text, belongsTo } from "nevr"

const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  author: belongsTo(() => user)
})
  .ownedBy("author")
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner"],
    delete: ["owner", "admin"]
  })
```

### EntityBuilder Methods

| Method | Description |
|--------|-------------|
| `.ownedBy(field)` | Set ownership relation for `owner` rule |
| `.rules(config)` | Define CRUD authorization rules |
| `.noTimestamps()` | Disable `createdAt`/`updatedAt` |
| `.build()` | Produce final `Entity` object |

---

## Field Types

Import from `nevr`:

```typescript
import { string, text, int, float, bool, datetime, json, email } from "nevr"
```

| Type | Prisma | TypeScript | Use |
|------|--------|------------|-----|
| `string` | `String` | `string` | Short text |
| `text` | `String` | `string` | Long text |
| `int` | `Int` | `number` | Integers |
| `float` | `Float` | `number` | Decimals |
| `bool` | `Boolean` | `boolean` | Flags |
| `datetime` | `DateTime` | `Date` | Timestamps |
| `json` | `Json` | `unknown` | Structured data |
| `email` | `String` | `string` | Email validation |

### Field Modifiers

```typescript
string.optional()      // Nullable
string.unique()        // Unique constraint
string.default("foo")  // Default value
string.min(3)          // Min length/value
string.max(100)        // Max length/value
```

---

## Relations

```typescript
import { belongsTo, hasMany, hasOne } from "nevr"

// Many-to-one (adds foreign key)
author: belongsTo(() => user)
author: belongsTo(() => user).foreignKey("createdById")
author: belongsTo(() => user).onDelete("cascade")
author: belongsTo(() => user).optional()

// One-to-many (inverse side)
posts: hasMany(() => post)

// One-to-one (inverse side)
profile: hasOne(() => profile)
```

---

## Authorization Rules

Built-in rules:

| Rule | Description |
|------|-------------|
| `"everyone"` | Public access |
| `"authenticated"` | Logged-in users |
| `"owner"` | Resource owner only |
| `"admin"` | Users with `role: "admin"` |

Custom rules:

```typescript
const isPremium = (ctx) => ctx.user?.subscription === "premium"

.rules({
  create: [isPremium, "admin"]
})
```

---

## Auth Plugin

Self-contained authentication.

```typescript
import { auth } from "nevr/plugins/auth"

auth({
  mode: "session",          // "session" | "bearer"
  emailAndPassword: true,   // Enable email/password
  secret: process.env.AUTH_SECRET,
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 days
    cookieName: "nevr.session_token",
  },
  password: {
    minLength: 8,
  }
})
```

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/sign-up` | Create account |
| POST | `/api/auth/sign-in` | Sign in |
| POST | `/api/auth/sign-out` | Sign out |
| GET | `/api/auth/session` | Get current session |

### Auth Entities

The plugin creates `user` and `session` entities automatically.

---

## Adapters

### Express

```typescript
import { expressAdapter } from "nevr/adapters/express"

app.use("/api", expressAdapter(api, {
  getUser: async (req) => ({ id: "...", role: "..." }),
  cors: true,
  debugLogs: true,
}))
```

### Hono

```typescript
import { honoAdapter } from "nevr/adapters/hono"

app.route("/api", honoAdapter(api, {
  getUser: async (c) => ({ id: "...", role: "..." }),
  debugLogs: true,
}))
```

---

## Driver (Prisma)

```typescript
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
const driver = prisma(db)
```

---

## Generated API Endpoints

For each entity, Nevr generates:

| Method | Route | Operation |
|--------|-------|-----------|
| GET | `/{entities}` | List all |
| GET | `/{entities}/:id` | Get one |
| POST | `/{entities}` | Create |
| PUT | `/{entities}/:id` | Update |
| DELETE | `/{entities}/:id` | Delete |

### Query Parameters

| Param | Example | Description |
|-------|---------|-------------|
| `filter[field]` | `?filter[status]=active` | Filter by field |
| `sort` | `?sort=-createdAt` | Sort (prefix `-` for desc) |
| `limit` | `?limit=10` | Pagination limit |
| `offset` | `?offset=20` | Pagination offset |

---

## Types

Key TypeScript types:

```typescript
import type {
  Entity,
  EntityConfig,
  FieldDef,
  RelationDef,
  Driver,
  NevrInstance,
  NevrRequest,
  NevrResponse,
  NevrPlugin,
  Route,
  Middleware,
} from "nevr"
```
