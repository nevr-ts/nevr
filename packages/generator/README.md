# @nevr/generator

[![Beta](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/nevr-ts/nevr)

Code generator for [nevr](https://github.com/nevr-ts/nevr) - generates Prisma schema, TypeScript types, and API client from entity definitions.

## Installation

```bash
npm install @nevr/generator
```

## Usage

```typescript
import { generate } from "@nevr/generator"
import { entity, string, text, belongsTo } from "nevr"

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
import { generatePrismaSchema } from "@nevr/generator"

const schema = generatePrismaSchema([user, post], {
  provider: "postgresql",
})

console.log(schema) // Prisma schema string
```

### `generateTypes(entities)`

Generate only the TypeScript type definitions.

```typescript
import { generateTypes } from "@nevr/generator"

const types = generateTypes([user, post])

console.log(types) // TypeScript interfaces
```

### `generateClient(entities)`

Generate only the API client.

```typescript
import { generateClient } from "@nevr/generator"

const client = generateClient([user, post])

console.log(client) // Client code
```

## Learn More

- [Nevr Documentation](https://github.com/nevr-ts/nevr)
- [Prisma Documentation](https://prisma.io/docs)

## License

MIT
