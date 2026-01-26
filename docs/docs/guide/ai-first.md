# AI-First Development & Introspection

> Nevr is designed to be the native tongue of AI developers. This guide explains how to leverage Nevr's low-entropy architecture for AI-assisted development.

## Why Nevr is AI-Optimized

Traditional frameworks require thousands of lines for basic functionality. AI code generators struggle because:

- **High Entropy**: Too many ways to do the same thing
- **Context Limits**: AI can't hold the entire codebase in memory
- **Boilerplate Overload**: 80% of tokens wasted on plumbing

**Nevr solves this** with a declarative, schema-driven approach where a 50-line Entity replaces 2,000 lines of traditional code.

---

## Introspection: The Self-Aware Codebase

Nevr can generate a high-density context of your entire application that AI agents can understand in under 500 tokens.

### Generate Context

```typescript
import { generateContext, contextToMarkdown, contextToJSON } from "nevr"
import { api } from "./src"

// Generate full context object
const ctx = generateContext(api)

// Convert to AI-readable markdown
const markdown = contextToMarkdown(ctx)

// Convert to ultra-compact JSON
const json = contextToJSON(ctx)
```

### Convenience Wrapper

```typescript
import { generateContextString } from "nevr"

// Default: markdown format
const context = generateContextString(api)

// Compact JSON format
const compact = generateContextString(api, "json")
```

---

## Output Formats

### Markdown Format

Human and AI readable, includes all metadata:

```markdown
# APP CONTEXT (Nevr)

## Entities

### user
> Core authentication entity
- email (string) [required, searchable, unique]
- password (string) [omit] AI: "Never expose, hash with bcrypt"
- role (string) [options: admin, user] AI: "Check before admin ops"
→ posts (hasMany Post)

### post
> User-generated content
- title (string) [required, searchable]
- content (text) [embedding: openai]
→ author (belongsTo User, required)

## Plugins

### auth
Endpoints: signUp, signIn, signOut, getSession
Entities: user, session, account
```

### JSON Format (Ultra-Compact)

Minimal tokens for programmatic consumption:

```json
{
  "v": "1.0",
  "e": [
    {"n":"user","f":{"email":"s!SU","password":"s!X"},"r":["posts→post"]},
    {"n":"post","f":{"title":"s!S","content":"t!E"},"r":["author→user!"]}
  ],
  "p": [{"id":"auth","e":["signUp","signIn"]}]
}
```

**Legend:**
- `s` = string, `t` = text, `i` = int, `b` = boolean
- `!` = required, `?` = optional
- `S` = searchable, `E` = embedding, `X` = omit, `U` = unique

---

## AI Instructions

Add notes directly in your schema that are invisible to runtime but exported for AI:

### Field-Level Instructions

```typescript
const order = entity("order", {
  // AI sees: "Calculate from lineItems, never set directly"
  total: float.instruction("Calculate from lineItems, never set directly"),
  
  // AI sees: "Use workflow engine for status transitions"
  status: string
    .options(["pending", "paid", "shipped"])
    .instruction("Use workflow engine for status transitions"),
})
```

### Entity-Level Instructions

```typescript
const patient = entity("patient", {
  ssn: string.sensitive().instruction("HIPAA protected, encrypt at rest"),
  diagnosis: text.instruction("Medical terminology only"),
})
  .instruction("Healthcare entity - strict HIPAA compliance required")
```

---

## Rich Metadata for AI

Beyond instructions, these metadata methods provide AI context:

| Method | Purpose | AI Usage |
|:--|:--|:--|
| `.searchable()` | Mark for full-text search | AI knows searchable fields |
| `.embedding()` | Vector embedding for RAG | AI uses for semantic queries |
| `.sensitive()` | PII/GDPR compliance | AI handles carefully |
| `.label()` | Human-readable name | AI uses in UI generation |
| `.description()` | Detailed explanation | AI understands intent |
| `.options([])` | Allowed values | AI validates inputs |

### Example: Full Metadata

```typescript
const product = entity("product", {
  name: string
    .label("Product Name")
    .description("The official product title shown to customers")
    .searchable()
    .instruction("Keep under 100 chars for SEO"),

  description: text
    .label("Description")
    .embedding({ provider: "openai" })
    .instruction("Primary field for semantic search"),

  price: float
    .label("Price (USD)")
    .min(0)
    .instruction("Always positive, update via price_change action"),

  status: string
    .options(["draft", "active", "archived"])
    .instruction("Use archive action, don't delete products"),
})
```

---

## CLI Command

Generate context from the command line:

```bash
# Generate context.md (default)
npx nevr context

# Output compact JSON
npx nevr context --json

# Custom output path
npx nevr context -o .ai/context.md
```

---

## Best Practices

### 1. Add Instructions to Complex Fields

```typescript
// Good: AI understands the business logic
priority: int.instruction("1-5 scale, higher = more urgent")

// Bad: AI has to guess
priority: int
```

### 2. Document Entity Purpose

```typescript
// Good: Clear context for AI
entity("refund", {...})
  .instruction("Financial reversal - requires manager approval over $100")

// Bad: AI doesn't understand constraints
entity("refund", {...})
```

### 3. Use Semantic Metadata

```typescript
// AI can build search UI automatically
content: text.searchable().embedding({ provider: "openai" })
```

### 4. Mark Sensitive Data

```typescript
// AI knows to handle carefully
ssn: string.sensitive().instruction("Never log, always encrypt")
```

---

## The "Vibe Coding" Workflow

1. **Generate Context**: `npx nevr context > .ai/context.md`
2. **Feed to AI**: "Here's my app context. Add a comments feature to posts."
3. **AI Generates**: Perfect schema that integrates with existing entities
4. **Iterate**: AI maintains consistency because it understands the full schema

**Result**: Build industrial-scale apps with AI assistance without the prototype-to-production cliff.
