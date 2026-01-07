// =============================================================================
// HONO TEMPLATE
// Hono.js server template (lightweight, edge-ready)
// =============================================================================

export const honoTemplates = {
  "package.json": (name: string, db: string, withAuth: boolean) => `{
  "name": "${name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "generate": "tsx src/generate.ts",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "@nevr/generator": "^0.2.0",
    "@hono/node-server": "^1.13.0",
    "nevr": "^0.2.0",
    "hono": "^4.6.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "prisma": "^5.22.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}`,

  "src/server.ts": (withAuth: boolean) => `// =============================================================================
// NEVR SERVER (Hono)
// Lightweight, edge-ready server
// =============================================================================

import "dotenv/config"

import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { cors } from "hono/cors"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { honoAdapter } from "nevr/adapters/hono"
import { config } from "./nevr.config.js"

const db = new PrismaClient()

const api = nevr({
  entities: config.entities,
  driver: prisma(db),
  plugins: config.plugins,
})

const app = new Hono()

app.use("/*", cors())

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.route("/api", honoAdapter(api, {
  debugLogs: process.env.NODE_ENV !== "production",
}))

const port = parseInt(process.env.PORT || "3000")

console.log(\`
╔════════════════════════════════════════════════════════════════╗
║  🚀 nevr server running! (Hono)                                ║
║                                                                 ║
║  Local:   http://localhost:\${port}                              ║
║  API:     http://localhost:\${port}/api                          ║
║  Health:  http://localhost:\${port}/health                       ║
╚════════════════════════════════════════════════════════════════╝
\`)

serve({
  fetch: app.fetch,
  port,
})

process.on("SIGINT", async () => {
  await db.$disconnect()
  process.exit(0)
})
`,

  "README.md": (name: string) => `# ${name}

A REST API powered by [NEVR](https://github.com/nevr-ts/nevr) + Hono.

## Why Hono?

- 🚀 **Ultrafast** - One of the fastest web frameworks
- 🌐 **Edge-ready** - Works on Cloudflare Workers, Vercel Edge, Deno
- 🪶 **Lightweight** - Minimal footprint
- 📦 **Zero dependencies** - Core has no external dependencies

## Quick Start

\`\`\`bash
npm install
npm run generate
npm run db:push
npm run dev
\`\`\`

Your API is running at \`http://localhost:3000/api\`

## Project Structure

\`\`\`
${name}/
├── src/
│   ├── entities/      # Entity definitions
│   ├── plugins/       # Plugin configs
│   ├── nevr.config.ts # Configuration
│   ├── generate.ts    # Generator script
│   └── server.ts      # Hono server
├── prisma/
│   └── schema.prisma  # Database schema
└── package.json
\`\`\`

## Deploy to Edge

\`\`\`bash
# Cloudflare Workers
npx wrangler deploy

# Vercel Edge
vercel deploy
\`\`\`

## Scripts

| Script | Description |
|--------|-------------|
| \`npm run dev\` | Start dev server |
| \`npm run generate\` | Generate Prisma schema |
| \`npm run db:push\` | Push schema to database |
| \`npm run db:studio\` | Open Prisma Studio |
`,
}
