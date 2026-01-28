# Quick Start

Get a fully functional Nevr API running in under 5 minutes.

## Create a New Project

```bash
npm create nevr@latest my-api
cd my-api
```

Follow the prompts to select your preferred:
- **Database**: SQLite (default), PostgreSQL, or MySQL
- **HTTP Framework**: NextJs, Express, or Hono

### CLI Options Reference

| Option | Values | Default |
|--------|--------|---------|
| `--database` | `sqlite`, `postgresql`, `mysql` | `sqlite` |
| `--http` | `express`, `hono`, `fastify` | `express` |
| `--skip-install` | - | `false` |
| `--git` | - | `true` |

```bash
# Example: PostgreSQL + Hono, skip git init
npm create nevr@latest my-api -- --database postgresql --http hono --no-git
```

## Project Structure

After creation, you'll have:

```
my-api/
├── src/
│   ├── entities/ # Your entity definitions
│   ├── nevr.config.ts             # Nevr configuration
│   └── server.ts             # HTTP server entry point
├── prisma/
│   └── schema.prisma         # Generated Prisma schema
├── package.json
└── tsconfig.json
```

### Key Files Explained

| File | Purpose |
|------|---------|
| `src/entities/*.ts` | Entity definitions (source of truth) |
| `src/nevr.config.ts` | Nevr configuration for generating Prisma schema |
| `src/server.ts` | HTTP adapter setup and Nevr instance initialization |
| `prisma/schema.prisma` | Auto-generated database schema |

## Start Development

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start dev server
npm run dev
```

Your API is now running at `http://localhost:3000`.

### NPM Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch src/server.ts` | Start dev server with hot reload |
| `generate` | `nevr generate` | Regenerate Prisma schema from entities |
| `db:push` | `prisma db push` | Push schema to database |
| `db:migrate` | `prisma migrate dev` | Create migration |
| `build` | `tsc` | Build TypeScript |

## Try It Out

All CRUD endpoints are automatically generated for your entities:

### Generated Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | List all users (with pagination, filtering) |
| `GET` | `/api/users/:id` | Get a single user by ID |
| `POST` | `/api/users` | Create a new user |
| `PATCH` | `/api/users/:id` | Update a user (partial) |
| `PUT` | `/api/users/:id` | Replace a user (full) |
| `DELETE` | `/api/users/:id` | Delete a user |

### Create a User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

Response:
```json
{
  "id": "clx...",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### List All Users (with Query Options)

```bash
# Basic list
curl http://localhost:3000/api/users

# With pagination
curl "http://localhost:3000/api/users?skip=0&take=10"

# With filtering
curl "http://localhost:3000/api/users?where[email][contains]=@example.com"

# With sorting
curl "http://localhost:3000/api/users?orderBy[createdAt]=desc"

# Include relations
curl "http://localhost:3000/api/users?include=posts"
```

### Query Parameters Reference

| Parameter | Example | Description |
|-----------|---------|-------------|
| `skip` | `?skip=10` | Skip N records (offset) |
| `take` | `?take=25` | Limit to N records |
| `filter` | `?filter` | Filter conditions |
| `sort` | `?sort` | Sort order |
| `include` | `?include=relation` | Include related records |
| `select` | `?select=field1,field2` | Select specific fields |
### Get a Single User

```bash
curl http://localhost:3000/api/users/clx...
```

### Update a User

```bash
curl -X PATCH http://localhost:3000/api/users/clx... \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe"}'
```

### Delete a User

```bash
curl -X DELETE http://localhost:3000/api/users/clx...
```

## Add Your First Entity

Create a new entity in `src/entities/post.ts`:

```typescript
import { entity, string, text, boolean, belongsTo } from "nevr"
import { user } from "./user"

export const post = entity("post", {
  title: string.min(1).max(200),      // Required, 1-200 chars
  content: text,                       // Long text field
  published: boolean.default(false),   // Default to draft
  author: belongsTo(() => user),       // Relation to user
})
```

### Field Types Quick Reference

| Type | Import | Description |
|------|--------|-------------|
| `string` | `string` | Short text (varchar) |
| `text` | `text` | Long text (unlimited) |
| `int` | `int` | Integer number |
| `float` | `float` | Decimal number |
| `boolean` / `bool` | `boolean`, `bool` | True/false |
| `datetime` | `datetime` | Date and time |
| `json` | `json` | JSON object |
| `belongsTo` | `belongsTo(() => Entity)` | Many-to-one relation |
| `hasMany` | `hasMany(() => Entity)` | One-to-many relation |
| `hasOne` | `hasOne(() => Entity)` | One-to-one relation |

Register it in `src/nevr.config.ts`:

```typescript
import { defineConfig } from "nevr"
import { user } from "./entities/user"
import { post } from "./entities/post"  // [!code ++]

