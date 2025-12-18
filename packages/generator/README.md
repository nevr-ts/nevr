# @zapi-ts/generator

[![Beta](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/zapi-ts/zapi)

Code generator for [zapi](https://github.com/zapi-ts/zapi) - generates Prisma schema, TypeScript types, and API client from entity definitions.

## Installation

```bash
npm install @zapi-ts/generator
```

## Usage

```typescript
import { generate } from "@zapi-ts/generator"
import { entity, string, text, belongsTo } from "@zapi-ts/core"

// Define entities
const user = entity("user", {
  email: string.unique(),
  name: string,
}).build()

const post = entity("post", {
  title: string,
  body: text,
  author: belongsTo(() => user),
})
  .ownedBy("author")
  .build()

// Generate all files
generate([user, post], {
  outDir: "./generated",
  prismaProvider: "sqlite", // or "postgresql", "mysql"
})
```

## API

### `generate(entities, options)`

Generates all files at once:
- Prisma schema (`prisma/schema.prisma`)
- TypeScript types (`types.ts`)
- API client (`client.ts`)

Options:
- `outDir` - Output directory (default: `./generated`)
- `prismaProvider` - Database provider: `sqlite`, `postgresql`, `mysql` (default: `sqlite`)
- `prismaOutput` - Custom Prisma client output path

### `generatePrismaSchema(entities, options)`

Generate only the Prisma schema.

```typescript
import { generatePrismaSchema } from "@zapi-ts/generator"

const schema = generatePrismaSchema([user, post], {
  provider: "postgresql",
})

console.log(schema) // Prisma schema string
```

### `generateTypes(entities)`

Generate only the TypeScript type definitions.

```typescript
import { generateTypes } from "@zapi-ts/generator"

const types = generateTypes([user, post])

console.log(types) // TypeScript interfaces
```

### `generateClient(entities)`

Generate only the API client.

```typescript
import { generateClient } from "@zapi-ts/generator"

const client = generateClient([user, post])

console.log(client) // Client code
```

## Features

### Inverse Relations

The generator automatically creates inverse relations. For example:

```typescript
const project = entity("project", {
  owner: belongsTo(() => user),
}).build()
```

Will generate:

```prisma
model User {
  id        String    @id @default(cuid())
  // ... other fields
  projects  Project[] // Auto-generated inverse relation
}

model Project {
  id      String @id @default(cuid())
  ownerId String
  owner   User   @relation(fields: [ownerId], references: [id])
}
```

### Multiple Relations to Same Entity

When an entity has multiple relations to the same target entity, the generator automatically adds relation names:

```typescript
const task = entity("task", {
  assignee: belongsTo(() => user),
  createdBy: belongsTo(() => user),
}).build()
```

Generates:

```prisma
model Task {
  assigneeId  String
  assignee    User   @relation("TaskAssignee", fields: [assigneeId], references: [id])
  createdById String
  createdBy   User   @relation("TaskCreatedBy", fields: [createdById], references: [id])
}

model User {
  assignedTasks Task[] @relation("TaskAssignee")
  createdTasks  Task[] @relation("TaskCreatedBy")
}
```

## CLI Usage

For command-line usage, install `@zapi-ts/cli`:

```bash
npm install -g @zapi-ts/cli
zapi generate
```

## License

MIT
