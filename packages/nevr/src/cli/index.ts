#!/usr/bin/env node
// =============================================================================
// NEVR CLI
// Command line interface for nevr development tasks
// Usage: npx nevr <command> [options]
// =============================================================================

import { parseArgs } from "util"
import { generateEntity } from "./generate-entity.js"

// -----------------------------------------------------------------------------
// CLI Help
// -----------------------------------------------------------------------------

const HELP = `
  ⚡ nevr - CLI tools for NEVR development

  Usage:
    npx nevr <command> [options]

  Commands:
    generate:entity <name>    Generate a new entity file
    g:e <name>                Alias for generate:entity
    help                      Show this help message
    version                   Show version

  Options for generate:entity:
    -f, --fields <fields>     Field definitions (e.g., "email:string,name:string,age:int")
    -r, --rules <rules>       Access rules (e.g., "list:everyone,create:authenticated")
    -o, --output <path>       Output directory (default: src/entities)
    --with-relations          Include example relations
    --with-actions            Include example actions

  Field Types:
    string, text, int, float, bool, boolean, datetime, json, email

  Rule Types:
    everyone, authenticated, admin, owner, ownerOrAdmin

  Examples:
    npx nevr generate:entity user --fields "email:string,name:string"
    npx nevr g:e product -f "name:string,price:float,stock:int" -r "list:everyone,create:admin"
    npx nevr generate:entity post --fields "title:string,content:text" --with-relations
    npx nevr g:e order -f "total:float,status:string" --with-actions

`

const VERSION = "0.2.2"

// -----------------------------------------------------------------------------
// Parse CLI Arguments
// -----------------------------------------------------------------------------

function parseCliArgs() {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        fields: { type: "string", short: "f" },
        rules: { type: "string", short: "r" },
        output: { type: "string", short: "o" },
        "with-relations": { type: "boolean" },
        "with-actions": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
      allowPositionals: true,
    })

    return {
      command: positionals[0],
      entityName: positionals[1],
      fields: values.fields,
      rules: values.rules,
      output: values.output,
      withRelations: values["with-relations"] ?? false,
      withActions: values["with-actions"] ?? false,
      help: values.help ?? false,
      version: values.version ?? false,
    }
  } catch {
    return {
      command: undefined,
      entityName: undefined,
      help: false,
      version: false,
      withRelations: false,
      withActions: false,
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
    case "generate:entity":
    case "g:e": {
      if (!args.entityName) {
        console.error("❌ Entity name is required")
        console.log("\nUsage: npx nevr generate:entity <name> [options]")
        process.exit(1)
      }

      await generateEntity({
        name: args.entityName,
        fields: args.fields,
        rules: args.rules,
        output: args.output,
        withRelations: args.withRelations,
        withActions: args.withActions,
      })
      break
    }

    default:
      console.error(`❌ Unknown command: ${args.command}`)
      console.log(HELP)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message)
  process.exit(1)
})
