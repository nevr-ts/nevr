# RAG Guide - AI-First Document

> Nevr is the first framework with built-in RAG (Retrieval-Augmented Generation) support.

## Quick Start

### 1. Define Entities with AI Fields

```typescript
import { entity, string, text } from "nevr"

const article = entity("article", {
  title: string.searchable(),                           // Full-text search
  content: text.embedding({ provider: "openai" }),      // Vector search
  summary: text.embedding().instruction("For quick Q&A"),
})
```

### 2. Create RAG Engine

```typescript
import { createRAGEngine } from "nevr"

const rag = createRAGEngine({
  embedding: { provider: "openai" },  // Uses OPENAI_API_KEY env var
  vectorStore: { type: "memory" },    // In-memory for dev
})
```

### 3. Index Content

```typescript
await rag.generateEmbeddings(article, "123", {
  title: "Password Reset Guide",
  content: "To reset your password, click the forgot password link...",
})
```

### 4. Semantic Search

```typescript
const results = await rag.search("how do I reset my password?", {
  entities: ["article"],
  limit: 5,
})
// → [{ id: "article:123:content", score: 0.92, metadata: {...} }]
```

---

## Embedding Providers

| Provider | Dimensions | Environment Variable |
|:--|:--|:--|
| OpenAI | 1536 | `OPENAI_API_KEY` |
| Cohere | 1024 | `COHERE_API_KEY` |
| Custom | Varies | User-defined |

```typescript
// OpenAI (default)
{ provider: "openai", model: "text-embedding-3-small" }

// Cohere
{ provider: "cohere", model: "embed-english-v3.0" }
```

---

## Vector Stores

| Store | Use Case | Persistence |
|:--|:--|:--|
| `memory` | Development, testing | ❌ |
| `prisma-pgvector` | Production (PostgreSQL) | ✅ |
| `pinecone` | Production (managed) | ✅ |

---

## Full-Text Search

For `.searchable()` fields:

```typescript
import { inMemoryTextSearch, buildPostgresSearchQuery } from "nevr"

// In-memory (development)
const results = inMemoryTextSearch(records, "password reset", ["title", "content"])

// PostgreSQL (production)
const { sql, values } = buildPostgresSearchQuery("password reset", ["title", "content"])
```

---

## API Reference

### createRAGEngine(config)

| Option | Type | Default | Description |
|:--|:--|:--|:--|
| `embedding.provider` | string | required | `"openai"`, `"cohere"`, or custom |
| `embedding.apiKey` | string | env var | API key for provider |
| `embedding.model` | string | auto | Model name |
| `vectorStore.type` | string | `"memory"` | Store type |
| `autoGenerate` | boolean | false | Auto-index on create/update |
| `maxTextLength` | number | 8000 | Truncate before embedding |

### RAGEngine Methods

| Method | Description |
|:--|:--|
| `generateEmbeddings(entity, id, data)` | Index a record |
| `deleteEmbeddings(entityName, id)` | Remove from index |
| `search(query, options)` | Semantic search |
