// =============================================================================
// GENERATE COMMAND
// Generates Prisma schema from entities and plugins
// =============================================================================

import { loadConfig, mergeWithDefaults } from "../utils/config-loader.js"
import {
  extractPluginEntities,
  extractPluginExtensions,
  applyExtensionsToEntities,
  getPluginSummary,
} from "../../generator/plugin-extractor.js"
import type { ConfigPlugin } from "../../config.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface GenerateCommandOptions {
  /** Custom config file path */
  config?: string
  /** Output directory */
  outDir?: string
  /** Database provider override */
  provider?: "sqlite" | "postgresql" | "mysql"
  /** Force regeneration (skip cache) */
  force?: boolean
  /** Silent mode */
  silent?: boolean
}

// -----------------------------------------------------------------------------
// Generate Command
// -----------------------------------------------------------------------------

export async function generateCommand(options: GenerateCommandOptions = {}): Promise<void> {
  if (!options.silent) {
    console.log("\n⚡ nevr generate\n")
  }

  try {
    // 1. Load config
    const config = await loadConfig({
      configPath: options.config,
      silent: options.silent,
    })
    const mergedConfig = mergeWithDefaults(config)

    // 2. Collect user entities
    const userEntities = config.entities || []
    if (!options.silent) {
      console.log(`   📦 User entities: ${userEntities.length}`)
      if (userEntities.length > 0) {
        userEntities.forEach(e => console.log(`      - ${e.name}`))
      }
    }

    // 3. Extract plugin entities
    const plugins = (config.plugins || []) as ConfigPlugin[]
    const pluginEntities = extractPluginEntities(plugins)

    if (!options.silent && plugins.length > 0) {
      const summary = getPluginSummary(plugins)
      console.log(`   🔌 Plugins: ${summary.totalPlugins}`)
      for (const detail of summary.details) {
        console.log(`      ${detail.id}:`)
        if (detail.entities.length > 0) {
          console.log(`        entities: ${detail.entities.join(", ")}`)
        }
        if (detail.extends.length > 0) {
          console.log(`        extends: ${detail.extends.join(", ")}`)
        }
      }
    }

    // 4. Extract and apply extensions
    const extensions = extractPluginExtensions(plugins)
    applyExtensionsToEntities(userEntities, extensions)

    // 5. Merge all entities
    const allEntities = [...userEntities, ...pluginEntities]

    // 6. Check for duplicates
    const names = allEntities.map(e => e.name)
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
    if (duplicates.length > 0) {
      console.error(`\n❌ Entity name collision: ${duplicates.join(", ")}`)
      console.log("   Each entity must have a unique name.")
      process.exit(1)
    }

    if (allEntities.length === 0) {
      console.log("\n⚠️  No entities found. Add entities to your config:")
      console.log(`
   // nevr.config.ts
   import { defineConfig } from "nevr"
   import { post } from "./entities/post.js"

   export default defineConfig({
     entities: [post],
   })
`)
      process.exit(0)
    }

    // 7. Generate schema
    const outDir = options.outDir || mergedConfig.outDir
    const provider = options.provider || mergedConfig.database

    if (!options.silent) {
      console.log(`\n   Generating schema...`)
      console.log(`   Provider: ${provider}`)
      console.log(`   Output: ${outDir}/schema.prisma`)
    }

    // Use local generator (consolidated from nevr/generator)
    const { generate } = await import("../../generator/core.js")

    const result = generate(allEntities, {
      outDir,
      prismaProvider: provider,
      incremental: mergedConfig.incremental,
      force: options.force,
    })

    if (!options.silent) {
      console.log(`\n✅ Generated schema for ${allEntities.length} entities`)
      console.log(`   User: ${userEntities.length} | Plugin: ${pluginEntities.length}`)
      console.log(`
Next steps:
   npx nevr db:push      Push schema to database
   npx nevr db:migrate   Create migration
   npx nevr db:studio    Open Prisma Studio
`)
    }
  } catch (error: any) {
    console.error(`\n❌ Generation failed: ${error.message}`)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

export default generateCommand
