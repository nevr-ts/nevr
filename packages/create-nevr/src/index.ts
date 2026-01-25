#!/usr/bin/env node
// =============================================================================
// CREATE-NEVR
// Scaffold a new nevr project - Vite-like experience
// Usage: npm create nevr@latest
// =============================================================================

import prompts from "prompts"
import { mkdirSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import { parseArgs } from "util"

import { baseTemplates } from "./templates/base.js"
import { expressTemplates } from "./templates/express.js"
import { honoTemplates } from "./templates/hono.js"
import { nextjsTemplates } from "./templates/nextjs.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Template = "express" | "hono" | "nextjs"
type Database = "sqlite" | "postgresql" | "mysql"
type PackageManager = "npm" | "pnpm" | "bun"

interface ProjectConfig {
  name: string
  template: Template
  database: Database
  withAuth: boolean
  packageManager: PackageManager
  install: boolean
}

// -----------------------------------------------------------------------------
// CLI Help
// -----------------------------------------------------------------------------

const HELP = `
  ⚡ create-nevr - Scaffold a new NEVR project

  Usage:
    npm create nevr@latest [project-name] [options]

  Options:
    -t, --template <name>    Template to use (express, hono, nextjs)
    -d, --database <db>      Database (sqlite, postgresql, mysql)
    --auth                   Include auth plugin
    --no-auth                Skip auth plugin
    -p, --pm <manager>       Package manager (npm, pnpm, bun)
    --no-install             Skip installing dependencies
    --no-interactive         Use defaults, no prompts
    -h, --help               Show this help message
    -v, --version            Show version

  Examples:
    npm create nevr@latest
    npm create nevr@latest my-api
    npm create nevr@latest my-api --template hono
    npm create nevr@latest my-api --template nextjs
    npm create nevr@latest my-api -t express -d postgresql --auth
    npm create nevr@latest my-api --no-interactive
`

const VERSION = "0.3.5"

// -----------------------------------------------------------------------------
// Parse CLI Arguments
// -----------------------------------------------------------------------------

function parseCliArgs(): {
  projectName?: string
  template?: Template
  database?: Database
  withAuth?: boolean
  packageManager?: PackageManager
  install?: boolean
  noInteractive: boolean
  help: boolean
  version: boolean
} {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        template: { type: "string", short: "t" },
        database: { type: "string", short: "d" },
        auth: { type: "boolean" },
        "no-auth": { type: "boolean" },
        pm: { type: "string", short: "p" },
        install: { type: "boolean" },
        "no-install": { type: "boolean" },
        "no-interactive": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
      allowPositionals: true,
    })

    return {
      projectName: positionals[0],
      template: values.template as Template | undefined,
      database: values.database as Database | undefined,
      withAuth: values["no-auth"] ? false : values.auth,
      packageManager: values.pm as PackageManager | undefined,
      install: values["no-install"] ? false : values.install,
      noInteractive: values["no-interactive"] ?? false,
      help: values.help ?? false,
      version: values.version ?? false,
    }
  } catch {
    return { noInteractive: false, help: false, version: false }
  }
}

// -----------------------------------------------------------------------------
// Template Mapping
// -----------------------------------------------------------------------------

const templateConfig = {
  express: {
    name: "Express",
    description: "Classic Node.js framework, battle-tested",
    templates: expressTemplates,
    isNextjs: false,
  },
  hono: {
    name: "Hono",
    description: "Ultrafast, lightweight, edge-ready",
    templates: honoTemplates,
    isNextjs: false,
  },
  nextjs: {
    name: "Next.js",
    description: "Full-stack React framework with App Router",
    templates: nextjsTemplates,
    isNextjs: true,
  },
}

// -----------------------------------------------------------------------------
// Project Generator
// -----------------------------------------------------------------------------

