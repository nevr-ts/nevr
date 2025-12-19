# Drivers (Data Layer)

Drivers abstract your database. Nevr ships with a Prisma driver and a clear interface to add more.

## Responsibilities

1) CRUD methods (`findOne`, `findMany`, `create`, `update`, `delete`, `count`)
2) Translate Nevr filters/sorts to backend queries
3) Optional: transactions

## Prisma Driver

```ts
import { PrismaClient } from "@prisma/client"
import { prisma } from "nevr/drivers/prisma"
import { nevr } from "nevr"

const db = new PrismaClient()
const api = nevr({ entities, driver: prisma(db) })
```

### Query translation

List endpoint query params map to Prisma args:

- `?filter[field]=value` → `where: { field: { equals: value } }`
- `?sort=field` / `?sort=-field` → `orderBy: { field: 'asc' | 'desc' }`
- `?limit=10&offset=0` → `take` / `skip`

### Where operators

For advanced filters, pass an object on the client (generated client supports this):

```ts
{ where: { title: { contains: "hello" }, priority: { gte: 2 } } }
```

## Adding a Custom Driver

Implement the `Driver` interface (see API reference) and pass it in `nevr({ driver })`.
