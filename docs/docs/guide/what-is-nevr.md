# What is Nevr?

Nevr is a framework-agnostic API builder. Define entities once and get a full stack:
- HTTP endpoints (Express/Hono) with ownership-aware authorization
- Input validation and helpful errors
- Pluggable database drivers (Prisma today)
- Optional plugins (auth, timestamps) without lock‑in
- Generated Prisma schema, shared TS types, and a typed API client

## Why Nevr?

APIs commonly require the same glue code across controllers, validation, auth, and routes. Nevr eliminates this:

1) Describe your domain with a tiny DSL

```ts
import { entity, string, text, bool, belongsTo } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(200),
  body: text,
  published: bool.default(false),
  author: belongsTo(() => user),
}).ownedBy("author")
```

2) Wire an adapter and a driver

```ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter } from "nevr/adapters/express"
```

3) Generate schema, types, and a client

```bash
npm run generate && npm run db:push
```

You now have CRUD endpoints, validation, and a database schema — all consistent with your entities.
