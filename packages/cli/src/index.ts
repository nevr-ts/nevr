#!/usr/bin/env node
// =============================================================================
// NEVR CLI
// Usage: npx @nevr/cli generate
//        npx nevr generate (if installed globally)
// =============================================================================

import { Command } from "commander"
import { existsSync, readFileSync } from "fs"
import { resolve, dirname } from "path"
import { pathToFileURL, fileURLToPath } from "url"
import { createRequire } from "module"

const program = new Command()

// Get version from package.json
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
let version = "0.1.0"
try {
  const require = createRequire(import.meta.url)
  const pkg = require("../package.json")
  version = pkg.version
} catch {
  // fallback
}

program
  .name("nevr")
  .description("Nevr write boilerplate again - Generate API from entities")
  .version(version)

// -----------------------------------------------------------------------------
// Generate Command
// -----------------------------------------------------------------------------

program
  .command("generate")
  .description("Generate Prisma schema from entities")
  .option("-c, --config <path>", "Path to nevr config file", "./nevr.config.ts")
  .option("-o, --out <dir>", "Output directory for schema", "./prisma")
  .option("-p, --provider <provider>", "Database provider (sqlite, postgresql, mysql)", "sqlite")
  .option("-f, --force", "Force full regeneration, ignoring cache", false)
  .option("--no-cache", "Disable incremental caching")
  .addHelpText('after', `
Examples:
  $ nevr generate                              # Use defaults
  $ nevr generate -c ./src/nevr.config.ts      # Custom config file
  $ nevr generate -p postgresql                # Use PostgreSQL
  $ nevr generate -o ./db --force              # Custom output, force rebuild
`)
  .action(async (options) => {
    try {
      console.log("\n⚡ nevr generate\n")

      const configPath = resolve(process.cwd(), options.config)

      // Check for config file (ts, js, mjs)
      const extensions = [".ts", ".js", ".mjs"]
      let foundPath: string | null = null

      for (const ext of extensions) {
        const testPath = configPath.endsWith(ext) ? configPath : configPath.replace(/\.[^.]+$/, ext)
        if (existsSync(testPath)) {
          foundPath = testPath
          break
        }
      }

      // Also try without extension replacement
      if (!foundPath && existsSync(configPath)) {
        foundPath = configPath
      }

      if (!foundPath) {
        console.error(`❌ Config file not found: ${configPath}

Create a nevr.config.ts file with your entities:

  import { entity, string, text, belongsTo } from "nevr"

  export const user = entity("user", {
    email: string.unique(),
    name: string,
  })

  export const post = entity("post", {
    title: string,
    body: text,
    author: belongsTo(() => user),
  }).ownedBy("author")

  export default {
    entities: [user, post],
  }
`)
        process.exit(1)
      }

      console.log(`   📄 Config: ${foundPath}`)
      console.log(`   📁 Output: ${options.out}`)
      console.log(`   🗄️  Provider: ${options.provider}\n`)

      // Dynamic import of config
      const configUrl = pathToFileURL(foundPath).href
      const configModule = await import(configUrl)
      const config = configModule.default

      // Get entities from default export or named exports
      let entities = config?.entities || []

      if (entities.length === 0) {
        // Look for individual entity exports
        entities = Object.values(configModule).filter(
          (v: any) => v && typeof v === "object" && ("name" in v || "build" in v)
        )
      }

      if (entities.length === 0) {
        console.error("❌ No entities found in config file")
        console.error("   Make sure to export entities or a default config object\n")
        process.exit(1)
      }

      console.log(`   📦 Found ${entities.length} entities`)

      // Import generator and run
      const { generate } = await import("@nevr/generator")

      generate(entities, {
        outDir: options.out,
        prismaProvider: options.provider,
        force: options.force,
        incremental: options.cache !== false,
      })

      console.log(`
✅ Generation complete!

Next steps:
  1. Run: npx prisma db push --schema=${options.out}/schema.prisma
  2. Import your entities and start the server
`)
    } catch (error) {
      console.error("❌ Generation failed:", error)
      process.exit(1)
    }
  })

// -----------------------------------------------------------------------------
// DB Push Command
// -----------------------------------------------------------------------------

program
  .command("db:push")
  .description("Push schema to database (creates tables)")
  .option("-s, --schema <path>", "Path to Prisma schema", "./prisma/schema.prisma")
  .option("--accept-data-loss", "Accept data loss for schema changes")
  .addHelpText('after', `
Examples:
  $ nevr db:push                               # Push with default schema
  $ nevr db:push -s ./db/schema.prisma         # Custom schema path
  $ nevr db:push --accept-data-loss            # Accept breaking changes
`)
  .action(async (options) => {
    const { execSync } = await import("child_process")
    try {
      console.log("\n⚡ nevr db:push\n")
      const flags = options.acceptDataLoss ? "--accept-data-loss" : ""
      execSync(`npx prisma db push --schema=${options.schema} ${flags}`, {
        stdio: "inherit",
        cwd: process.cwd(),
      })
    } catch {
      process.exit(1)
    }
  })

