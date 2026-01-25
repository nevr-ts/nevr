// =============================================================================
// DATABASE COMMANDS
// Prisma database operations: push, migrate, studio, reset
// =============================================================================

import { spawn } from "child_process"
import { existsSync } from "fs"
import { resolve } from "path"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface DbCommandOptions {
  /** Schema file path */
  schema?: string
  /** Skip confirmation prompts */
  force?: boolean
  /** Migration name (for migrate) */
  name?: string
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Find prisma schema file
 */
function findSchemaPath(customPath?: string): string {
  const cwd = process.cwd()

  if (customPath) {
    const custom = resolve(cwd, customPath)
    if (existsSync(custom)) return custom
    throw new Error(`Schema file not found: ${customPath}`)
  }

  // Default locations
  const locations = [
    "prisma/schema.prisma",
    "prisma/schema/schema.prisma",
    "schema.prisma",
  ]

  for (const loc of locations) {
    const path = resolve(cwd, loc)
    if (existsSync(path)) return path
  }

  throw new Error(
    `Prisma schema not found. Run 'npx nevr generate' first.\n` +
    `Searched:\n` +
    locations.map(l => `  - ${l}`).join("\n")
  )
}

/**
 * Run a command and stream output
 */
async function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      cwd: process.cwd(),
    })

    proc.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    proc.on("error", (error) => {
      reject(error)
    })
  })
}

/**
 * Check if prisma is available
 */
async function checkPrisma(): Promise<void> {
  try {
    await runCommand("npx", ["prisma", "--version"])
  } catch {
    throw new Error(
      `Prisma CLI not found. Install it with:\n` +
      `  npm i -D prisma @prisma/client`
    )
  }
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

/**
 * Push schema to database (no migration)
 */
export async function dbPushCommand(options: DbCommandOptions = {}): Promise<void> {
  console.log("\n⚡ nevr db:push\n")

  try {
    const schemaPath = findSchemaPath(options.schema)
    console.log(`   Schema: ${schemaPath}`)

    const args = ["prisma", "db", "push", "--schema", schemaPath]
    if (options.force) {
      args.push("--accept-data-loss")
    }

    console.log(`   Running: npx ${args.join(" ")}\n`)
    await runCommand("npx", args)

    console.log("\n✅ Database synced successfully")
  } catch (error: any) {
    console.error(`\n❌ db:push failed: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Create a new migration
 */
export async function dbMigrateCommand(options: DbCommandOptions = {}): Promise<void> {
  console.log("\n⚡ nevr db:migrate\n")

  try {
    const schemaPath = findSchemaPath(options.schema)
    console.log(`   Schema: ${schemaPath}`)

    const args = ["prisma", "migrate", "dev", "--schema", schemaPath]
    if (options.name) {
      args.push("--name", options.name)
    }

    console.log(`   Running: npx ${args.join(" ")}\n`)
    await runCommand("npx", args)

    console.log("\n✅ Migration completed successfully")
  } catch (error: any) {
    console.error(`\n❌ db:migrate failed: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Open Prisma Studio
 */
export async function dbStudioCommand(options: DbCommandOptions = {}): Promise<void> {
  console.log("\n⚡ nevr db:studio\n")

  try {
    const schemaPath = findSchemaPath(options.schema)
    console.log(`   Schema: ${schemaPath}`)

    const args = ["prisma", "studio", "--schema", schemaPath]

    console.log(`   Running: npx ${args.join(" ")}\n`)
    await runCommand("npx", args)
  } catch (error: any) {
    console.error(`\n❌ db:studio failed: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Reset database (drop all data)
 */
export async function dbResetCommand(options: DbCommandOptions = {}): Promise<void> {
  console.log("\n⚡ nevr db:reset\n")

  if (!options.force) {
    console.log("   ⚠️  This will delete all data in the database!")
    console.log("   Use --force to confirm.\n")
    process.exit(1)
  }

  try {
    const schemaPath = findSchemaPath(options.schema)
    console.log(`   Schema: ${schemaPath}`)

    const args = ["prisma", "migrate", "reset", "--schema", schemaPath, "--force"]

    console.log(`   Running: npx ${args.join(" ")}\n`)
    await runCommand("npx", args)

    console.log("\n✅ Database reset successfully")
  } catch (error: any) {
    console.error(`\n❌ db:reset failed: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Generate Prisma client
 */
export async function dbGenerateCommand(options: DbCommandOptions = {}): Promise<void> {
  console.log("\n⚡ nevr db:generate\n")

  try {
    const schemaPath = findSchemaPath(options.schema)
    console.log(`   Schema: ${schemaPath}`)

    const args = ["prisma", "generate", "--schema", schemaPath]

    console.log(`   Running: npx ${args.join(" ")}\n`)
    await runCommand("npx", args)

    console.log("\n✅ Prisma client generated successfully")
  } catch (error: any) {
    console.error(`\n❌ db:generate failed: ${error.message}`)
    process.exit(1)
  }
}

export default {
  push: dbPushCommand,
  migrate: dbMigrateCommand,
  studio: dbStudioCommand,
  reset: dbResetCommand,
  generate: dbGenerateCommand,
}
