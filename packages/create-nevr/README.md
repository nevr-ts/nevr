<h1 align="center">⚡ create-nevr</h1>

<p align="center">
  <strong>Scaffold a production-ready Nevr project in seconds</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-nevr"><img src="https://img.shields.io/npm/v/create-nevr.svg?style=flat-square&color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/create-nevr"><img src="https://img.shields.io/npm/dm/create-nevr.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/nevr-ts/nevr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license"></a>
</p>

---

## 🚀 Create Your Project

```bash
npm create nevr@latest
```

That's it. The wizard guides you through setup.

---

## ⚡ One-Liner (Non-Interactive)

```bash
npm create nevr@latest my-api -t express -d postgresql --auth --no-interactive
```

---

## 🎯 CLI Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--template <name>` | `-t` | `express` or `hono` |
| `--database <db>` | `-d` | `sqlite`, `postgresql`, `mysql` |
| `--auth` | | Include authentication |
| `--no-auth` | | Skip authentication |
| `--pm <manager>` | `-p` | `npm`, `pnpm`, or `bun` |
| `--no-install` | | Skip dependency installation |
| `--no-interactive` | | Use defaults, no prompts |

---

## 📁 What You Get

```
my-api/
├── src/
│   ├── entities/          # Your domain models
│   ├── plugins/           # Plugin configurations
│   ├── nevr.config.ts     # Main configuration
│   └── server.ts          # Entry point
├── prisma/                # Database schema
├── package.json
├── tsconfig.json
└── .env
```

---

## 🎬 After Creation

```bash
cd my-api

# Generate Prisma schema
npm run generate

# Create database tables
npm run db:push

# Start development
npm run dev
```

**Your API is live at http://localhost:3000/api** 🎉

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Production build |
| `npm run generate` | Generate schema & types |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create migration |
| `npm run db:studio` | Open Prisma Studio |

---

## 🔐 Authentication (Optional)

When `--auth` is enabled, you get:

```typescript
// Endpoints auto-mounted at /api/auth/*
POST /api/auth/sign-up
POST /api/auth/sign-in
POST /api/auth/sign-out
GET  /api/auth/session
```

Configure OAuth in `src/plugins/auth.ts`:

```typescript
auth({
  emailAndPassword: true,
  socialProviders: {
    google: { clientId: "...", clientSecret: "..." },
    github: { clientId: "...", clientSecret: "..." },
  },
})
```

---

## 🌐 Templates

### NextJs
Full-featured React framework. Ideal for SSR and SSG.

### Express 

Battle-tested Node.js framework. Great for most projects.

### Hono

Ultrafast, edge-ready. Perfect for Cloudflare Workers, Vercel Edge.

---

## 📊 Databases

| Database | When to use |
|----------|-------------|
| **SQLite** | Development, small projects, embedded |
| **PostgreSQL** | Production, complex queries, scale |
| **MySQL** | Production, existing MySQL infrastructure |

---

## 📚 Related

| Package | Description |
|---------|-------------|
| [`nevr`](https://npmjs.com/package/nevr) | Core framework |

---

## 📄 License

[MIT](https://github.com/nevr-ts/nevr/blob/main/LICENSE) © Nevr Contributors

---

<p align="center">
  <strong>Nevr write boilerplate again.</strong>
</p>
