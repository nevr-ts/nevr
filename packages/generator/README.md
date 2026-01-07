<h1 align="center">🔧 @nevr/generator</h1>

<p align="center">
  <strong>Turn your entities into Prisma schemas, types, and clients</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nevr/generator"><img src="https://img.shields.io/npm/v/@nevr/generator.svg?style=flat-square&color=blue" alt="npm version"></a>
  <a href="https://github.com/nevr-ts/nevr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license"></a>
</p>

---

## 🎯 What It Does

The generator takes your Nevr entity definitions and produces:

- **Prisma Schema** — Complete database schema with relations
- **OpenAPI Spec** — Swagger/OpenAPI 3.0 specification
- **TypeScript Types** — Fully typed interfaces (deprecated, use `$Infer`)
- **API Client** — Ready-to-use fetch wrapper (deprecated, use `createClient`)

---

## 📦 Installation

```bash
npm install @nevr/generator
```

> **Note:** Usually used via `@nevr/cli`. Direct usage is for advanced cases.

---

## 🚀 Quick Usage

```typescript
import { generateSchema } from "@nevr/generator"
import { user, post } from "./entities"

// Generate Prisma schema
generateSchema([user, post], {
  provider: "postgresql",
  output: "./prisma",
})
```

---

## 📖 API Reference

### `generateSchema(entities, options)`

Main function to generate complete Prisma schema.

```typescript
generateSchema(entities, {
  provider: "sqlite" | "postgresql" | "mysql",
  output: "./generated",
  useCache: true,  // Enable incremental builds
})
```

### `generatePrismaSchema(entities, options)`

Generate only the Prisma schema string.

```typescript
const schema = generatePrismaSchema(entities, {
  provider: "postgresql",
})
console.log(schema) // Complete .prisma content
```

### `generatePrismaModels(entities)`

Generate only model definitions (no datasource/generator blocks).

```typescript
const models = generatePrismaModels(entities)
// model User { ... }
// model Post { ... }
```

### `generatePrismaHeader(options)`

Generate only the datasource and generator blocks.

```typescript
  url: 'env("DATABASE_URL")',
})
```

### `generateOpenAPI(entities, options)`

Generate OpenAPI 3.0 specification.

```typescript
const spec = generateOpenAPI(entities, {
  info: { title: "My API", version: "1.0.0" },
  servers: [{ url: "http://localhost:3000" }],
  outPath: "./openapi.json",
  security: true // Add bearer auth scheme
})
```

---

## ⚡ Incremental Caching

The generator caches entity hashes to skip unchanged entities:

```
.nevr-cache.json
├── version: "1.0.0"
├── entities: { user: "abc123...", post: "def456..." }
└── lastGenerated: "2024-01-15T10:30:00Z"
```

Disable with `useCache: false`.

---

## ⚠️ Deprecated Functions

These functions still work but are deprecated in favor of type inference:

| Deprecated | Replacement |
|------------|-------------|
| `generateTypes()` | Use `$Infer` pattern |
| `generateClient()` | Use `createClient<typeof api>()` |

```typescript
// ❌ Old way
const types = generateTypes(entities)

// ✅ New way - types inferred automatically
import type { API } from "./server"
type User = API["$Infer"]["Entities"]["user"]
```

---

## 📚 Related

| Package | Description |
|---------|-------------|
| [`nevr`](https://npmjs.com/package/nevr) | Core framework |
| [`@nevr/cli`](https://npmjs.com/package/@nevr/cli) | CLI interface |
| [`create-nevr`](https://npmjs.com/package/create-nevr) | Project scaffolder |

---

## 📄 License

[MIT](https://github.com/nevr-ts/nevr/blob/main/LICENSE) © Nevr Contributors
