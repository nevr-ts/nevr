# Database Drivers

Nevr uses drivers to abstract database operations.

## What is a Driver?

A driver is an interface between Nevr and your database:

```typescript
interface Driver {
  findOne<T>(entity: string, where: Where): Promise<T | null>
  findMany<T>(entity: string, options?: QueryOptions): Promise<T[]>
  create<T>(entity: string, data: any): Promise<T>
  update<T>(entity: string, where: Where, data: any): Promise<T>
  delete(entity: string, where: Where): Promise<void>
  count(entity: string, where?: Where): Promise<number>
}
```

## Available Drivers

| Driver | Database | Status |
|--------|----------|--------|
| `prisma` | PostgreSQL, MySQL, SQLite | Stable |

## Using Prisma Driver

```typescript
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const api = nevr({
  entities: [user, post],
  driver: prisma(new PrismaClient()),
})
```

## Driver Methods

### findOne

```typescript
const user = await driver.findOne("user", { id: "123" })
```

### findMany

```typescript
const users = await driver.findMany("user", {
  where: { role: "admin" },
  orderBy: { createdAt: "desc" },
  take: 10,
  skip: 0,
})
```

### create

```typescript
const user = await driver.create("user", {
  name: "John",
  email: "john@example.com",
})
```

### update

```typescript
const user = await driver.update(
  "user",
  { id: "123" },
  { name: "Jane" }
)
```

### delete

```typescript
await driver.delete("user", { id: "123" })
```

### count

```typescript
const total = await driver.count("user", { role: "admin" })
```

## Next Steps

- [Prisma Driver](/database/prisma)
- [Enhanced Driver](/database/enhanced-driver)
- [Transactions](/database/transactions)
