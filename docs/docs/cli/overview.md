# CLI Overview

The Nevr CLI is your primary tool for developing, managing the database, and generating code.

## Installation

The CLI is included with the `nevr` package. You typically run it via `npx`:

```bash
npx nevr <command> [options]
```

## Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Output the version number |
| `-h, --help` | Display help for command |

## Commands

### Development
- [`nevr dev`](/cli/development) - Start the development workflow (generate + push + dev server).

### Code Generation
- [`nevr generate`](/cli/generate) - Generate Prisma schema and client code from your entities.

### Database Management
- [`nevr db:push`](/cli/database#nevr-db-push) - Push schema changes to the database (prototyping).
- [`nevr db:migrate`](/cli/database#nevr-db-migrate) - Create specific migrations (production).
- [`nevr db:studio`](/cli/database#nevr-db-studio) - Open Prisma Studio GUI to view/edit data.
- [`nevr db:reset`](/cli/database#nevr-db-reset) - Reset the database (drop all data).

## Configuration

Most commands look for a `nevr.config.ts` (or `.js`, `.mjs`) file in your project root or `src/` folder.

```typescript
// nevr.config.ts
import { nevr } from "nevr"
import { user } from "./entities/user"
import { prisma } from "nevr/drivers/prisma"

// Export valid configuration
export default nevr({
  entities: [user],
  driver: prisma(db),
})
```

You can specify a custom config path with `-c` or `--config`:

```bash
npx nevr generate -c ./config/custom.ts
```
