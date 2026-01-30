# RAG (Retrieval-Augmented Generation)

> Nevr is the first entity-first framework with built-in RAG support. This guide covers semantic search, embedding generation, hybrid search, and production deployment.

## Why RAG in Nevr?

### The Problem

Traditional keyword search fails when users ask questions naturally:

| User Query | Keyword Search | Semantic Search |
|:--|:--|:--|
| "how do I change my password?" | No results (no "change" in docs) | Finds "Password Reset Guide" |
| "refund policy" | Exact match only | Also finds "return policy", "money back" |
| "why is my order late?" | Misses context | Finds shipping delay articles |

### The Solution

RAG combines:
1. **Vector Embeddings**: Convert text to mathematical representations that capture meaning
2. **Semantic Search**: Find content by meaning, not just keywords
3. **Full-Text Search**: Fast keyword matching for exact terms
4. **Hybrid Search**: Best of both worlds using score fusion

---

## Quick Start

### 1. Define Entities with Semantic Fields

```typescript
// src/entities/article.ts
import { entity, string, text } from "nevr"

export const article = entity("article", {
  title: string.searchable(),                           // Full-text search
  content: text.embedding({ provider: "openai" }),      // Vector search
  summary: text.embedding().instruction("For quick Q&A"),
})
```

```typescript
// src/entities/ticket.ts
import { entity, string, text } from "nevr"

export const ticket = entity("ticket", {
  subject: string.searchable(),
  description: text.embedding({ provider: "openai" }),
  resolution: text.embedding().searchable(),  // Both vector AND text search
})
```

### 2. Add RAG Plugin

Add entities and the RAG plugin to your config:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { rag } from "nevr/plugins"
import { article, ticket } from "./entities/index.js"

export const config = defineConfig({
  database: "postgresql",
  entities: [article, ticket],
  plugins: [
    rag({
      embedding: { provider: "openai" },
      vectorStore: { type: "memory" },  // Use prisma-pgvector for production
      autoGenerate: true,               // Auto-index on create/update
      hybridSearch: true,               // Enable vector + text fusion
    }),
  ],
})

export default config
```

Then in your server:

```typescript
// src/server.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
```

### 3. Search

```typescript
// Auto-indexed on create (because autoGenerate: true)
await api.article.create({
  title: "Password Reset Guide",
  content: "To reset your password, click the forgot password link...",
})

// Semantic search
const results = await api.rag.search("how do I change my password?", {
  entities: ["article"],
  limit: 5,
})
// Returns: [{ id: "article:123:content", score: 0.92, metadata: {...} }]
```

---

## RAG Plugin Options

```typescript
rag({
  // Required: Embedding provider configuration
  embedding: {
    provider: "openai",           // "openai" | "cohere" | custom
    model: "text-embedding-3-small",  // Optional: specific model
    apiKey: process.env.OPENAI_API_KEY,  // Optional: defaults to env var
  },

  // Vector store (where embeddings are stored)
  vectorStore: {
    type: "memory",               // "memory" | "prisma-pgvector"
    // For prisma-pgvector:
    // connection: { prisma, tableName: "nevr_vectors", dimensions: 1536 }
  },

  // Automatic embedding generation
  autoGenerate: true,             // Generate on create/update/delete

  // Hybrid search (vector + full-text fusion)
  hybridSearch: true,             // Enable hybrid mode
  vectorWeight: 0.7,              // Weight for vector results (0-1)
  textWeight: 0.3,                // Weight for text results (0-1)

  // Exclusions
  excludeEntities: ["user", "session"],  // Skip auth entities

  // Debugging
  debug: false,                   // Enable verbose logging
})
```

---

## Search Modes

### Vector Search (Default)

Finds semantically similar content using embeddings:

```typescript
const results = await api.rag.search("customer complaints about shipping", {
  mode: "vector",
  entities: ["ticket"],
  limit: 10,
  minScore: 0.7,  // Only results with 70%+ similarity
})
```

**Best for:**
- Natural language questions
- Finding related content
- Multilingual search (same meaning, different words)

### Text Search

Traditional full-text search on `.searchable()` fields:

```typescript
const results = await api.rag.search("order #12345", {
  mode: "text",
  entities: ["ticket"],
  entityData: new Map([["ticket", await api.ticket.findMany()]]),
})
```

**Best for:**
- Exact matches (order numbers, IDs, names)
- Boolean queries
- When you know the exact terms

### Hybrid Search (Recommended)

Combines vector and text search using Reciprocal Rank Fusion (RRF):

```typescript
const results = await api.rag.search("refund request order 12345", {
  mode: "hybrid",
  entities: ["ticket"],
  entityData: new Map([["ticket", await api.ticket.findMany()]]),
  vectorWeight: 0.7,  // 70% weight to semantic similarity
  textWeight: 0.3,    // 30% weight to keyword matches
})
```

**Why Hybrid?**
- Semantic: "refund request" matches "return policy", "money back guarantee"
- Keyword: "order 12345" matches exact order number
- Combined: Best of both worlds

---

## Embedding Providers

### OpenAI (Recommended)

```typescript
embedding: {
  provider: "openai",
  model: "text-embedding-3-small",  // 1536 dimensions, fast, cheap
  // or: "text-embedding-3-large"   // 3072 dimensions, more accurate
}
```

Environment variable: `OPENAI_API_KEY`

### Cohere

```typescript
embedding: {
  provider: "cohere",
  model: "embed-english-v3.0",  // 1024 dimensions
}
```

Environment variable: `COHERE_API_KEY`

### Custom Provider

```typescript
import { registerProvider, BaseEmbeddingProvider } from "nevr/rag"

