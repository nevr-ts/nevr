// =============================================================================
// NEXT.JS TEMPLATE
// Next.js App Router server template
// =============================================================================

export const nextjsTemplates = {
  "package.json": (name: string, db: string, withAuth: boolean) => `{
  "name": "${name}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "generate": "nevr generate",
    "db:push": "nevr db:push",
    "db:migrate": "nevr db:migrate",
    "db:studio": "nevr db:studio"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "nevr": "^0.5.2",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "prisma": "^5.22.0",
    "typescript": "^5.7.0"
  }
}`,

  "tsconfig.json": () => `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,

  "next.config.ts": () => `import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
}

export default nextConfig
`,

  "app/layout.tsx": (name: string) => `import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "${name}",
  description: "Powered by Nevr",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,

  "app/page.tsx": (name: string) => `export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>${name}</h1>
      <p>API powered by <a href="https://github.com/nevr-ts/nevr">Nevr</a></p>

      <h2>Endpoints</h2>
      <ul>
        <li><code>GET /api/health</code> - Health check</li>
        <li><code>GET /api/[entity]</code> - List entities</li>
        <li><code>POST /api/[entity]</code> - Create entity</li>
        <li><code>GET /api/[entity]/[id]</code> - Get entity</li>
        <li><code>PUT /api/[entity]/[id]</code> - Update entity</li>
        <li><code>DELETE /api/[entity]/[id]</code> - Delete entity</li>
      </ul>

      <h2>Quick Start</h2>
      <ol>
        <li>Define entities in <code>lib/entities/</code></li>
        <li>Run <code>npm run generate</code></li>
        <li>Run <code>npm run db:push</code></li>
        <li>Start using your API!</li>
      </ol>
    </main>
  )
}
`,

  "app/api/health/route.ts": () => `import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
}
`,

  "app/api/[...nevr]/route.ts": (withAuth: boolean) => `// =============================================================================
// NEVR API HANDLER
// Catch-all route for Nevr API endpoints
// =============================================================================

import { toNextHandler${withAuth ? ", sessionAuth" : ""} } from "nevr/adapters/nextjs"
import { api } from "@/lib/nevr"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api, {
  debugLogs: process.env.NODE_ENV !== "production",${withAuth ? `
  getUser: sessionAuth(api),` : ""}
})
`,

  "lib/nevr.ts": (withAuth: boolean) => `// =============================================================================
// NEVR INSTANCE
// =============================================================================

import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
${withAuth ? `import { nextCookies } from "nevr/adapters/nextjs"` : ""}
import { config } from "./nevr.config"

const db = new PrismaClient()
const driver = prisma(db)

export const api = nevr({
  ...config,
  driver,${withAuth ? `
  plugins: [...(config.plugins ?? []), nextCookies()],` : ""}
})
`,

  "lib/nevr.config.ts": (db: string, withAuth: boolean) => `// =============================================================================
// NEVR CONFIG
// Run: npm run generate
// =============================================================================

import { defineConfig } from "nevr"
import * as entities from "./entities"
${withAuth ? `import { authPlugin } from "./plugins"\n` : ""}
export const config = defineConfig({
  database: "${db}",
  entities: Object.values(entities).filter(e => e && typeof e === "object"),
  plugins: [${withAuth ? "authPlugin" : ""}],
})

export default config
`,

  "lib/entities/index.ts": () => `// =============================================================================
// ENTITIES
// Add your entities here
// =============================================================================

// Example:
// export { post } from "./post"
`,

  "lib/plugins/index.ts": () => `// =============================================================================
// PLUGINS
// =============================================================================

export { authPlugin } from "./auth"
`,

  "lib/plugins/auth.ts": () => `// =============================================================================
// AUTH PLUGIN
// =============================================================================

import { auth } from "nevr/plugins/auth"

export const authPlugin = auth({
  // Secret is auto-read from NEVR_AUTH_SECRET env variable
  emailAndPassword: {
    enabled: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // 1 day
  },
})
`,

  "middleware.ts": (withAuth: boolean) => withAuth ? `// =============================================================================
// NEXT.JS MIDDLEWARE
// Protects routes that require authentication
// =============================================================================

import { withNevrMiddleware } from "nevr/adapters/nextjs"

export default withNevrMiddleware({
  // Routes that require authentication
  protectedRoutes: [
    "/dashboard",
    "/dashboard/*",
    "/api/users/*",
  ],

  // Routes that are always public
  publicRoutes: [
    "/",
    "/login",
    "/register",
    "/api/health",
    "/api/auth/*",
  ],

  // Where to redirect unauthenticated users
  loginPath: "/login",
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
` : `// Middleware file - add route protection here if needed
export { }
`,

  ".env.local": (db: string, withAuth: boolean) => {
    const authSecret = Array.from({ length: 4 }, () => Math.random().toString(36).substring(2)).join("")
    const authEnv = withAuth ? `\n# Auth Plugin (min 32 characters)\nNEVR_AUTH_SECRET="${authSecret}"` : ""

    const dbUrls: Record<string, string> = {
      postgresql: 'DATABASE_URL="postgresql://user:password@localhost:5432/mydb"',
      mysql: 'DATABASE_URL="mysql://user:password@localhost:3306/mydb"',
      sqlite: 'DATABASE_URL="file:./dev.db"',
    }

    return `# Database
${dbUrls[db] || dbUrls.sqlite}
${authEnv}`
  },

  ".gitignore": () => `# Dependencies
node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env

# Database
*.db
*.db-journal
prisma/migrations

# Vercel
.vercel

# Typescript
*.tsbuildinfo
next-env.d.ts

# Cache
.nevr-cache.json`,

  "README.md": (name: string) => `# ${name}

Full-stack app powered by [Nevr](https://github.com/nevr-ts/nevr) + Next.js.

## Quick Start

\`\`\`bash
npm install          # Install dependencies
npm run generate     # Generate Prisma schema
npm run db:push      # Push to database
npm run dev          # Start server
\`\`\`

API: \`http://localhost:3000/api\`

## Structure

\`\`\`
${name}/
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
\`\`\`

## Commands

| Command | Description |
|---------|-------------|
| \`npm run dev\` | Start development server |
| \`npm run build\` | Build for production |
| \`npm run generate\` | Generate Prisma schema |
| \`npm run db:push\` | Push schema to database |
| \`npm run db:studio\` | Open Prisma Studio |

## Add an Entity

1. Create \`lib/entities/post.ts\`:
\`\`\`typescript
import { entity, string, text, bool } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  published: bool.default(false),
})
\`\`\`

2. Export in \`lib/entities/index.ts\`:
\`\`\`typescript
export { post } from "./post"
\`\`\`

3. Regenerate:
\`\`\`bash
npm run generate && npm run db:push
\`\`\`

## Deploy

\`\`\`bash
vercel deploy         # Deploy to Vercel
\`\`\`
`,
}
