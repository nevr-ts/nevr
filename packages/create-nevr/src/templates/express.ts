// =============================================================================
// EXPRESS TEMPLATE
// Express.js server template
// =============================================================================

export const expressTemplates = {
  "package.json": (name: string, db: string, withAuth: boolean) => `{
  "name": "${name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "generate": "nevr generate",
    "db:push": "nevr db:push",
    "db:migrate": "nevr db:migrate",
    "db:studio": "nevr db:studio"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "nevr": "^0.5.2",
    "dotenv": "^16.4.0",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "prisma": "^5.22.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}`,

  "src/server.ts": (withAuth: boolean) => `// =============================================================================
// NEVR SERVER (Express)
// =============================================================================

import "dotenv/config"

import express from "express"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter${withAuth ? ", sessionAuth" : ""} } from "nevr/adapters/express"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = express()
app.use(express.json())

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.use("/api", expressAdapter(api, {
  cors: true,
  debugLogs: process.env.NODE_ENV !== "production",${withAuth ? `
  getUser: sessionAuth(driver),` : ""}
}))

const port = parseInt(process.env.PORT || "3000")

app.listen(port, () => {
  console.log(\`
╔════════════════════════════════════════════════════════════════╗
║  🚀 nevr server running!                                       ║
║                                                                 ║
║  Local:   http://localhost:\${port}                              ║
║  API:     http://localhost:\${port}/api                          ║
║  Health:  http://localhost:\${port}/health                       ║
╚════════════════════════════════════════════════════════════════╝
\`)
})

process.on("SIGINT", async () => {
  await db.$disconnect()
  process.exit(0)
})
`,

  "README.md": (name: string) => `# ${name}

REST API powered by [Nevr](https://github.com/nevr-ts/nevr) + Express.

## Quick Start

\`\`\`bash
npm install          # Install dependencies
npx nevr generate    # Generate Prisma schema
npx nevr db:push     # Push to database
npm run dev          # Start server
\`\`\`

API: \`http://localhost:3000/api\`

## Structure

\`\`\`
src/
├── entities/        # Your data models
├── plugins/         # Plugin configs (if auth enabled)
├── nevr.config.ts   # Nevr configuration
└── server.ts        # Express server
\`\`\`

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| \`npm run generate\` | \`npx nevr generate\` | Generate Prisma schema |
| \`npm run db:push\` | \`npx nevr db:push\` | Push schema to database |
| \`npm run db:studio\` | \`npx nevr db:studio\` | Open Prisma Studio |
| \`npm run dev\` | - | Start dev server |

## Add an Entity

1. Create \`src/entities/post.ts\`:
\`\`\`typescript
import { entity, string, text, bool } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  published: bool.default(false),
})
\`\`\`

2. Export in \`src/entities/index.ts\`:
\`\`\`typescript
export { post } from "./post.js"
\`\`\`

3. Regenerate:
\`\`\`bash
npx nevr generate && npx nevr db:push
\`\`\`
`,
}
