// =============================================================================
// BASE TEMPLATES
// Shared templates for all project types
// =============================================================================

export const baseTemplates = {
  "tsconfig.json": () => `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,

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
prisma/migrations

# Cache
.nevr-cache.json

# IDE
.vscode
.idea

# OS
.DS_Store`,

  ".env": (db: string, withAuth: boolean) => {
    const authSecret = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
    const authEnv = withAuth ? `\n\n# Auth Plugin\nAUTH_SECRET="${authSecret}"` : ""

    const dbUrls: Record<string, string> = {
      postgresql: 'DATABASE_URL="postgresql://user:password@localhost:5432/mydb"',
      mysql: 'DATABASE_URL="mysql://user:password@localhost:3306/mydb"',
      sqlite: 'DATABASE_URL="file:./dev.db"',
    }

    return `${dbUrls[db] || dbUrls.sqlite}\nPORT=3000${authEnv}`
  },

  "src/entities/index.ts": () => `// =============================================================================
  // EXAMPLE ENTITY
// =============================================================================
// Example: post.ts

// import { entity, string, text, bool } from "nevr"

// export const post = entity("post", {
//   title: string.min(1).max(200),
//   content: text,
//   published: bool.default(false),
// })
//   .rules({
//     list: ["everyone"],
//     create: ["authenticated"],
//     update: ["owner"],
//     delete: ["owner"],
//   })
// =============================================================================
// ENTITY EXPORTS
// Add your entities here after creating them
// =============================================================================
// Export your entities:
// export { post } from "./post.js"
`,

  "src/plugins/auth.ts": () => `// =============================================================================
// AUTH PLUGIN
// Provides: User, Session, Account, Verification entities + auth endpoints
// =============================================================================

import { auth } from "nevr/plugins/auth"

export const authPlugin = auth({
  secret: process.env.AUTH_SECRET || "dev-secret-change-in-production",

  emailAndPassword: {
    enabled: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // 1 day
  },
})
`,

  "src/plugins/index.ts": () => `// =============================================================================
// PLUGINS
// =============================================================================

export { authPlugin } from "./auth.js"
`,

  "src/nevr.config.ts": (db: string, withAuth: boolean) => `// =============================================================================
// NEVR CONFIG
// Run: npx nevr generate
// =============================================================================

import { defineConfig } from "nevr"
import * as entities from "./entities/index.js"
${withAuth ? `import { authPlugin } from "./plugins/index.js"\n` : ""}
export const config = defineConfig({
  database: "${db}",
  entities: Object.values(entities).filter(e => e && typeof e === "object"),
  plugins: [${withAuth ? "authPlugin" : ""}],
})

export default config
`,
}
