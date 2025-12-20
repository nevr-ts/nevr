# ⚡ Nevr

[![Beta](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/nevr-ts/nevr)
[![CI](https://github.com/nevr-ts/nevr/actions/workflows/ci.yml/badge.svg)](https://github.com/nevr-ts/nevr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Nevr write boilerplate again.** Nevr is a Zero-API, entity-first framework that turns your domain models into a fully functional, type-safe backend instantly.

> ⚠️ **Beta Software**: Nevr is under active development. APIs may change before v1.0.

## Quick Start

```bash
npm create nevr@latest my-api
cd my-api
npm run generate && npm run dev
```

## Core Idea: Define once, get everything.

```ts
import { entity, string, text, belongsTo } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(200),
  body: text,
  author: belongsTo(() => user),
}).ownedBy("author")
```

From this, you get CRUD endpoints, validation, auth rules, Prisma schema, TS types, and a client.

---

## 🚫 Solving the 6 Backend Nightmares

1. **The Boilerplate Trap**: Stop writing repetitive Controllers, Services, and Routes.
2. **The Type-Safety Gap**: Automatic client generation ensures your frontend build fails if the entity changes.
3. **Authorization Nightmares**: Declarative permissions (e.g., `.ownedBy('author')`) baked into the model.
4. **Inconsistent Validation**: Single source of truth for both Database constraints and Runtime validation.
5. **Documentation Drift**: Your schema *is* the documentation. OpenAPI specs are always in sync.
6. **The Expertise Bottleneck**: Junior and mid-level developers often spend days researching best practices for complex logic. Nevr encapsulates Senior-level architectural patterns into plug-and-play modules. The knowledge is in the system, not just in the minds of a few.

---

## 🥊 The Code Duel: Traditional vs. Nevr

# Traditional Approach (Express + Prisma + Zod)
 To get a single Post resource with validation and ownership-checks, you typically write:

- ❌ ~50-100 lines across 3+ files
- 1. Define Prisma Schema (schema.prisma)
- 2. Define Zod Validation (post.schema.ts)
- 3. Define Types (post.types.ts)
- 4. Write Controller logic (post.controller.ts)
- 5. Setup Routes (post.routes.ts)
```ts 
router.post("/posts", async (req, res) => {
  const schema = z.object({ title: z.string().min(1), body: z.string() });
  const data = schema.parse(req.body); // Manual validation
  
  const post = await prisma.post.create({ 
    data: { ...data, authorId: req.user.id } // Manual ownership link
  });
  res.json(post);
});
```
// ...Repeat for GET, PUT, DELETE, and Pagination logic

# The Nevr Approach
 With Nevr, the Entity is the API. You define the Post entity once:

// ✅ 8 lines, 1 file. Everything handled.
```ts
import { entity, string, text, belongsTo } from "nevr"
export const post = entity("post", {
  title: string.min(1).max(200),
  body: text,
  author: belongsTo(() => user),
}).ownedBy("author") 
```
DONE. You now have:

- POST /api/posts (Validated & Auth protected)
- GET /api/posts (Filtered, Sorted, Paginated)
- PUT /api/posts/:id (Ownership enforced)
- DELETE /api/posts/:id (Ownership enforced)
- Fully typed Frontend Client

---

## 🧩 The "Assemble-not-Build" Philosophy

Nevr isn't just a framework; it's a modular ecosystem built on the **Nevr Trinity**:

1. **Adapters**: Where your API lives (Express, Hono, Next.js).
2. **Drivers**: How your data is stored (Prisma, Drizzle, Kysely).
3. **Plugins**: Everything else.

### 🚀 Everything is a Plugin
In Nevr, high-level features are self-contained plugins. You don't need to be a senior architect to implement complex logic—you just plug it in.

| Plugin | What it adds to your project |
| :--- | :--- |
| **Auth** | Login routes, JWT/Session handling, and `User` schemas....and more. |
| **Payment** | Stripe integration, webhook handlers, and `Transaction` entities....and more. |
| **Storage** | S3/Cloudinary upload logic and file metadata tracking....and more. |
| **Realtime** | WebSocket emitters and event listeners for your entities....and more. |
|... | ... | ... |...more plugins to come... |

### 🛠️ Customization & Extensibility
Every plugin is **open and extendable**.
- **Extend the Schema:** Add custom fields to a plugin's internal entities.
- **Override Rules:** Customize the authorization logic of a pre-built plugin.
- **Create Your Own:** Package your business logic into a plugin and reuse it across every project you build.

> **Junior-Friendly, Senior-Powered**: Spend 1 hour learning the Nevr DSL, and you can assemble a backend that would typically take a senior developer weeks to architect from scratch.

---

## ⚖️ Traditional Backend vs. Nevr

| Feature | Traditional (Express / NestJS) | **Nevr** |
| :--- | :--- | :--- |
| **Boilerplate** | Write Routes, Controllers, and Services for every resource. | **Zero-API.** Define the Entity; the plumbing is handled. |
| **Type Safety** | Manually sync interfaces or use decorators. | **End-to-End.** Client is generated from the Entity; build fails on drift. |
| **Validation** | Duplicate logic in DB schema and Runtime (Zod/Joi). | **Single Source of Truth.** Constraints are baked into the Entity. |
| **Authorization** | Manual middleware chains and ownership checks. | **Declarative.** Use `.ownedBy()` or `.rules()` in the model. |
| **Documentation** | Maintain Swagger/OpenAPI decorators manually. | **Mathematically Synced.** OpenAPI spec is the schema itself. |
| **Data Access** | Manual CRUD logic and Repository patterns. | **Automatic CRUD.** Filtering, sorting, and pagination out-of-the-box. |

---

## Concepts At A Glance

- Entities: `entity(name, { fields })` → `.ownedBy(field)` `.rules({...})` `.noTimestamps()`
- Fields: `string`, `text`, `int`, `float`, `boolean`/`bool`, `datetime`, `json`, `email`
- Relations: `belongsTo(entity)`, `hasMany(entity)`, `hasOne(entity)` with `.foreignKey()`, `.onDelete()`, `.optional()`
- Rules: `everyone`, `authenticated`, `admin`, `owner`, `ownerOrAdmin`
- Validation: automatic by field definitions (min/max/optional/unique/email)
- Driver: implements data access (`nevr/drivers/prisma`)
- Adapter: bridges HTTP (`nevr/adapters/express`, `nevr/adapters/hono`)
- Plugins: extend fields, hooks, routes, middleware
- Generator: `@nevr/generator` or CLI `@nevr/cli`

## Generator & Client

Generate schema, types, and a typed client:

```ts
import { generate } from "@nevr/generator"
import { user, post } from "./entities"

generate([user, post], { outDir: "./generated", prismaProvider: "sqlite" })
```

Use the client in your frontend:

```ts
import { createClient } from "./generated/client"
const api = createClient({ baseUrl: "/api", headers: { "X-User-Id": "u_123" } })
const posts = await api.posts.list({ filter: { published: true }, limit: 10 })
```

## Reference Cheatsheet

Fields
- `string.text.int.float.boolean.datetime.json.email`
- Modifiers: `.optional() .unique() .default(v) .min(n) .max(n)`

Relations
- `belongsTo(() => User).foreignKey("userId").onDelete("cascade").optional()`
- `hasMany(() => Post)` • `hasOne(() => Profile)`

Entity builder
- `.ownedBy("author")` sets default CRUD rules around ownership
- `.rules({ create: ["authenticated"], update: ["owner"] })`
- `.noTimestamps()` disables createdAt/updatedAt

Rules (built-ins)
- `everyone`, `authenticated`, `admin`, `owner`, `ownerOrAdmin`

Adapter helpers (Express)
- `expressAdapter(api, { getUser, cors, debugLogs })`
<!-- - `expressDevAuth(req)` → reads `X-User-Id`, `X-User-Role` -->
- `expressJwtAuth(verify)` → parse Bearer token and verify


## Documentation

- Developer docs live in  docs/ (VitePress). Start with docs/guide/getting-started.md
- To run docs locally:

```bash
cd "docs"
npm install
npm run docs:dev
```

## Contributing

PRs welcome! Please see CONTRIBUTING.md and open an issue with your proposal.

- | `string` | Short text |
- | `text` | Long text |
- | `int` | Integer |
- | `float` | Decimal |
- | `bool` | Boolean |
- | `datetime` | Date & time |
- | `json` | JSON data |
- | `email` | Email with validation |

### Modifiers

```typescript
string              // Required
string.optional()   // Nullable
string.unique()     // Unique constraint
string.default("x") // Default value
int.min(0).max(100) // Validation
```

### Relations

```typescript
author: belongsTo(user)  // Many-to-one
posts: hasMany(post)     // One-to-many
```

### Authorization Rules

```typescript
// Built-in rules
everyone        // Anyone can access
authenticated   // Must be logged in
owner           // Must own the resource
admin           // Must be admin role

// Usage
entity("post", { ... }).rules({
  create: ["authenticated"],
  read: ["everyone"],
  update: ["owner"],
  delete: ["owner", "admin"],
})

// Shorthand
entity("post", { ... }).ownedBy("author")
```

### Query Parameters

| Parameter | Example | Description |
|-----------|---------|-------------|
| filter | `?filter[published]=true` | Filter results |
| sort | `?sort=-createdAt` | Sort (- for desc) |
| limit | `?limit=10` | Limit results |
| offset | `?offset=20` | Skip results |
| include | `?include=author` | Include relations |

## Advanced Usage

### Context Injection

Inject dependencies (like database clients or services) into every request:

```typescript
const api = nevr({
  // ...
  context: async (req) => ({
    db: new PrismaClient(),
    currentUser: req.user
  })
})
```

### Error Handling

Nevr automatically handles errors and returns standardized JSON responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email" }
    ]
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        NEVR CORE                            │
│  Entity DSL │ Validation │ Rules │ Plugin System │ Router   │
└──────────────────────────┬──────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
 ┌───────────┐      ┌───────────┐      ┌─────────────┐
 │  Adapter  │      │  Driver   │      │   Plugin    │
 └───────────┘      └───────────┘      └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
   Express             Prisma            timestamps
   (Hono)             (Drizzle)          soft-delete
   (Next.js)          (Kysely)            auth
    ...                 ...               payment
                                           ...
```                                        

## Packages

| Package | Description |
|---------|-------------|
| `nevr` | Core library |
| `@nevr/generator` | Code generators |
| `@nevr/cli` | CLI tool |
| `create-nevr` | Project scaffolder |

## Plugin System

Extend nevr with plugins:

```typescript
const api = nevr({
  entities: [...],
  driver: prisma(db),
  plugins: [
    timestamps(),    // Auto createdAt/updatedAt
    softDelete(),    // Soft delete support
  ],
})
```

## Roadmap

### Current (MVP)
- ✅ Entity DSL
- ✅ Field types & validation
- ✅ Relations (belongsTo, hasMany)
- ✅ Authorization rules
- ✅ CRUD operations
- ✅ Filtering, sorting, pagination
- ✅ Include relations
- ✅ Prisma driver
- ✅ Express adapter
- ✅ Hono adapter
- ✅ Dev & JWT auth helpers
- ✅ Timestamps plugin
- ✅ Generator for Prisma schema & TS types
- ✅ Code generators
- ✅ CLI & scaffolder


### Coming Soon
- **Drivers**: Drizzle, Kysely...
- **Adapters**: Next.js, Fastify, Koa...
- **Feature Plugins**: storage, search-meilisearch....
- **Enterprise Plugins**: advanced RBAC, audit logs, multi-tenancy...
- **Testing Utilities**: mocks, fixtures, e2e helpers...
- **Performance Optimizations**: caching, batching...
- ...more!

## License

MIT
