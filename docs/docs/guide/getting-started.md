# Getting Started

## Scaffold a Project

```bash
npm create nevr@latest my-api
cd my-api
```

Then:

```bash
npm run generate   # generates Prisma schema, TS types, client
npm run db:push    # creates database tables
npm run dev        # start server on http://localhost:3000
```

You now have endpoints like `/api/users` and `/api/posts` ready.

## Manual Setup (Advanced)

Install pieces directly in an existing repo:

```bash
npm i nevr @nevr/generator @prisma/client prisma express
```

Define entities and generate outputs:

```ts
// src/entities/post.ts
import { entity, string, text, bool, belongsTo } from "nevr"
import { user } from "./user"

export const post = entity("post", {
	title: string.min(1).max(200),
	body: text,
	published: bool.default(false),
	author: belongsTo(() => user),
}).ownedBy("author")
```

```ts
// scripts/generate.ts
import { generate } from "@nevr/generator"
import { user } from "../src/entities/user"
import { post } from "../src/entities/post"

generate([user, post], { outDir: "./generated", prismaProvider: "sqlite" })
```

Run it:

```bash
npx tsx scripts/generate.ts
npx prisma db push --schema=generated/prisma/schema.prisma
```

## Next Steps

- [Entities & Fields](/guide/entities)
- [Drivers (Prisma)](/guide/drivers)
- [Adapters (Express/Hono)](/guide/adapters)
- [Plugins & Auth](/guide/plugins)
