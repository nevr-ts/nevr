# create-nevr

> Scaffold a new [Nevr](https://github.com/nevr-ts/nevr) project in seconds — Nevr write boilerplate again

<p align="center">
  <a href="https://www.npmjs.com/package/create-nevr"><img src="https://img.shields.io/npm/v/create-nevr.svg?style=flat-square&color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/create-nevr"><img src="https://img.shields.io/npm/dm/create-nevr.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/nevr-ts/nevr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license"></a>
</p>

---

## 🚀 Quick Start

```bash
npm create nevr@latest
```

Or use your preferred package manager:

```bash
# npm
npm create nevr@latest

# pnpm
pnpm create nevr

# yarn
yarn create nevr

# bun
bun create nevr
```

## ✨ Interactive Setup

The scaffolder guides you through project setup:

```
┌  Create Nevr Project
│
◆  Project name?
│  my-api
│
◆  Which database?
│  ○ SQLite (default, no setup needed)
│  ○ PostgreSQL
│  ○ MySQL
│
◆  Package manager?
│  ○ npm
│  ○ pnpm
│  ○ bun
│
◆  Install dependencies?
│  ○ Yes
│  ○ No
│
└  Done! 🎉
```

## 📁 Project Structure

Creates a production-ready project structure:

```
my-api/
├── src/
│   ├── entities/           # Your entity definitions
│   │   └── index.ts        # Export your entities here
│   │
│   ├── hooks/              # Custom lifecycle hooks
│   ├── plugins/            # Plugin configurations
│   │   ├── auth.ts         # Better Auth setup
│   │   └── index.ts
│   ├── routes/             # Custom routes (non-CRUD)
│   ├── middleware/         # Custom middleware
│   ├── utils/              # Utility functions
│   │
│   ├── config.ts           # Nevr configuration
│   ├── generate.ts         # Generator script
│   └── index.ts            # Server entry point
│
├── generated/              # Auto-generated (don't edit)
│   ├── prisma/
│   │   └── schema.prisma
│   ├── types.ts
│   └── client.ts
│
├── package.json
├── tsconfig.json
├── .env                    # Environment variables
├── .gitignore
└── README.md
```

## 🎯 After Scaffolding

```bash
cd my-api

# 1. Generate Prisma schema from your entities
npm run generate

# 2. Create database tables
npm run db:push

# 3. Start development server
npm run dev
```

Your API is now running at **http://localhost:3000/api** 🚀

## 📖 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run generate` | Generate Prisma schema & types |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create migration |
| `npm run db:studio` | Open Prisma Studio |

## 🔐 Authentication

The scaffolded project includes [Better Auth](https://better-auth.com) pre-configured:

```typescript
// src/plugins/auth.ts
import { auth } from "nevr/plugins/auth"

export const authPlugin = auth({
  mode: "session",
  emailAndPassword: true,
  // Uncomment for OAuth:
  // providers: {
  //   google: { clientId: "...", clientSecret: "..." },
  //   github: { clientId: "...", clientSecret: "..." },
  // },
})
```

**Auth endpoints (auto-mounted):**
- `POST /api/auth/sign-up` — Create account
- `POST /api/auth/sign-in` — Sign in
- `POST /api/auth/sign-out` — Sign out
- `GET /api/auth/session` — Get current session

## ➕ Adding Entities

Create your entities in `src/entities/`:

```typescript
// src/entities/post.ts
import { entity, string, text, bool, belongsTo } from "nevr"
import { authUser } from "nevr/plugins/auth"

export const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  published: bool.default(false),
  author: belongsTo(authUser),  // Reference auth plugin's user
})
  .ownedBy("author")
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner"],
    delete: ["owner", "admin"],
  })
  .build()
```

Then export it:

```typescript
// src/entities/index.ts
export { post } from "./post.js"
```

And add to config:

```typescript
// src/config.ts
import { post } from "./entities/index.js"

export default {
  entities: [post],
  // ...
}
```

Regenerate and push:

```bash
npm run generate
npm run db:push
```

## 🔍 Query API

All entity endpoints support powerful querying:

```bash
# Filtering
GET /api/posts?filter[published]=true

# Sorting
GET /api/posts?sort=-createdAt     # Descending

# Pagination
GET /api/posts?limit=20&offset=0

# Include relations
GET /api/posts?include=author
```

## 🌐 Environment Variables

Configure in `.env`:

```env
# Database
DATABASE_URL="file:./dev.db"       # SQLite
# DATABASE_URL="postgresql://..."   # PostgreSQL
# DATABASE_URL="mysql://..."        # MySQL

# Server
PORT=3000

# Auth (Better Auth)
BETTER_AUTH_SECRET="your-secret-here"
BETTER_AUTH_URL="http://localhost:3000"

# OAuth (optional)
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# GITHUB_CLIENT_ID=""
# GITHUB_CLIENT_SECRET=""
```

## 📚 Related Packages

| Package | Description |
|---------|-------------|
| [`nevr`](https://www.npmjs.com/package/nevr) | Core framework |
| [`@nevr/cli`](https://www.npmjs.com/package/@nevr/cli) | CLI for schema generation |
| [`@nevr/generator`](https://www.npmjs.com/package/@nevr/generator) | Generator library |

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](https://github.com/nevr-ts/nevr/blob/main/CONTRIBUTING.md).

## 📄 License

[MIT](https://github.com/nevr-ts/nevr/blob/main/LICENSE) © Nevr Contributors
- [Prisma Documentation](https://prisma.io/docs)

## License

MIT
