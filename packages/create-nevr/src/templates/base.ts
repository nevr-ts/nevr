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
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@entities/*": ["./src/entities/*"]
    }
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
// ENTITY EXPORTS
// Add your entities here after creating them
// =============================================================================

// Example: Create src/entities/post.ts and export it here
// export { post } from "./post.js"
`,

  "src/entities/.gitkeep": () => `# Your custom entities go here
# Example: post.ts

# import { entity, string, text, bool, belongsTo } from "nevr"
#
# export const post = entity("post", {
#   title: string.min(1).max(200),
#   body: text,
#   published: bool.default(false),
# })
`,

  "src/hooks/.gitkeep": () => `# Custom lifecycle hooks go here`,

  "src/routes/.gitkeep": () => `# Custom routes go here (non-CRUD endpoints)`,

  "src/middleware/.gitkeep": () => `# Custom middleware go here`,

  "src/utils/.gitkeep": () => `# Utility functions go here`,

  "src/plugins/auth.ts": () => `// =============================================================================
// AUTH PLUGIN CONFIGURATION
// =============================================================================

import { auth, userEntity, sessionEntity, accountEntity, verificationEntity } from "nevr/plugins/auth"

// Export auth entities for Prisma schema generation
export const authEntities = [userEntity, sessionEntity, accountEntity, verificationEntity]

export const authPlugin = auth({
  // Secret for signing session tokens (from .env)
  secret: process.env.AUTH_SECRET || "dev-secret-change-in-production",
  
  // Email/Password authentication
  emailAndPassword: {
    enabled: true,
    // minPasswordLength: 8,
    // requireEmailVerification: false,
  },
  
  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // 1 day
  },
  
  // OAuth providers (uncomment and add credentials to enable)
  // socialProviders: {
  //   google: {
  //     clientId: process.env.GOOGLE_CLIENT_ID || "",
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  //   },
  //   github: {
  //     clientId: process.env.GITHUB_CLIENT_ID || "",
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  //   },
  // },
})
`,

  "src/plugins/index.ts": () => `// =============================================================================
// PLUGIN EXPORTS
// =============================================================================

export { authPlugin, authEntities } from "./auth.js"
`,

  "src/nevr.config.ts": (db: string, withAuth: boolean) => `// =============================================================================
// NEVR CONFIGURATION
// =============================================================================

import * as entities from "./entities/index.js"
${withAuth ? `import { authPlugin, authEntities } from "./plugins/index.js"\n` : ""}
const entityArray = Object.values(entities).filter(e => e && typeof e === "object")

export const config = {
  database: "${db}" as const,
  entities: [
    ...entityArray,${withAuth ? `
    ...authEntities, // User, Session, Account, Verification` : ""}
  ],
  plugins: [${withAuth ? `
    authPlugin,` : ""}
  ],
}

export default config
`,

  "src/generate.ts": (db: string) => `// =============================================================================
// GENERATOR SCRIPT
// Run: npm run generate
// =============================================================================

import "dotenv/config"
import { generate } from "@nevr/generator"
import { config } from "./nevr.config.js"

const pluginEntities = config.plugins
  .filter(p => p && typeof p === "object" && "entities" in p)
  .flatMap((p: any) => p.entities || [])

const allEntities = [...config.entities, ...pluginEntities]

const entityNames = allEntities.map((e: any) => e.name || e._name)
const duplicates = entityNames.filter((name: string, i: number) => entityNames.indexOf(name) !== i)
if (duplicates.length > 0) {
  console.error(\`❌ Entity name collision: \${duplicates.join(", ")}\`)
  process.exit(1)
}

console.log("📦 Generating schema for entities:")
entityNames.forEach((name: string) => console.log(\`   - \${name}\`))

generate(allEntities, {
  outDir: "./prisma",
  prismaProvider: "${db}",
})
`,
}
