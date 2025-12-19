# Prisma Driver

The Prisma driver is the default and most supported driver for Nevr. It leverages the power of Prisma ORM to handle database migrations, type safety, and query execution.

## Setup

To use the Prisma driver, you need to install the necessary packages:

```bash
npm install @prisma/client prisma
```

## Configuration

Initialize the driver and pass it to the `nevr` function.

```typescript
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const api = nevr({
  // ...
  driver: prisma(db)
})
```

## Schema Generation

When you run the Nevr generator, it automatically creates a `schema.prisma` file based on your entities.

```bash
# Run the generator script
npx tsx src/generate.ts
```

The generated schema will be located at `generated/prisma/schema.prisma` (or wherever you configured `outDir`).

## Database Migration

Once the schema is generated, you use standard Prisma commands to update your database.

```bash
# For prototyping (SQLite/Dev)
npx prisma db push --schema=generated/prisma/schema.prisma

# For production (Migrations)
npx prisma migrate dev --schema=generated/prisma/schema.prisma
```

## Accessing Prisma Client

You can access the underlying Prisma Client instance if you need to perform raw queries or complex operations not yet supported by Nevr's high-level API.

```typescript
// In your custom code
await db.user.findMany({
  where: {
    // ...
  }
})
```
