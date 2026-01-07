# Basic Usage

> ⚡ **The Nevr Development Loop.**

Once installed, your workflow is simple: **Define → Generate → Run.**

---

## 1. Define Entities

Your `src/entities` folder is your source of truth.

```typescript
// src/entities/post.ts
import { entity, string, text, bool } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(100),
  content: text,
  published: bool.default(false),
})
```

## 2. Generate Artifacts

Whenever you change an entity, run the generator. This updates your Prisma schema and TypeScript types.

```bash
npm run generate
```

Then push changes to the database:

```bash
npm run db:push
```

## 3. Use the Type-Safe Client

Nevr automatically generates a client SDK for your frontend or other services.

```typescript
import { client } from "./client" // Generated client

// 100% Type-Safe!
const posts = await client.post.findMany({
  where: { published: true },
  select: { title: true } 
})
```

## 4. That's it!

You have a running API with:
- `POST /api/posts` (Create)
- `GET /api/posts` (List)
- `GET /api/posts/:id` (Read)
- `PATCH /api/posts/:id` (Update)
- `DELETE /api/posts/:id` (Delete)

---

## Next Steps

- [Custom Actions](/guide/actions) - Add complex logic beyond CRUD
- [Authorization](/entities/authorization) - Secure your endpoints
- [Relationships](/fields/relations) - Connect your data
