# create-nevr

[![Beta](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/nevr-ts/nevr)

Scaffold a new [nevr](https://github.com/nevr-ts/nevr) project - Nevr write boilerplate again.

## Usage

```bash
npm create nevr@latest
# or
npx create-nevr
# or
pnpm create nevr
# or
bun create nevr
```

## What It Creates

The scaffolder creates a complete project structure:

```
my-api/
├── src/
│   ├── entities/           # Entity definitions
│   │   ├── user.ts
│   │   ├── post.ts
│   │   ├── comment.ts
│   │   └── index.ts
│   │
│   ├── hooks/              # Custom lifecycle hooks
│   ├── plugins/            # Custom plugins
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
│   │   └── schema.prisma   # Database schema
│   ├── types.ts            # TypeScript types
│   └── client.ts           # API client for frontend
│
├── package.json
├── tsconfig.json
├── .env
├── .gitignore
└── README.md
```

## Interactive Prompts

The scaffolder asks you:

1. **Project name** - Your project directory name
2. **Database** - SQLite, PostgreSQL, or MySQL
3. **Package manager** - npm, pnpm, or bun
4. **Install dependencies?** - Auto-install or skip

## After Scaffolding

```bash
cd my-api
npm run generate     # Generate Prisma schema
npm run db:push      # Create database tables
npm run dev          # Start development server
```

Your API is running at `http://localhost:3000/api` 🚀

## Generated Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users` | GET | List users |
| `/api/users` | POST | Create user |
| `/api/users/:id` | GET | Get user |
| `/api/users/:id` | PUT | Update user |
| `/api/users/:id` | DELETE | Delete user |
| `/api/posts` | GET | List posts |
| `/api/posts` | POST | Create post |
| `/api/posts/:id` | GET | Get post |
| `/api/posts/:id` | PUT | Update post |
| `/api/posts/:id` | DELETE | Delete post |

## Query Parameters

- `?filter[field]=value` - Filter by field
- `?sort=field` - Sort ascending
- `?sort=-field` - Sort descending
- `?limit=20&offset=0` - Pagination
- `?include=author` - Include relations

## Learn More

- [Nevr Documentation](https://github.com/nevr-ts/nevr)
- [Prisma Documentation](https://prisma.io/docs)

## License

MIT
