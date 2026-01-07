# Generator API Reference

The `@nevr/generator` package provides functions for generating Prisma schemas, TypeScript types, and API clients from your Nevr entity definitions.

## Installation

```bash
npm install @nevr/generator
```

## Primary Functions

### generateSchema

Generate a complete Prisma schema from your entities.

```typescript
import { generateSchema } from "@nevr/generator"
import { entities } from "./entities"

const schema = generateSchema(entities, {
  provider: "postgresql",  // sqlite, mysql, postgresql
  output: "./generated",
})
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `"sqlite" \| "postgresql" \| "mysql"` | `"sqlite"` | Database provider |
| `output` | `string` | `"./generated"` | Output directory |
| `useCache` | `boolean` | `true` | Enable incremental caching |

---

### generatePrismaSchema

Generate only the Prisma schema file (no types).

```typescript
import { generatePrismaSchema } from "@nevr/generator"

generatePrismaSchema(entities, {
  provider: "postgresql",
  output: "./prisma",
  filename: "schema.prisma",
})
```

---

### generatePrismaHeader

Generate the header portion of a Prisma schema (generator + datasource blocks).

```typescript
import { generatePrismaHeader } from "@nevr/generator"

const header = generatePrismaHeader({
  provider: "postgresql",
  url: "env(\"DATABASE_URL\")",
})
// Returns string with generator and datasource blocks
```

---

### generatePrismaModels

Generate only the model definitions from entities.

```typescript
import { generatePrismaModels } from "@nevr/generator"

const models = generatePrismaModels(entities)
// Returns string with all model definitions
```

---

## Incremental Caching

The generator uses an incremental caching system to avoid regenerating unchanged entities.

```typescript
// Cache is stored in .nevr-cache.json
{
  "version": "1.0.0",
  "entities": {
    "user": "abc123...",  // MD5 hash of entity config
    "post": "def456..."
  },
  "lastGenerated": "2024-01-15T10:30:00Z"
}
```

**Disable caching:**
```typescript
generateSchema(entities, { useCache: false })
```


## CLI Integration

The generator is typically invoked via the CLI:

```bash
npx nevr generate
```

See [CLI > Code Generation](/cli/generate) for details.

## Next Steps

- [CLI Reference](/cli/overview)
- [Type Inference](/reference/inference)
- [Prisma Integration](/database/prisma)
