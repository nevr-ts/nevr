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
  .description("Generate Prisma schema, types, and client from entities")
  .option("-c, --config <path>", "Path to zapi config file", "./zapi.config.ts")
  .option("-o, --out <dir>", "Output directory", "./generated")
  .option("-p, --provider <provider>", "Database provider (sqlite, postgresql, mysql)", "sqlite")
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
      })

      console.log(`
✅ Generation complete!

Next steps:
  1. Run: npx prisma db push --schema=${options.out}/prisma/schema.prisma
  2. Import your entities and start the server
`)
    } catch (error) {
      console.error("❌ Generation failed:", error)
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
   2. Run: npx @nevr/cli generate
   3. Run: npx prisma db push --schema=./generated/prisma/schema.prisma
   4. Create your server file and run it

Documentation: https://github.com/nevr-ts/nevr
`)
  })

// -----------------------------------------------------------------------------
// Parse
// -----------------------------------------------------------------------------

program.parse()
