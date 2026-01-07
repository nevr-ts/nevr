# Database Commands

Manage your database schema and data directly from the CLI. These commands wrap the `prisma` CLI for convenience, ensuring they use your generated schema.

---

## nevr db:push

Push the state of your Prisma schema file(s) to the database without creating a migration file. Ideal for **prototyping** and local development.

```bash
npx nevr db:push [options]
```

### Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--schema <path>` | `-s` | `./prisma/schema.prisma` | Path to schema file. |
| `--accept-data-loss` | | `false` | Allow destructive changes (e.g., deleting columns). |

### Example

```bash
npx nevr db:push --accept-data-loss
```

---

## nevr db:migrate

Create a named migration file and apply it. Use this for **production** flows and CI/CD.

```bash
npx nevr db:migrate [options]
```

### Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--name <name>` | `-n` | `""` | Name of the migration. |
| `--schema <path>` | `-s` | `./prisma/schema.prisma` | Path to schema file. |

### Example

```bash
npx nevr db:migrate -n add_user_role
```

---

## nevr db:studio

Open Prisma Studio, a visual editor for your data.

```bash
npx nevr db:studio [options]
```

### Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--port <number>` | `-p` | `5555` | Port to run Studio on. |
| `--schema <path>` | `-s` | `./prisma/schema.prisma` | Path to schema file. |

### Example

```bash
npx nevr db:studio -p 3000
```

---

## nevr db:reset

Reset the database by dropping all data and re-applying the schema. **Destructive!**

```bash
npx nevr db:reset [options]
```

### Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--force` | `-f` | `false` | Skip confirmation prompt. |
| `--schema <path>` | `-s` | `./prisma/schema.prisma` | Path to schema file. |

### Example

```bash
npx nevr db:reset --force
```
