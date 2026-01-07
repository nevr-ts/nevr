<h1 align="center">⚡ @nevr/cli</h1>

<p align="center">
  <strong>Command-line superpowers for Nevr development</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nevr/cli"><img src="https://img.shields.io/npm/v/@nevr/cli.svg?style=flat-square&color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@nevr/cli"><img src="https://img.shields.io/npm/dm/@nevr/cli.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/nevr-ts/nevr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license"></a>
</p>

---

## 🚀 Quick Start

```bash
# Generate schema and types
npx @nevr/cli generate

# Push to database
npx @nevr/cli db:push

# Start dev server with hot reload
npx @nevr/cli dev
```

---

## 📦 Installation

```bash
# Global (recommended for frequent use)
npm install -g @nevr/cli

# Or use directly with npx
npx @nevr/cli <command>
```

---

## 🎯 Commands

### `nevr generate`

Generate Prisma schema 

```bash
nevr generate [options]

Options:
  -c, --config <path>   Config file (default: ./nevr.config.ts)
  -o, --out <dir>       Output directory (default: ./prisma)
  -p, --provider <db>   Database: sqlite, postgresql, mysql (default: sqlite)

Examples:
  nevr generate
  nevr generate -p postgresql -o ./src/prisma
```

### `nevr db:push`

Push your schema to the database (development).

```bash
nevr db:push

# Creates tables without migration files
# ⚠️ May reset data - use db:migrate for production
```

### `nevr db:migrate`

Create a versioned migration (production-safe).

```bash
nevr db:migrate --name "add_posts_table"

# Creates migration file in prisma/migrations/
```

### `nevr db:studio`

Launch Prisma Studio to view/edit your data.

```bash
nevr db:studio

# Opens browser at http://localhost:5555
```

### `nevr db:reset`

Reset database to fresh state.

```bash
nevr db:reset

# ⚠️ Deletes all data
```

### `nevr dev`

Start development server with hot reload.

```bash
nevr dev [options]

Options:
  -p, --port <number>   Port (default: 3000)
  --host <ip>           Host (default: localhost)

Example:
  nevr dev -p 4000
```

---

## 📁 Generated Output

```
├── prisma/
│   └── schema.prisma    # Database schema
```

---

## ⚡ Workflow

```bash
# 1. Define entities in nevr.config.ts
# 2. Generate everything
nevr generate

# 3. Push to database
nevr db:push

# 4. Start coding
nevr dev
```

---

## 📚 Related

| Package | Description |
|---------|-------------|
| [`nevr`](https://npmjs.com/package/nevr) | Core framework |
| [`@nevr/generator`](https://npmjs.com/package/@nevr/generator) | Generator library |
| [`create-nevr`](https://npmjs.com/package/create-nevr) | Project scaffolder |

---

## 📄 License

[MIT](https://github.com/nevr-ts/nevr/blob/main/LICENSE) © Nevr Contributors