function generateProject(config: ProjectConfig): void {
  const { name, template, database, withAuth, packageManager } = config
  const isNextjs = template === "nextjs"

  // Handle "." for current directory
  const isCurrentDir = name === "." || name === "./"
  const dir = isCurrentDir ? process.cwd() : join(process.cwd(), name)

  // Allow existing empty directories or current directory
  if (existsSync(dir) && !isCurrentDir) {
    const contents = require("fs").readdirSync(dir)
    if (contents.length > 0) {
      console.error(`\n❌ Directory "${name}" already exists and is not empty\n`)
      process.exit(1)
    }
  }

  console.log(`\n📁 Creating ${name}...\n`)

  // Create directories based on template type
  const directories = isNextjs
    ? ["app", "app/api/health", "app/api/[...nevr]", "lib", "lib/entities"]
    : ["src", "src/entities"]

  if (withAuth) {
    directories.push(isNextjs ? "lib/plugins" : "src/plugins")
  }

  for (const d of directories) {
    mkdirSync(join(dir, d), { recursive: true })
  }

  const files: [string, string][] = []

  if (isNextjs) {
    // Next.js specific files - use nextjsTemplates directly for type safety
    const t = nextjsTemplates
    files.push(["package.json", t["package.json"](name, database, withAuth)])
    files.push(["tsconfig.json", t["tsconfig.json"]()])
    files.push(["next.config.ts", t["next.config.ts"]()])
    files.push([".gitignore", t[".gitignore"]()])
    files.push([".env.local", t[".env.local"](database, withAuth)])
    files.push(["README.md", t["README.md"](name)])

    // App directory
    files.push(["app/layout.tsx", t["app/layout.tsx"](name)])
    files.push(["app/page.tsx", t["app/page.tsx"](name)])
    files.push(["app/api/health/route.ts", t["app/api/health/route.ts"]()])
    files.push(["app/api/[...nevr]/route.ts", t["app/api/[...nevr]/route.ts"](withAuth)])

    // Lib directory
    files.push(["lib/nevr.ts", t["lib/nevr.ts"](withAuth)])
    files.push(["lib/nevr.config.ts", t["lib/nevr.config.ts"](database, withAuth)])
    files.push(["lib/entities/index.ts", t["lib/entities/index.ts"]()])

    // Middleware
    files.push(["middleware.ts", t["middleware.ts"](withAuth)])

    // Auth plugin
    if (withAuth) {
      files.push(["lib/plugins/index.ts", t["lib/plugins/index.ts"]()])
      files.push(["lib/plugins/auth.ts", t["lib/plugins/auth.ts"]()])
    }
  } else {
    // Express/Hono files - use templates directly
    const frameworkTemplates = template === "express" ? expressTemplates : honoTemplates

    files.push(["tsconfig.json", baseTemplates["tsconfig.json"]()])
    files.push([".gitignore", baseTemplates[".gitignore"]()])
    files.push([".env", baseTemplates[".env"](database, withAuth)])
    files.push(["src/entities/index.ts", baseTemplates["src/entities/index.ts"]()])
    files.push(["src/nevr.config.ts", baseTemplates["src/nevr.config.ts"](database, withAuth)])

    // Add auth plugin if enabled
    if (withAuth) {
      files.push(["src/plugins/auth.ts", baseTemplates["src/plugins/auth.ts"]()])
      files.push(["src/plugins/index.ts", baseTemplates["src/plugins/index.ts"]()])
    }

    // Add framework-specific templates
    files.push(["package.json", frameworkTemplates["package.json"](name, database, withAuth)])
    files.push(["src/server.ts", frameworkTemplates["src/server.ts"](withAuth)])
    files.push(["README.md", frameworkTemplates["README.md"](name)])
  }

  // Write all files
  for (const [path, content] of files) {
    writeFileSync(join(dir, path), content)
    console.log(`   ✅ ${path}`)
  }

  // Install dependencies
  if (config.install) {
    console.log(`\n📦 Installing dependencies with ${packageManager}...\n`)

    const installCmd = packageManager === "npm"
      ? "npm install"
      : packageManager === "pnpm"
        ? "pnpm install"
        : "bun install"

    try {
      execSync(installCmd, { cwd: dir, stdio: "inherit" })
    } catch {
      console.log(`\n⚠️  Failed to install dependencies. Run manually:`)
      console.log(`   cd ${name} && ${installCmd}`)
    }
  }

  // Success message
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✅ Project created!                                       ║
╠════════════════════════════════════════════════════════════╣
║  Next steps:                                               ║
║                                                            ║
║  cd ${name.padEnd(53)}║${config.install ? "" : `
║  ${packageManager} install                                 ║`}
║  npx nevr generate     # Generate schema from entities     ║
║  npx nevr db:push      # Push schema to database           ║
║  npm run dev           # Start dev server                  ║
╚════════════════════════════════════════════════════════════╝
`)
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs()

  // Handle --help
  if (args.help) {
    console.log(HELP)
    process.exit(0)
  }

  // Handle --version
  if (args.version) {
    console.log(`create-nevr v${VERSION}`)
    process.exit(0)
  }

  // Banner
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ⚡ create-nevr                                           ║
║   Nevr write boilerplate again                             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`)

  // Non-interactive mode with defaults
  if (args.noInteractive) {
    const config: ProjectConfig = {
      name: args.projectName || "my-api",
      template: args.template || "express",
      database: args.database || "sqlite",
      withAuth: args.withAuth ?? false,
      packageManager: args.packageManager || "npm",
      install: args.install ?? true,
    }

    if (!isValidName(config.name)) {
      console.error("❌ Invalid project name. Use lowercase letters, numbers, and hyphens.")
      process.exit(1)
    }

    generateProject(config)
    return
  }

  // Interactive mode
  const response = await prompts([
    {
      type: args.projectName ? null : "text",
      name: "name",
      message: "Project name:",
      initial: "my-api",
      validate: (v) => isValidName(v) || "Use lowercase letters, numbers, and hyphens",
    },
    {
      type: args.template ? null : "select",
      name: "template",
      message: "Framework:",
      choices: [
        { title: "Express", description: "Classic Node.js framework", value: "express" },
        { title: "Hono", description: "Ultrafast, edge-ready", value: "hono" },
        { title: "Next.js (Recommended)", description: "Full-stack React with App Router", value: "nextjs" },
      ],
    },
    {
      type: args.database ? null : "select",
      name: "database",
      message: "Database:",
      choices: [
        { title: "SQLite (Easy start)", value: "sqlite" },
        { title: "PostgreSQL", value: "postgresql" },
        { title: "MySQL", value: "mysql" },
      ],
    },
    {
      type: args.withAuth !== undefined ? null : "confirm",
      name: "withAuth",
      message: "Include auth plugin?",
      initial: false,
    },
    {
      type: args.packageManager ? null : "select",
      name: "pm",
      message: "Package manager:",
      choices: [
        { title: "npm", value: "npm" },
        { title: "pnpm", value: "pnpm" },
        { title: "bun", value: "bun" },
      ],
    },
    {
      type: args.install !== undefined ? null : "confirm",
      name: "install",
      message: "Install dependencies?",
      initial: true,
    },
  ])

  // Merge CLI args with prompts
  const config: ProjectConfig = {
    name: args.projectName || response.name,
    template: args.template || response.template || "express",
    database: args.database || response.database || "sqlite",
    withAuth: args.withAuth ?? response.withAuth ?? false,
    packageManager: args.packageManager || response.pm || "npm",
    install: args.install ?? response.install ?? true,
  }

  if (!config.name) {
    console.log("\nCancelled")
    process.exit(0)
  }

  generateProject(config)
}

function isValidName(name: string): boolean {
  if (name === "." || name === "./") return true
  return /^[a-z0-9-]+$/.test(name)
}

main().catch(console.error)