class MyEmbeddingProvider extends BaseEmbeddingProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    // Your implementation
  }
}

registerProvider("my-provider", MyEmbeddingProvider)
```

---

## Vector Stores

### In-Memory (Development)

```typescript
vectorStore: { type: "memory" }
```

- No persistence (data lost on restart)
- Fast for development and testing
- Limited to ~10,000 vectors

### Prisma pgvector (Production)

PostgreSQL with the pgvector extension:

```typescript
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

vectorStore: {
  type: "prisma-pgvector",
  connection: {
    prisma,
    tableName: "nevr_vectors",     // Default table name
    schema: "public",               // Database schema
    dimensions: 1536,               // Must match embedding model
    indexType: "hnsw",              // "hnsw" (faster) or "ivfflat" (smaller)
  },
}
```

**Setup PostgreSQL:**

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table is auto-created by the store, but you can create manually:
CREATE TABLE nevr_vectors (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL DEFAULT 'default',
  vector vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX ON nevr_vectors USING hnsw (vector vector_cosine_ops);
```

---

## API Reference

### Plugin Methods

```typescript
// Available on api.rag
const ragActions = api.rag

// Semantic/hybrid search
await ragActions.search(query, options)

// Manual embedding generation
await ragActions.generateEmbeddings(entityName, recordId, data)

// Delete embeddings
await ragActions.deleteEmbeddings(entityName, recordId)

// Bulk index all records
await ragActions.indexEntity(entityName, records)

// Clear all embeddings for an entity
await ragActions.clearEntity(entityName)

// Access underlying engines
ragActions.getEngine()        // RAGEngine
ragActions.getHybridEngine()  // HybridSearchEngine
```

### Search Options

```typescript
interface HybridSearchOptions {
  // Search mode
  mode?: "vector" | "text" | "hybrid"

  // Filtering
  entities?: string[]           // Filter by entity names
  limit?: number                // Max results (default: 10)
  minScore?: number             // Minimum similarity (0-1)

  // Hybrid weights (override plugin defaults)
  vectorWeight?: number         // 0-1
  textWeight?: number           // 0-1

  // For text/hybrid mode
  entityData?: Map<string, Array<{ id: string } & Record<string, unknown>>>
}
```

### Search Results

```typescript
interface HybridSearchResult {
  id: string                    // "entity:recordId:field"
  score: number                 // Overall similarity (0-1)
  metadata: {
    entity: string              // Entity name
    field: string               // Field name
    recordId: string            // Database record ID
    text?: string               // Snippet of original text
  }

  // Detailed scores
  vectorScore?: number          // Vector similarity
  textScore?: number            // Text match score
  hybridScore?: number          // Combined RRF score

  // Source tracking
  source: "vector" | "text" | "both"
}
```

---

## Client Plugin (Frontend)

RAG can be accessed from the frontend using the client plugin:

### Setup

```typescript
import { createClient } from "nevr/client"
import { ragClient } from "nevr/plugins/rag/client"
import type { API } from "./api"

// Use curried pattern for full type inference
const client = createClient<API>()({
  baseURL: "/api",
  plugins: [ragClient()],
})
```

### Search from Frontend

```typescript
// 1 line search!
const { data, error } = await client.rag.search({
  query: "how to reset password",
  entities: ["article", "faq"],
  limit: 10,
})

// Access results
data?.results.forEach(result => {
  console.log(result.metadata.entity, result.score)
})
```

### Bulk Index

