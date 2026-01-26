#!/usr/bin/env node
// =============================================================================
// NEVR CLI
// Unified command line interface for nevr development
// Usage: npx nevr <command> [options]
// =============================================================================

import { parseArgs } from "util"
import { generateEntity } from "./generate-entity.js"

// -----------------------------------------------------------------------------
// CLI Help
// -----------------------------------------------------------------------------

const HELP = `
  ⚡ nevr - The Entity-First Framework CLI

  Usage:
    npx nevr <command> [options]

  Schema & Generation:
    generate              Generate Prisma schema from config (auto-discovers plugins)
    g                     Alias for generate
    generate:entity <n>   Generate a new entity file
    g:e <name>            Alias for generate:entity
    introspect            Show all entities (user + plugin)
    openapi               Generate OpenAPI specification
    context               Generate AI-optimized context

  Database:
    db:push               Push schema to database (no migration)
    db:migrate            Create a new migration
    db:studio             Open Prisma Studio
    db:reset              Reset database (drop all data)
    db:generate           Generate Prisma client

  Workflow:
    dev                   Full dev workflow (generate + push + dev server)
    init                  Initialize a new nevr project

  Other:
    help                  Show this help message
    version               Show version

  Options for generate:
    -c, --config <path>   Path to nevr config file
    -d, --outDir <path>   Output directory for schema
    -p, --provider <db>   Database provider (sqlite|postgresql|mysql)
    --force               Force regeneration (skip cache)

  Options for generate:entity:
    -f, --fields <str>    Field definitions (e.g., "email:string,name:string")
    -r, --rules <str>     Access rules (e.g., "list:everyone,create:authenticated")
    -o, --output <path>   Output directory (default: src/entities)
    --with-relations      Include example relations
    --with-actions        Include example actions

  Options for db commands:
    --schema <path>       Path to Prisma schema
    --name <name>         Migration name (for db:migrate)
    --force               Skip confirmation (for db:reset)

  Options for introspect:
    --json                Output as JSON

  Options for openapi:
    -o, --output <path>   Output file (default: openapi.json)
    --format <fmt>        Output format: json|yaml (default: json)
    --title <title>       API title
    --version <ver>       API version
    --base-path <path>    Base path for API (default: /api)

  Options for context:
    -o, --output <path>   Output file (default: context.md)
    --format <fmt>        Output format: markdown|json (default: markdown)

  Examples:
    npx nevr generate                    # Generate schema from nevr.config.ts
    npx nevr g:e post -f "title:string,body:text"
    npx nevr db:push                     # Sync database
    npx nevr db:migrate --name init      # Create migration
    npx nevr introspect                  # Show all entities
    npx nevr openapi                     # Generate openapi.json
    npx nevr openapi --format yaml       # Generate openapi.yaml
    npx nevr context                     # Generate context.md
    npx nevr context -o ai-context.md    # Custom output path
    npx nevr context --format json       # Generate context.json

`

const VERSION = "0.4.0"

// -----------------------------------------------------------------------------
// Parse CLI Arguments
// -----------------------------------------------------------------------------

