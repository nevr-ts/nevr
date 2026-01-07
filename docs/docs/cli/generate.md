# nevr generate

Generates the Prisma schema and client artifacts from your entity definitions.

## Usage

```bash
npx nevr generate [options]
```

## Description

This command is the bridge between your `entity()` definitions and the underlying database driver (Prisma). It:

1. **Resolves** all your entities from the config file.
2. **Generates** a `schema.prisma` file.
3. **Splits** the schema if namespaces are used (and `splitSchema` is enabled).
4. **Caches** the result for faster subsequent runs.

> **Note:** Client types are automatically inferred via TypeScript and do not require file generation for the client itself, but the *database schema* must be generated.

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--config <path>` | `-c` | `./nevr.config.ts` | Path to your config file. |
| `--out <dir>` | `-o` | `./prisma` | Output directory for schema. |
| `--provider <name>` | `-p` | `sqlite` | Database provider (`sqlite`, `postgresql`, `mysql`). |
| `--force` | `-f` | `false` | Force full regeneration, ignoring cache. |
| `--no-cache` | | `false` | Disable incremental caching. |

## Examples

**Standard usage:**
```bash
npx nevr generate
```

**Use PostgreSQL:**
```bash
npx nevr generate -p postgresql
```

**Custom configuration:**
```bash
npx nevr generate -c ./src/config/nevr.ts
```

**Force rebuild (ignore cache):**
```bash
npx nevr generate --force
```

## Schema Splitting

For large projects, you can organize your schema into multiple files using **Namespaces**.

1. Define namespaces on entities:
   ```typescript
   const user = entity("user", { ... }).namespace("auth")
   const product = entity("product", { ... }).namespace("catalog")
   ```

2. Run generate:
   ```bash
   npx nevr generate
   ```

3. Output structure:
   ```
   prisma/
     schema/
       schema.prisma   (Header/Config)
       models.prisma   (Default namespace)
       auth.prisma     (Auth entities)
       catalog.prisma  (Catalog entities)
   ```

This uses Prisma's `prismaSchemaFolder` preview feature automatically.