// -----------------------------------------------------------------------------
// DB Migrate Command
// -----------------------------------------------------------------------------

program
  .command("db:migrate")
  .description("Create a migration (production-ready)")
  .option("-s, --schema <path>", "Path to Prisma schema", "./prisma/schema.prisma")
  .option("-n, --name <name>", "Migration name")
  .addHelpText('after', `
Examples:
  $ nevr db:migrate                            # Interactive migration
  $ nevr db:migrate -n add_user_role           # Named migration
  $ nevr db:migrate -s ./db/schema.prisma      # Custom schema
`)
  .action(async (options) => {
    const { execSync } = await import("child_process")
    try {
      console.log("\n⚡ nevr db:migrate\n")
      const nameFlag = options.name ? `--name ${options.name}` : ""
      execSync(`npx prisma migrate dev --schema=${options.schema} ${nameFlag}`, {
        stdio: "inherit",
        cwd: process.cwd(),
      })
    } catch {
      process.exit(1)
    }
  })

// -----------------------------------------------------------------------------
// DB Studio Command
// -----------------------------------------------------------------------------

program
  .command("db:studio")
  .description("Open Prisma Studio to view/edit data")
  .option("-s, --schema <path>", "Path to Prisma schema", "./prisma/schema.prisma")
  .option("-p, --port <port>", "Port for Prisma Studio", "5555")
  .addHelpText('after', `
Examples:
  $ nevr db:studio                             # Open on default port 5555
  $ nevr db:studio -p 3333                     # Custom port
`)
  .action(async (options) => {
    const { execSync } = await import("child_process")
    try {
      console.log("\n⚡ nevr db:studio\n")
      console.log(`   Opening Prisma Studio on port ${options.port}...\n`)
      execSync(`npx prisma studio --schema=${options.schema} --port=${options.port}`, {
        stdio: "inherit",
        cwd: process.cwd(),
      })
    } catch {
      process.exit(1)
    }
  })

// -----------------------------------------------------------------------------
// DB Reset Command
// -----------------------------------------------------------------------------

program
  .command("db:reset")
  .description("Reset database (drop all data and recreate)")
  .option("-s, --schema <path>", "Path to Prisma schema", "./prisma/schema.prisma")
  .option("-f, --force", "Skip confirmation prompt")
  .addHelpText('after', `
Examples:
  $ nevr db:reset                              # Reset with confirmation
  $ nevr db:reset -f                           # Force reset (no prompt)
`)
  .action(async (options) => {
    const { execSync } = await import("child_process")
    try {
      console.log("\n⚡ nevr db:reset\n")
      const forceFlag = options.force ? "--force" : ""
      execSync(`npx prisma migrate reset --schema=${options.schema} ${forceFlag}`, {
        stdio: "inherit",
        cwd: process.cwd(),
      })
    } catch {
      process.exit(1)
    }
  })

// -----------------------------------------------------------------------------
// Dev Command (shortcut)
// -----------------------------------------------------------------------------

program
  .command("dev")
  .description("Start development workflow (generate + push + dev server)")
  .option("-c, --config <path>", "Path to nevr config file", "./src/nevr.config.ts")
  .addHelpText('after', `
Examples:
  $ nevr dev                                   # Full workflow with defaults
  $ nevr dev -c ./config/entities.ts           # Custom config location
`)
  .action(async (options) => {
    const { execSync } = await import("child_process")
    try {
      console.log("\n⚡ nevr dev - Starting development workflow\n")

      // 1. Generate schema
      console.log("1️⃣  Generating schema...")
      execSync(`npx nevr generate -c ${options.config}`, { stdio: "inherit", cwd: process.cwd() })

      // 2. Push to database
      console.log("\n2️⃣  Pushing to database...")
      execSync("npx prisma db push", { stdio: "inherit", cwd: process.cwd() })

      // 3. Start dev server
      console.log("\n3️⃣  Starting dev server...")
      execSync("npm run dev", { stdio: "inherit", cwd: process.cwd() })
    } catch {
      process.exit(1)
    }
  })

// -----------------------------------------------------------------------------
// Init Command
// -----------------------------------------------------------------------------

program
  .command("init")
  .description("Initialize a new nevr project (use npm create nevr for full scaffolding)")
  .action(() => {
    console.log(`
⚡ To create a new nevr project, run:

   npm create nevr@latest

Or manually:

   1. Create nevr.config.ts with your entities
   2. Run: npx nevr generate
   3. Run: npx nevr db:push
   4. Run: npm run dev

Documentation: https://github.com/nevr-ts/nevr

Available commands:
   nevr generate     Generate Prisma schema from entities
   nevr db:push      Push schema to database
   nevr db:migrate   Create a migration
   nevr db:studio    Open Prisma Studio
   nevr db:reset     Reset database
   nevr dev          Full development workflow
`)
  })

// -----------------------------------------------------------------------------
// Parse
// -----------------------------------------------------------------------------

program.parse()