export const config = defineConfig({
  database: "sqlite",
  entities: [user, post],  // [!code highlight]
  plugins: [],
})

export default config
```

Regenerate and push:

```bash
npm run generate
npm run db:push
```

Now you have a full CRUD API for posts at `/api/posts`.

## Add Authorization

Make posts owned by their author:

```typescript
export const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  published: boolean.default(false),
  author: belongsTo(() => user),
})
  .ownedBy("author")  // [!code ++]  Sets owner + default rules
  .rules({            // [!code ++]  Override specific rules
    create: ["authenticated"],  // [!code ++]
    read: ["everyone"],         // [!code ++]
    update: ["owner"],          // [!code ++]
    delete: ["owner"],          // [!code ++]
  })                  // [!code ++]
```

### What `.ownedBy()` Does

When you call `.ownedBy("author")`, Nevr automatically:

1. Sets the `author` relation as the owner field
2. Applies default rules if not overridden:

| Operation | Default Rule |
|-----------|--------------|
| `create` | `authenticated` |
| `read` | `everyone` |
| `update` | `owner` |
| `delete` | `owner` |
| `list` | `everyone` |

### Built-in Rules Reference

| Rule | Description |
|------|-------------|
| `everyone` | Anyone (no auth required) |
| `authenticated` | Any logged-in user |
| `owner` | Only the resource owner |
| `admin` | Users with admin role |
| `ownerOrAdmin` | Owner or admin |

Now:
- Anyone can read posts
- Only authenticated users can create posts
- Only the author can update or delete their own posts

## Add a Custom Action

Add a "publish" action to posts:

```typescript
import { entity, string, text, boolean, belongsTo, action } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  published: boolean.default(false),
  author: belongsTo(() => user),
})
  .ownedBy("author")
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner"],
    delete: ["owner"],
  })
  .actions({  // [!code ++]
    publish: action()  // [!code ++]
      .onResource()    // [!code ++]  Requires :id in URL
      .rules("owner")  // [!code ++]  Only owner can publish
      .handler(async (ctx) => {  // [!code ++]
        const post = await ctx.driver.update(  // [!code ++]
          "post",  // [!code ++]
          { id: ctx.resourceId },  // [!code ++]
          { published: true }  // [!code ++]
        )  // [!code ++]
        return post  // [!code ++]
      }),  // [!code ++]
  })  // [!code ++]
```

### Action Builder Methods Reference

| Method | Description |
|--------|-------------|
| `action()` | Create new action |
| `.get()` / `.post()` | Set HTTP method (default: POST) |
| `.onResource()` | Require resource ID in URL |
| `.rules(...rules)` | Set authorization rules |
| `.input(schema)` | Define input validation schema |
| `.handler(fn)` | Set the action handler |
| `.workflow(steps)` | Use saga pattern with compensation |
| `.meta({ summary, description })` | Add OpenAPI metadata |

### Action Context Properties

| Property | Type | Description |
|----------|------|-------------|
| `ctx.resourceId` | `string` | The resource ID from URL |
| `ctx.input` | `TInput` | Validated input data |
| `ctx.user` | `User \| null` | Authenticated user |
| `ctx.driver` | `Driver` | Database driver |
| `ctx.entity` | `string` | Entity name |

Call it:

```bash
curl -X POST http://localhost:3000/api/posts/clx.../publish
```

## What's Next?

You've just built a fully functional API with:
- ✅ CRUD operations
- ✅ Relationships
- ✅ Authorization rules
- ✅ Custom actions

Explore more:

| Topic | Link | Description |
|-------|------|-------------|
| **Fields** | [Fields Overview](/fields/overview) | All field types and modifiers |
| **Entities** | [Defining Entities](/entities/defining) | Advanced entity configuration |
| **Actions** | [Actions Overview](/actions/overview) | Custom operations and workflows |
| **Authentication** | [Auth Plugin](/plugins/auth) | Add user authentication |
| **Services** | [DI Container](/services/container) | Dependency injection |
| **Generators** | [Code Generation](/guide/openapi) | Prisma, TypeScript, OpenAPI |
