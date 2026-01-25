# CLI Overview

The Nevr CLI is your primary tool for developing, managing the database, and generating code.

## Installation

The CLI is included with the `nevr` package. Run it via `npx`:

```bash
npx nevr <command> [options]
```

## Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Output the version number |
| `-h, --help` | Display help for command |
| `-c, --config <path>` | Path to config file |

## Commands

### Development
- [`nevr dev`](/cli/development) - Start the development workflow (generate + push + dev server)

### Schema & Code Generation
- [`nevr generate`](/cli/generate) - Generate Prisma schema from entities
- [`nevr generate:entity`](/cli/generate) - Generate a new entity file
- [`nevr introspect`](/cli/introspect) - Show all entities (user + plugin)
- [`nevr openapi`](/cli/openapi) - Generate OpenAPI specification
- [`nevr context`](/cli/context) - Generate AI-optimized context

### Database Management
- [`nevr db:push`](/cli/database#nevr-dbpush) - Push schema to database (prototyping)
- [`nevr db:migrate`](/cli/database#nevr-dbmigrate) - Create migrations (production)
- [`nevr db:studio`](/cli/database#nevr-dbstudio) - Open Prisma Studio GUI
- [`nevr db:reset`](/cli/database#nevr-dbreset) - Reset database (drop all data)
- [`nevr db:generate`](/cli/database#nevr-dbgenerate) - Generate Prisma client

### Scaffolding
- [`create-nevr`](/cli/scaffolding) - Create a new Nevr project

## Quick Reference

```bash
# Development workflow
npx nevr dev                    # Generate + push + start server

# Generate schema
npx nevr generate               # Generate from nevr.config.ts
npx nevr g                      # Alias

# Generate entity file
npx nevr generate:entity post -f "title:string,body:text"
npx nevr g:e post               # Alias

# Introspect project
npx nevr introspect             # Show entities summary
npx nevr introspect --json      # JSON output

# Generate OpenAPI
npx nevr openapi                # Generate openapi.json
npx nevr openapi --format yaml  # Generate openapi.yaml

# Generate AI context
npx nevr context                # Output to stdout
npx nevr context -o CONTEXT.md  # Save to file

# Database commands
npx nevr db:push                # Push schema to database
npx nevr db:migrate --name init # Create migration
npx nevr db:studio              # Open Prisma Studio
npx nevr db:reset               # Reset database

# Scaffolding
npm create nevr@latest my-app   # Create new project
```

## Configuration

Most commands look for a `nevr.config.ts` (or `.js`, `.mjs`) file in your project root or `src/` folder.

```typescript
// nevr.config.ts
import { defineConfig } from "nevr"
import { user, post } from "./entities"
import { authPlugin } from "./plugins"

export default defineConfig({
  database: "sqlite",
  entities: [user, post],
  plugins: [authPlugin],
})
```

You can specify a custom config path with `-c` or `--config`:

```bash
npx nevr generate -c ./config/custom.ts
```

## Command Categories

| Category | Commands | Purpose |
|----------|----------|---------|
| **Development** | `dev` | Full development workflow |
| **Schema** | `generate`, `generate:entity` | Generate database schema |
| **Introspection** | `introspect`, `context` | Understand your project |
| **Documentation** | `openapi` | Generate API documentation |
| **Database** | `db:*` | Manage database state |
| **Scaffolding** | `create-nevr` | Bootstrap new projects |
