# nevr context

Generate AI-optimized context from your Nevr application.

## Usage

```bash
npx nevr context [options]
```

## Description

This command generates a compact, AI-readable representation of your application's:

1. **Entities** - Names, fields, types, and constraints
2. **Relations** - How entities connect to each other
3. **Plugins** - Installed plugins and their endpoints
4. **Extensions** - Plugin fields added to other entities (e.g., username → user)
5. **Actions** - Custom entity actions
6. **Access Rules** - Who can do what
7. **Semantic Fields** - Searchable and embedding fields

The output is optimized for AI consumption, making it ideal for:
- AI coding assistants (Claude, Copilot)
- Documentation generation
- Codebase analysis
- AI-powered features

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--config <path>` | `-c` | `./nevr.config.ts` | Path to your config file |
| `--output <path>` | `-o` | `context.md` | Output file path |
| `--format <fmt>` | | `markdown` | Output format: `markdown` or `json` |
| `--json` | | `false` | Shorthand for `--format json` |

## Examples

**Generate context.md (default):**
```bash
npx nevr context
```

**Custom output path:**
```bash
npx nevr context -o ./docs/ai-context.md
```

**Compact JSON format:**
```bash
npx nevr context --json
```

**JSON to file:**
```bash
npx nevr context --format json -o ./context.json
```

## Output Formats

### Markdown (Default)

Human-readable format optimized for AI assistants:

```markdown
# APP CONTEXT (Nevr)

Generated: 2024-01-15T10:30:00.000Z

## Entities

### user
- email (string) [required, unique]
- name (string) [required]
- role (string) [options:[admin,user]]

### post
- title (string) [required]
- body (text) [required, searchable]
- published (boolean)
→ author (belongsTo user, required)

Actions: publish, archive
Rules: list:[everyone] create:[authenticated] update:[owner]

## Plugins

### auth
Endpoints: signUpEmail, signInEmail, signOut, getSession
Entities: user, session, account

## Extensions (Plugin → Entity)

- **auth** → user: username, displayUsername
- **payment** → user: stripeCustomerId
- **organization** → session: activeOrganizationId, activeTeamId

## Searchable Fields
post.body, post.title

## Embeddings (RAG)
- post.body → openai/1536dim
```

### JSON (Compact)

Minimal format for machine parsing:

```json
{"v":"1.0.0","t":"2024-01-15T10:30:00.000Z","e":[{"n":"user","f":{"email":"s!U","name":"s!"},"r":[]},{"n":"post","f":{"title":"s!","body":"t!S","published":"b?"},"r":["author→user!"]}],"p":[{"id":"auth","e":["sign-up","sign-in"]}]}
```

**Field encoding:**
- `s` = string, `t` = text, `i` = int, `b` = boolean
- `!` = required, `?` = optional
- `S` = searchable, `E` = embedding, `U` = unique, `X` = sensitive

## Use Cases

### AI Coding Assistant

Add context to your project for AI assistants:

```bash
# Generate context file
npx nevr context -o ./CONTEXT.md

# Add to .cursorrules or similar
echo "See CONTEXT.md for application schema" >> .cursorrules
```

### Documentation Generation

Use as input for doc generators:

```bash
npx nevr context -o ./docs/schema.md
```

### RAG Integration

Generate context for vector search:

```typescript
import { exec } from "child_process"

// Get context as string
const context = execSync("npx nevr context").toString()

// Store in vector database
await vectorStore.upsert({
  id: "app-context",
  content: context,
  metadata: { type: "schema" },
})
```

### CI/CD Integration

Keep context updated automatically:

```yaml
# .github/workflows/docs.yml
- name: Generate Context
  run: npx nevr context -o ./docs/CONTEXT.md

- name: Commit if changed
  run: |
    git add docs/CONTEXT.md
    git diff --staged --quiet || git commit -m "docs: update context"
```

## Programmatic API

For more control, use the programmatic API:

```typescript
import { generateContext, contextToMarkdown } from "nevr"
import { api } from "./src"

// Generate context object
const ctx = generateContext(api)

// Convert to formats
const markdown = contextToMarkdown(ctx)
const json = contextToJSON(ctx)

// Access data directly
console.log(ctx.entities)
console.log(ctx.plugins)
console.log(ctx.searchable)
console.log(ctx.embeddings)
```

## See Also


- [RAG](/guide/rag) - Retrieval-Augmented Generation
- [nevr introspect](/cli/introspect) - Show entities summary
