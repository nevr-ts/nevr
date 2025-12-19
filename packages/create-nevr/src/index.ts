#!/usr/bin/env node
// =============================================================================
// CREATE-NEVR
// Scaffold a new nevr project - Nevr write boilerplate again
// Usage: npm create nevr@latest
// =============================================================================

import prompts from "prompts"
import { mkdirSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"

// -----------------------------------------------------------------------------
// Templates
// -----------------------------------------------------------------------------

const templates = {
  "package.json": (name: string, db: string) => `{
  "name": "${name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "generate": "tsx src/generate.ts",
    "db:push": "prisma db push --schema=./generated/prisma/schema.prisma",
    "db:migrate": "prisma migrate dev --schema=./generated/prisma/schema.prisma",
    "db:studio": "prisma studio --schema=./generated/prisma/schema.prisma"
  },
  "dependencies": {
    "@prisma/client": "^5.7.0",
    "@nevr/generator": "^0.1.0",
    "nevr": "^0.1.0",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "prisma": "^5.7.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}`,

  "tsconfig.json": () => `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@entities/*": ["./src/entities/*"],
      "@generated/*": ["./generated/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "generated"]
}`,

  ".env": (db: string) => {
    if (db === "postgresql") {
      return `DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
PORT=3000`
    }
    if (db === "mysql") {
      return `DATABASE_URL="mysql://user:password@localhost:3306/mydb"
PORT=3000`
    }
    return `DATABASE_URL="file:./dev.db"
PORT=3000`
  },

  ".gitignore": () => `# Dependencies
node_modules

# Build
dist

# Environment
.env
.env.local

# Database
*.db
*.db-journal

# Generated (can be regenerated)
generated

# IDE
.vscode
.idea

# OS
.DS_Store`,

  // ==========================================================================
  // src/entities/
  // ==========================================================================

  "src/entities/user.ts": () => `import { entity, string, text, email } from "nevr"

export const user = entity("user", {
  email: email.unique(),
  name: string.min(1).max(100),
  bio: text.optional(),
  role: string.default("user"),
}).rules({
  create: ["everyone"],
  read: ["everyone"],
  list: ["everyone"],
  update: [({ user, resource }) => user?.id === resource?.id],
  delete: ["admin"],
})
`,

  "src/entities/post.ts": () => `import { entity, string, text, bool, belongsTo } from "nevr"
import { user } from "./user.js"

export const post = entity("post", {
  title: string.min(1).max(200),
  slug: string.unique().optional(),
  body: text,
  excerpt: text.optional(),
  published: bool.default(false),
  author: belongsTo(() => user),
}).ownedBy("author")
`,

  "src/entities/comment.ts": () => `import { entity, text, belongsTo } from "nevr"
import { user } from "./user.js"
import { post } from "./post.js"

export const comment = entity("comment", {
  body: text.min(1).max(2000),
  post: belongsTo(() => post).onDelete("cascade"),
  author: belongsTo(() => user),
}).ownedBy("author")
`,

  "src/entities/index.ts": () => `// =============================================================================
// ENTITY EXPORTS
// Add new entities here after creating them
// =============================================================================

export { user } from "./user.js"
export { post } from "./post.js"
export { comment } from "./comment.js"
`,

  // ==========================================================================
  // src/hooks/ (example)
  // ==========================================================================

  "src/hooks/.gitkeep": () => `# Custom lifecycle hooks go here
# Example: post.hooks.ts

# import type { Plugin } from "nevr"
#
# export const postHooks: Plugin = {
#   name: "post-hooks",
#   hooks: {
#     beforeCreate: async (ctx) => {
#       if (ctx.entity === "post") {
#         // Generate slug from title
#         const title = ctx.input.title as string
#         ctx.setInput({ slug: title.toLowerCase().replace(/\\s+/g, "-") })
#       }
#     }
#   }
# }
`,

  // ==========================================================================
  // src/plugins/ (example)
  // ==========================================================================

  "src/plugins/.gitkeep": () => `# Custom plugins go here
# Example: audit-log.ts

# import type { Plugin } from "nevr"
#
# export const auditLog: Plugin = {
#   name: "audit-log",
#   hooks: {
#     afterCreate: async (ctx) => {
#       console.log(\`[AUDIT] \${ctx.user?.id} created \${ctx.entity}\`)
#     },
#     afterUpdate: async (ctx) => {
#       console.log(\`[AUDIT] \${ctx.user?.id} updated \${ctx.entity}\`)
#     },
#     afterDelete: async (ctx) => {
#       console.log(\`[AUDIT] \${ctx.user?.id} deleted \${ctx.entity}\`)
#     }
#   }
# }
`,

  // ==========================================================================
  // src/routes/ (example)
  // ==========================================================================

  "src/routes/.gitkeep": () => `# Custom routes go here (non-CRUD endpoints)
# Example: auth.ts

# import type { Route } from "nevr"
#
# export const authRoutes: Route[] = [
#   {
#     method: "POST",
#     path: "/auth/login",
#     handler: async (req, zapi) => {
#       // Your login logic here
#       return { status: 200, body: { token: "..." } }
#     }
#   },
#   {
#     method: "POST",
#     path: "/auth/logout",
#     handler: async (req, zapi) => {
#       return { status: 200, body: { success: true } }
#     }
#   }
# ]
`,

  // ==========================================================================
  // src/middleware/ (example)
  // ==========================================================================

  "src/middleware/.gitkeep": () => `# Custom middleware go here
# Example: rate-limit.ts

# import type { Middleware } from "nevr"
#
# export const rateLimitMiddleware: Middleware = {
#   name: "rate-limit",
#   handler: async (ctx, next) => {
#     // Your rate limiting logic here
#     await next()
#   }
# }
`,

  // ==========================================================================
  // src/utils/ (example)
  // ==========================================================================

  "src/utils/.gitkeep": () => `# Utility functions go here
# Example: email.ts, validation.ts, etc.
`,

  // ==========================================================================
  // src/config.ts
  // ==========================================================================

  "src/config.ts": (db: string) => `// =============================================================================
// NEVR CONFIGURATION
// =============================================================================

import { user, post, comment } from "./entities/index.js"

// Import custom plugins (uncomment when created)
// import { auditLog } from "./plugins/audit-log.js"

// Import custom routes (uncomment when created)
// import { authRoutes } from "./routes/auth.js"

export const config = {
  // Database provider
  database: "${db}" as const,

  // Entities
  entities: [user, post, comment],

  // Plugins (uncomment to enable)
  plugins: [
    // auditLog,
  ],

  // Custom routes (uncomment to enable)
  routes: [
    // ...authRoutes,
  ],
}

export default config
`,

  // ==========================================================================
  // src/generate.ts
  // ==========================================================================

  "src/generate.ts": (db: string) => `// =============================================================================
// GENERATOR SCRIPT
// Run: npm run generate
// =============================================================================

import { generate } from "@nevr/generator"
import { config } from "./config.js"

generate(config.entities, {
  outDir: "./generated",
  prismaProvider: "${db}",
})
`,

  // ==========================================================================
  // src/index.ts
  // ==========================================================================

  "src/index.ts": () => `// =============================================================================
// NEVR SERVER
// =============================================================================

import express from "express"
import { PrismaClient } from "@prisma/client"
import { zapi } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter, expressDevAuth } from "nevr/adapters/express"
import { config } from "./config.js"

// -----------------------------------------------------------------------------
// Initialize
// -----------------------------------------------------------------------------

const db = new PrismaClient()

const api = zapi({
  entities: config.entities,
  driver: prisma(db),
  plugins: config.plugins,
})

// -----------------------------------------------------------------------------
// Express App
// -----------------------------------------------------------------------------

const app = express()
app.use(express.json())

// Health check (outside zapi)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Mount zapi API
app.use("/api", expressAdapter(api, {
  // Development: header-based auth (X-User-Id, X-User-Role)
  // Production: replace with your auth (Better Auth, JWT, etc.)
  getUser: expressDevAuth,
}))

// -----------------------------------------------------------------------------
// Start Server
// -----------------------------------------------------------------------------

const port = parseInt(process.env.PORT || "3000")

app.listen(port, () => {
  console.log(\`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 nevr server running!                                      ║
║                                                                ║
║   Local:      http://localhost:\${port}                           ║
║   API:        http://localhost:\${port}/api                       ║
║   Health:     http://localhost:\${port}/health                    ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║   CRUD Endpoints (auto-generated):                             ║
║   ────────────────────────────────────────────────────────     ║
║   GET     /api/users              List users                   ║
║   POST    /api/users              Create user                  ║
║   GET     /api/users/:id          Get user                     ║
║   PUT     /api/users/:id          Update user                  ║
║   DELETE  /api/users/:id          Delete user                  ║
║                                                                ║
║   GET     /api/posts              List posts                   ║
║   POST    /api/posts              Create post                  ║
║   GET     /api/posts/:id          Get post                     ║
║   PUT     /api/posts/:id          Update post                  ║
║   DELETE  /api/posts/:id          Delete post                  ║
║                                                                ║
║   GET     /api/comments           List comments                ║
║   POST    /api/comments           Create comment               ║
║   GET     /api/comments/:id       Get comment                  ║
║   PUT     /api/comments/:id       Update comment               ║
║   DELETE  /api/comments/:id       Delete comment               ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║   Query Parameters:                                            ║
║   ────────────────────────────────────────────────────────     ║
║   ?filter[field]=value      Filter by field                    ║
║   ?sort=field               Sort ascending                     ║
║   ?sort=-field              Sort descending                    ║
║   ?limit=20&offset=0        Pagination                         ║
║   ?include=author           Include relations                  ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║   Development Auth (headers):                                  ║
║   ────────────────────────────────────────────────────────     ║
║   X-User-Id: <user-id>      Required for authenticated routes  ║
║   X-User-Role: admin        Optional, for admin operations     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
\`)
})

// Graceful shutdown
process.on("SIGINT", async () => {
  await db.$disconnect()
  process.exit(0)
})
`,

  // ==========================================================================
  // README.md
  // ==========================================================================

  "README.md": (name: string) => `# ${name}

A REST API powered by [nevr](https://github.com/nevr-ts/nevr).

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Generate Prisma schema, types, and API client
npm run generate

# Create database tables
npm run db:push

# Start development server
npm run dev
\`\`\`

Your API is running at \`http://localhost:3000/api\` 🚀

## Project Structure

\`\`\`
${name}/
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
└── package.json
\`\`\`

## Adding a New Entity

1. Create \`src/entities/product.ts\`:

\`\`\`typescript
import { entity, string, int, float, belongsTo } from "nevr"
import { user } from "./user.js"

export const product = entity("product", {
  name: string.min(1).max(200),
  description: string.optional(),
  price: float.min(0),
  stock: int.default(0),
  seller: belongsTo(() => user),
}).ownedBy("seller")
\`\`\`

2. Export from \`src/entities/index.ts\`:

\`\`\`typescript
export { product } from "./product.js"
\`\`\`

3. Add to \`src/config.ts\`:

\`\`\`typescript
import { user, post, comment, product } from "./entities/index.js"

export const config = {
  entities: [user, post, comment, product],
  // ...
}
\`\`\`

4. Regenerate and update database:

\`\`\`bash
npm run generate
npm run db:push
\`\`\`

## Test with curl

\`\`\`bash
# Health check
curl http://localhost:3000/health

# Create a user
curl -X POST http://localhost:3000/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"email": "john@example.com", "name": "John"}'

# List users
curl http://localhost:3000/api/users

# Create a post (requires auth)
curl -X POST http://localhost:3000/api/posts \\
  -H "Content-Type: application/json" \\
  -H "X-User-Id: <user-id>" \\
  -d '{"title": "Hello World", "body": "My first post"}'

# List posts with filters
curl "http://localhost:3000/api/posts?filter[published]=true&sort=-createdAt&limit=10"

# Get post with author included
curl "http://localhost:3000/api/posts/<post-id>?include=author"

# Update post (owner only)
curl -X PUT http://localhost:3000/api/posts/<post-id> \\
  -H "Content-Type: application/json" \\
  -H "X-User-Id: <user-id>" \\
  -d '{"published": true}'

# Delete post (owner only)
curl -X DELETE http://localhost:3000/api/posts/<post-id> \\
  -H "X-User-Id: <user-id>"
\`\`\`

## Using the Generated Client

The generated \`client.ts\` provides a typed API client for your frontend:

\`\`\`typescript
import { createClient } from "./generated/client"

const api = createClient({
  baseUrl: "http://localhost:3000/api",
  headers: { "X-User-Id": "user-123" }
})

// Fully typed!
const posts = await api.posts.list({
  filter: { published: true },
  sort: "-createdAt",
  limit: 10
})

const post = await api.posts.create({
  title: "Hello",
  body: "World"
})
\`\`\`

## Scripts

| Script | Description |
|--------|-------------|
| \`npm run dev\` | Start development server with hot reload |
| \`npm run generate\` | Generate Prisma schema, types, and client |
| \`npm run db:push\` | Push schema to database (dev) |
| \`npm run db:migrate\` | Create migration (prod) |
| \`npm run db:studio\` | Open Prisma Studio |
| \`npm run build\` | Build for production |
| \`npm start\` | Start production server |

## Learn More

- [nevr Documentation](https://github.com/nevr-ts/nevr)
- [Prisma Documentation](https://www.prisma.io/docs)
`,
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ⚡ create-nevr                                            ║
║   Nevr write boilerplate again                             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`)

  const response = await prompts([
    {
      type: "text",
      name: "name",
      message: "Project name:",
      initial: "my-api",
      validate: (v) =>
        /^[a-z0-9-]+$/.test(v) || "Use lowercase letters, numbers, and hyphens",
    },
    {
      type: "select",
      name: "database",
      message: "Database:",
      choices: [
        { title: "SQLite (default, easy start)", value: "sqlite" },
        { title: "PostgreSQL", value: "postgresql" },
        { title: "MySQL", value: "mysql" },
      ],
    },
    {
      type: "select",
      name: "pm",
      message: "Package manager:",
      choices: [
        { title: "npm", value: "npm" },
        { title: "pnpm", value: "pnpm" },
        { title: "bun", value: "bun" },
      ],
    },
    {
      type: "confirm",
      name: "install",
      message: "Install dependencies?",
      initial: true,
    },
  ])

  if (!response.name) {
    console.log("Cancelled")
    process.exit(0)
  }

  const { name, database, pm, install } = response
  const dir = join(process.cwd(), name)

  // Check if directory exists
  if (existsSync(dir)) {
    console.error(`❌ Directory "${name}" already exists`)
    process.exit(1)
  }

  console.log(`\n📁 Creating ${name}...\n`)

  // Create directories
  const directories = [
    "src",
    "src/entities",
    "src/hooks",
    "src/plugins",
    "src/routes",
    "src/middleware",
    "src/utils",
    "generated",
  ]

  for (const d of directories) {
    mkdirSync(join(dir, d), { recursive: true })
  }

  // Write files
  const files: [string, string][] = [
    // Root files
    ["package.json", templates["package.json"](name, database)],
    ["tsconfig.json", templates["tsconfig.json"]()],
    [".env", templates[".env"](database)],
    [".gitignore", templates[".gitignore"]()],
    ["README.md", templates["README.md"](name)],

    // src/ files
    ["src/config.ts", (templates as any)["src/config.ts"](database)],
    ["src/generate.ts", (templates as any)["src/generate.ts"](database)],
    ["src/index.ts", templates["src/index.ts"]()],

    // src/entities/
    ["src/entities/user.ts", (templates as any)["src/entities/user.ts"]()],
    ["src/entities/post.ts", (templates as any)["src/entities/post.ts"]()],
    ["src/entities/comment.ts", (templates as any)["src/entities/comment.ts"]()],
    ["src/entities/index.ts", (templates as any)["src/entities/index.ts"]()],

    // Placeholder files with examples
    ["src/hooks/.gitkeep", (templates as any)["src/hooks/.gitkeep"]()],
    ["src/plugins/.gitkeep", (templates as any)["src/plugins/.gitkeep"]()],
    ["src/routes/.gitkeep", (templates as any)["src/routes/.gitkeep"]()],
    ["src/middleware/.gitkeep", (templates as any)["src/middleware/.gitkeep"]()],
    ["src/utils/.gitkeep", (templates as any)["src/utils/.gitkeep"]()],
  ]

  for (const [path, content] of files) {
    writeFileSync(join(dir, path), content)
    console.log(`   ✅ ${path}`)
  }

  // Install dependencies
  if (install) {
    console.log(`\n📦 Installing dependencies with ${pm}...\n`)

    const installCmd =
      pm === "npm"
        ? "npm install"
        : pm === "pnpm"
        ? "pnpm install"
        : "bun install"

    try {
      execSync(installCmd, { cwd: dir, stdio: "inherit" })
    } catch {
      console.log(`\n⚠️  Failed to install dependencies. Run manually:`)
      console.log(`   cd ${name} && ${installCmd}`)
    }
  }

  const padName = name.padEnd(48)

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ✅ Project created!                                      ║
║                                                            ║
║   Next steps:                                              ║
║                                                            ║
║   cd ${padName}║
║   npm run generate     # Generate Prisma schema            ║
║   npm run db:push      # Create database                   ║
║   npm run dev          # Start server                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`)
}

main().catch(console.error)
