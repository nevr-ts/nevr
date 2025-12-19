# Drivers

Drivers in Nevr are responsible for the **Data Access Layer**. They abstract away the specific database implementation, allowing Nevr to communicate with your data store.

## Role of a Driver

1.  **Schema Management**: Translating Nevr Entities into database schemas (e.g., Prisma Schema).
2.  **Query Execution**: Performing CRUD operations (Create, Read, Update, Delete) requested by the API.
3.  **Transaction Management**: Handling atomic operations.

## Available Drivers

### Prisma Driver

The primary driver for Nevr is **Prisma**. It provides robust type safety and supports many databases (PostgreSQL, MySQL, SQLite, SQL Server, MongoDB, CockroachDB).

```typescript
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const api = nevr({
  // ...
  driver: prisma(db)
})
```

## Creating Custom Drivers

(Advanced) You can implement the `Driver` interface to support other ORMs or databases like Drizzle, TypeORM, or raw SQL.
