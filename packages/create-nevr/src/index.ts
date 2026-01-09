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

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Template = "express" | "hono"
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
    -t, --template <name>    Template to use (express, hono)
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
    npm create nevr@latest my-api -t express -d postgresql --auth
    npm create nevr@latest my-api --no-interactive
`

const VERSION = "0.3.4"

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
  },
  hono: {
    name: "Hono",
    description: "Ultrafast, lightweight, edge-ready",
    templates: honoTemplates,
  },
}

// -----------------------------------------------------------------------------
// Project Generator
// -----------------------------------------------------------------------------

function generateProject(config: ProjectConfig): void {
  const { name, template, database, withAuth, packageManager } = config

  // Handle "." for current directory
  const isCurrentDir = name === "." || name === "./"
  const dir = isCurrentDir ? process.cwd() : join(process.cwd(), name)
  const displayName = isCurrentDir ? "current directory" : name

  // Allow existing empty directories or current directory
  if (existsSync(dir) && !isCurrentDir) {
    const contents = require("fs").readdirSync(dir)
    if (contents.length > 0) {
      console.error(`\n❌ Directory "${name}" already exists and is not empty\n`)
      process.exit(1)
    }
  }

  console.log(`\n📁 Creating ${name}...\n`)

  // Create directories
  const directories = [
    "src",
    "src/entities",
    "src/hooks",
    "src/routes",
    "src/middleware",
    "src/utils",
    "prisma",
  ]

  if (withAuth) {
    directories.push("src/plugins")
  }

  for (const d of directories) {
    mkdirSync(join(dir, d), { recursive: true })
  }

  // Get templates
  const frameworkTemplates = templateConfig[template].templates
  const files: [string, string][] = []

  // Add base templates
  files.push(["tsconfig.json", baseTemplates["tsconfig.json"]()])
  files.push([".gitignore", baseTemplates[".gitignore"]()])
  files.push([".env", baseTemplates[".env"](database, withAuth)])
  files.push(["src/entities/index.ts", baseTemplates["src/entities/index.ts"]()])
  files.push(["src/entities/.gitkeep", baseTemplates["src/entities/.gitkeep"]()])
  files.push(["src/hooks/.gitkeep", baseTemplates["src/hooks/.gitkeep"]()])
  files.push(["src/routes/.gitkeep", baseTemplates["src/routes/.gitkeep"]()])
  files.push(["src/middleware/.gitkeep", baseTemplates["src/middleware/.gitkeep"]()])
  files.push(["src/utils/.gitkeep", baseTemplates["src/utils/.gitkeep"]()])
  files.push(["src/nevr.config.ts", baseTemplates["src/nevr.config.ts"](database, withAuth)])
  files.push(["src/generate.ts", baseTemplates["src/generate.ts"](database)])

  // Add auth plugin if enabled
  if (withAuth) {
    files.push(["src/plugins/auth.ts", baseTemplates["src/plugins/auth.ts"]()])
    files.push(["src/plugins/index.ts", baseTemplates["src/plugins/index.ts"]()])
  }

  // Add framework-specific templates
  files.push(["package.json", frameworkTemplates["package.json"](name, database, withAuth)])
  files.push(["src/server.ts", frameworkTemplates["src/server.ts"](withAuth)])
  files.push(["README.md", frameworkTemplates["README.md"](name)])

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
  const padName = name.padEnd(48)
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ✅ Project created!                                      ║
║                                                            ║
║   Template: ${templateConfig[template].name.padEnd(43)}║
║                                                            ║
║   Next steps:                                              ║
║                                                            ║
║   cd ${padName}║
║   ${config.install ? "" : `${packageManager} install`.padEnd(52)}${config.install ? "" : "║\n║   "}npm run generate     # Generate Prisma schema           ║
║   npm run db:push      # Create database                   ║
║   npm run dev          # Start server                      ║
║                                                            ║
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
        { title: "Express (Recommended)", description: "Classic Node.js framework", value: "express" },
        { title: "Hono", description: "Ultrafast, edge-ready", value: "hono" },
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
  return /^[a-z0-9-]+$/.test(name)
}

main().catch(console.error)
