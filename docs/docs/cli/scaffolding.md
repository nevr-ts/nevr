# Project Scaffolding

Create new Nevr projects with `create-nevr` - a zero-config scaffolding tool.

## Quick Start

```bash
npm create nevr@latest
```

This launches an interactive wizard to configure your project.

## Non-Interactive Mode

For CI/CD or scripting, use flags to skip prompts:

```bash
npm create nevr@latest my-api --no-interactive
```

## CLI Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--template <name>` | `-t` | Framework: `express` or `hono` |
| `--database <db>` | `-d` | Database: `sqlite`, `postgresql`, `mysql` |
| `--auth` | | Include auth plugin |
| `--no-auth` | | Skip auth plugin |
| `--pm <manager>` | `-p` | Package manager: `npm`, `pnpm`, `bun` |
| `--no-install` | | Skip dependency installation |
| `--no-interactive` | | Use defaults, no prompts |
| `--help` | `-h` | Show help |
| `--version` | `-v` | Show version |

## Examples

### Next.js with MySQL 

```bash
npm create nevr@latest my-api -t nextjs -d mysql 
```
### Express with PostgreSQL and Auth

```bash
npm create nevr@latest my-api -t express -d postgresql --auth
```

### Hono with SQLite (minimal)

```bash
npm create nevr@latest my-api -t hono -d sqlite --no-auth
```
### Using pnpm, no install

```bash
npm create nevr@latest my-api -p pnpm --no-install
```

## Templates

### Next.js(Recommended)

Full-stack React framework with API routes.

**Generated structure:**
```
my-api/
├── app/
│   ├── api/
│   │   ├── health/route.ts     # Health check
│   │   └── [...nevr]/route.ts  # Nevr API handler
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── entities/               # Your data models
│   ├── plugins/                # Plugin configs
│   ├── nevr.ts                 # Nevr instance
│   └── nevr.config.ts          # Nevr configuration
├── middleware.ts               # Route protection
└── package.json
```
### Express 

Classic Node.js framework, battle-tested and widely adopted.

**Generated structure:**
```
my-api/
├── src/
│   ├── entities/
│   ├── nevr.config.ts
│   └── server.ts
├── prisma/
├── package.json
├── tsconfig.json
└── .env
```

### Hono

Ultrafast, lightweight, edge-ready framework.

Same structure as Express, but with Hono-specific `server.ts`.

## Database Options

| Database | Connection String |
|----------|------------------|
| SQLite | `file:./dev.db` |
| PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| MySQL | `mysql://user:pass@localhost:3306/db` |

## Auth Plugin

When `--auth` is enabled, the scaffolder adds:

- `src/plugins/auth.ts` - Auth plugin configuration
- `src/plugins/index.ts` - Plugin exports
- Auth-related environment variables

## After Scaffolding

```bash
cd my-api
npm run generate     # Generate Prisma schema
npm run db:push      # Create database
npm run dev          # Start development server
```

## Next Steps

- [CLI Overview](/cli/overview)
- [Getting Started](/get-started/quick-start)
- [Auth Plugin](/plugins/auth)