function parseCliArgs() {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        // Common
        config: { type: "string", short: "c" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        force: { type: "boolean" },

        // Generate
        outDir: { type: "string", short: "d" },
        provider: { type: "string", short: "p" },

        // Generate entity / openapi / context
        fields: { type: "string", short: "f" },
        rules: { type: "string", short: "r" },
        output: { type: "string", short: "o" },
        "with-relations": { type: "boolean" },
        "with-actions": { type: "boolean" },

        // DB commands
        schema: { type: "string" },
        name: { type: "string" },

        // Introspect / context / openapi
        json: { type: "boolean" },
        format: { type: "string" },
        title: { type: "string" },
        "base-path": { type: "string" },
      },
      allowPositionals: true,
    })

    return {
      command: positionals[0],
      args: positionals.slice(1),
      // Common
      config: values.config,
      help: values.help ?? false,
      version: values.version ?? false,
      force: values.force ?? false,
      // Generate
      outDir: values.outDir,
      provider: values.provider as "sqlite" | "postgresql" | "mysql" | undefined,
      // Generate entity
      fields: values.fields,
      rules: values.rules,
      output: values.output,
      withRelations: values["with-relations"] ?? false,
      withActions: values["with-actions"] ?? false,
      // DB
      schema: values.schema,
      name: values.name,
      // Introspect / context / openapi
      json: values.json ?? false,
      format: values.format,
      title: values.title,
      basePath: values["base-path"],
    }
  } catch (error) {
    return {
      command: undefined,
      args: [],
      help: false,
      version: false,
      force: false,
      withRelations: false,
      withActions: false,
      json: false,
    }
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs()

  // Handle --help or no command
  if (args.help || !args.command || args.command === "help") {
    console.log(HELP)
    process.exit(0)
  }

  // Handle --version
  if (args.version || args.command === "version") {
    console.log(`nevr v${VERSION}`)
    process.exit(0)
  }

  // Handle commands
  switch (args.command) {
    // -------------------------------------------------------------------------
    // Generate Schema
    // -------------------------------------------------------------------------
    case "generate":
    case "g": {
      const { generateCommand } = await import("./commands/generate.js")
      await generateCommand({
        config: args.config,
        outDir: args.outDir || args.output,
        provider: args.provider,
        force: args.force,
      })
      break
    }

    // -------------------------------------------------------------------------
    // Generate Entity
    // -------------------------------------------------------------------------
    case "generate:entity":
    case "g:e": {
      const entityName = args.args[0]
      if (!entityName) {
        console.error("❌ Entity name is required")
        console.log("\nUsage: npx nevr generate:entity <name> [options]")
        process.exit(1)
      }

      await generateEntity({
        name: entityName,
        fields: args.fields,
        rules: args.rules,
        output: args.output,
        withRelations: args.withRelations,
        withActions: args.withActions,
      })
      break
    }

    // -------------------------------------------------------------------------
    // Introspect
    // -------------------------------------------------------------------------
    case "introspect": {
      const { introspectCommand } = await import("./commands/introspect.js")
      await introspectCommand({
        config: args.config,
        json: args.json,
      })
      break
    }

    // -------------------------------------------------------------------------
    // Database Commands
    // -------------------------------------------------------------------------
    case "db:push": {
      const { dbPushCommand } = await import("./commands/db.js")
      await dbPushCommand({
        schema: args.schema,
        force: args.force,
      })
      break
    }

    case "db:migrate": {
      const { dbMigrateCommand } = await import("./commands/db.js")
      await dbMigrateCommand({
        schema: args.schema,
        name: args.name,
      })
      break
    }

    case "db:studio": {
      const { dbStudioCommand } = await import("./commands/db.js")
      await dbStudioCommand({
        schema: args.schema,
      })
      break
    }

    case "db:reset": {
      const { dbResetCommand } = await import("./commands/db.js")
      await dbResetCommand({
        schema: args.schema,
        force: args.force,
      })
      break
    }

    case "db:generate": {
      const { dbGenerateCommand } = await import("./commands/db.js")
      await dbGenerateCommand({
        schema: args.schema,
      })
      break
    }

    // -------------------------------------------------------------------------
    // OpenAPI
    // -------------------------------------------------------------------------
    case "openapi": {
      const { openapiCommand } = await import("./commands/openapi.js")
      await openapiCommand({
        config: args.config,
        output: args.output,
        format: args.format as "json" | "yaml" | undefined,
        title: args.title,
        version: args.name, // Reuse --name for --version
        basePath: args.basePath,
      })
      break
    }

    // -------------------------------------------------------------------------
    // Context
    // -------------------------------------------------------------------------
    case "context": {
      const { contextCommand } = await import("./commands/context.js")
      await contextCommand({
        config: args.config,
        output: args.output,
        format: args.json ? "json" : (args.format as "markdown" | "json" | undefined),
      })
      break
    }

    // -------------------------------------------------------------------------
    // Dev (Full Workflow)
    // -------------------------------------------------------------------------
    case "dev": {
      const { spawn } = await import("child_process")
      console.log("\n⚡ nevr dev - Starting development workflow\n")

      // 1. Generate schema
      console.log("1️⃣  Generating schema...")
      const { generateCommand } = await import("./commands/generate.js")
      await generateCommand({
        config: args.config,
        outDir: args.outDir,
        provider: args.provider,
        force: args.force,
        silent: true,
      })
      console.log("   ✅ Schema generated\n")

      // 2. Push to database
      console.log("2️⃣  Pushing to database...")
      const { dbPushCommand } = await import("./commands/db.js")
      await dbPushCommand({
        schema: args.schema,
        force: true,
      })

      // 3. Start dev server
      console.log("\n3️⃣  Starting dev server...")
      const devProcess = spawn("npm", ["run", "dev"], {
        stdio: "inherit",
        shell: true,
        cwd: process.cwd(),
      })

      devProcess.on("close", (code) => {
        process.exit(code || 0)
      })
      break
    }

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    case "init": {
      console.log(`
⚡ nevr init - Initialize a new project

To create a new nevr project from scratch, run:

   npm create nevr@latest

Or manually set up in an existing project:

   1. Install nevr:
      npm install nevr

   2. Create nevr.config.ts:
      import { defineConfig, entity, string, text } from "nevr"

      const post = entity("post", {
        title: string,
        body: text,
      })

      export default defineConfig({
        database: "sqlite",
        entities: [post],
      })

   3. Generate schema:
      npx nevr generate

   4. Push to database:
      npx nevr db:push

   5. Start your server:
      npm run dev

Documentation: https://github.com/nevr-ts/nevr
`)
      break
    }

    // -------------------------------------------------------------------------
    // Unknown
    // -------------------------------------------------------------------------
    default:
      console.error(`❌ Unknown command: ${args.command}`)
      console.log(HELP)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message)
  if (process.env.DEBUG) {
    console.error(err.stack)
  }
  process.exit(1)
})
