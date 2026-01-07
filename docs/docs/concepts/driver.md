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
  driver: prisma(db, {
    // Enable debug logs
    debugLogs: true, 
  })
})
```

## Features

### Debug Logging
Nevr drivers implement a **4-Stage Logging System** to help you debug database operations:

1.  **Input**: The raw arguments received by the driver.
2.  **Transform**: The arguments after being processed (e.g., normalization).
3.  **Query**: The final query object sent to the database.
4.  **Output**: The result returned from the database.

You can configure this in the driver options:

```typescript
driver: prisma(db, {
  debugLogs: {
    query: true,   // specific stage
    output: true,
    create: true,  // specific operation
    findMany: false
  }
})
```

### Where Clause Normalization
Drivers automatically normalize rich query operators into a format your database understands. This supports:

- **Operators**: `equals`, `not`, `in`, `lt`, `gt`, `contains`, `startsWith`, etc.
- **Aliases**: `eq` -> `equals`, `ne` -> `not`.
- **Case Sensitivity**: Handling `mode: 'insensitive'`.

### Transformations
Drivers support an **Input/Output Transformation Pipeline**:

- **Input**: Transform data before writing (e.g., encryption, custom serialization).
- **Output**: Transform data after reading (e.g., decryption, computed fields).
- **Field Mapping**: Map field names to database columns (`fieldToColumn`, `columnToField`).

## Creating Custom Drivers

(Advanced) You can implement the `Driver` interface to support other ORMs or databases like Drizzle, TypeORM, or raw SQL.