```typescript
// Fetch records and index them
const articles = await client.article.list()
const { indexed, errors } = await client.rag.index({
  entity: "article",
  records: articles,
})
```

### Get Stats

```typescript
const stats = await client.rag.stats()
// { totalVectors: 1500, byEntity: { article: { count: 500 }, ... } }
```

### Reactive State (Nanostores)

```typescript
import { useStore } from "@nanostores/react"

function SearchResults() {
  const { query, results, isLoading, error } = useStore(client.$atoms.search)

  if (isLoading) return <Loading />
  
  return (
    <div>
      <p>Results for: {query}</p>
      {results.map(r => (
        <div key={r.id}>{r.metadata.text}</div>
      ))}
    </div>
  )
}
```

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rag/search` | POST | Semantic/hybrid search |
| `/rag/index` | POST | Bulk index records |
| `/rag/stats` | GET | Get indexing stats |
| `/rag/clear` | DELETE | Clear entity embeddings |

---

## Standalone RAG Engine

Use RAG without the plugin for more control:

```typescript
import { createRAGEngine } from "nevr/rag"

const engine = createRAGEngine({
  embedding: { provider: "openai" },
  vectorStore: { type: "memory" },
})

// Generate embeddings
await engine.generateEmbeddings(articleEntity, "123", {
  title: "Password Reset Guide",
  content: "To reset your password...",
})

// Search
const results = await engine.search("how to reset password", {
  entities: ["article"],
  limit: 5,
})

// Delete
await engine.deleteEmbeddings("article", "123")
```

---

## Full-Text Search Utilities

For `.searchable()` fields without vector search:

```typescript
import {
  inMemoryTextSearch,
  buildPostgresSearchQuery,
  buildSqliteSearchQuery,
  highlightMatches,
  extractSnippets,
} from "nevr/rag"

// In-memory search (development)
const results = inMemoryTextSearch(records, "password reset", ["title", "content"], {
  limit: 10,
  fuzzy: 0.8,  // Allow fuzzy matching
})

// PostgreSQL full-text (production)
const { sql, values } = buildPostgresSearchQuery("password reset", ["title", "content"])
// sql: "to_tsvector('english', ...) @@ to_tsquery('english', $1)"

// Highlight matches in results
const highlighted = highlightMatches(text, "password", { tag: "mark" })
// "To reset your <mark>password</mark>..."

// Extract snippets around matches
const snippets = extractSnippets(longText, "password", { contextWords: 5 })
// ["...click the forgot password link..."]
```

---

## Best Practices

### 1. Choose the Right Fields

```typescript
const product = entity("product", {
  // Searchable: exact matches, filters
  sku: string.searchable(),           // "SKU-12345"
  name: string.searchable(),          // Filter by name

  // Embedding: semantic understanding
  description: text.embedding(),      // "This comfortable chair..."

  // Both: hybrid search
  title: string.searchable().embedding(),
})
```

### 2. Use Entity-Level Instructions

```typescript
const faq = entity("faq", {
  question: text.embedding().instruction("User's natural language question"),
  answer: text.embedding().instruction("Detailed answer for RAG retrieval"),
})
  .instruction("Knowledge base for AI assistant - prioritize recent entries")
```

### 3. Exclude System Entities

```typescript
rag({
  excludeEntities: ["user", "session", "account", "verification"],
  // Don't waste tokens embedding auth data
})
```

### 4. Tune Hybrid Weights

```typescript
// Customer support: prioritize semantic understanding
rag({ vectorWeight: 0.8, textWeight: 0.2 })

// E-commerce: balance semantic + exact product names
rag({ vectorWeight: 0.6, textWeight: 0.4 })

// Documentation: prioritize exact terms
rag({ vectorWeight: 0.4, textWeight: 0.6 })
```

### 5. Handle Large Datasets

```typescript
// Bulk index existing data
const allArticles = await api.article.findMany()
const { indexed, errors } = await api.rag.indexEntity("article", allArticles)
console.log(`Indexed ${indexed} articles, ${errors} errors`)

// Clear and rebuild
await api.rag.clearEntity("article")
await api.rag.indexEntity("article", allArticles)
```

---

## Production Checklist

- [ ] Use `prisma-pgvector` instead of `memory` store
- [ ] Set `OPENAI_API_KEY` (or provider key) in environment
- [ ] Add `excludeEntities` for auth/system entities
- [ ] Run initial `indexEntity()` for existing data
- [ ] Monitor embedding costs (OpenAI charges per token)
- [ ] Add error handling for API failures
- [ ] Consider caching frequently searched queries
