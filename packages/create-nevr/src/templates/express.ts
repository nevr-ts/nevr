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
    "generate": "tsx src/generate.ts",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "@nevr/generator": "^0.3.0",
    "nevr": "^0.3.0",
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
import { expressAdapter } from "nevr/adapters/express"
import { config } from "./nevr.config.js"

const db = new PrismaClient()

const api = nevr({
  entities: config.entities,
  driver: prisma(db),
  plugins: config.plugins,
})

const app = express()
app.use(express.json())

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.use("/api", expressAdapter(api, {
  cors: true,
  debugLogs: process.env.NODE_ENV !== "production",
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

A REST API powered by [NEVR](https://github.com/nevr-ts/nevr) + Express.

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
│   └── server.ts      # Express server
├── prisma/
│   └── schema.prisma  # Database schema
└── package.json
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
