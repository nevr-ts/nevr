// =============================================================================
// INTROSPECT COMMAND
// Shows all entities (user + plugin) in the project
// =============================================================================

import { loadConfig } from "../utils/config-loader.js"
import {
  extractPluginEntities,
  getPluginSummary,
} from "../../generator/plugin-extractor.js"
import type { ConfigPlugin } from "../../config.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface IntrospectCommandOptions {
  /** Custom config file path */
  config?: string
  /** Output as JSON */
  json?: boolean
}

// -----------------------------------------------------------------------------
// Introspect Command
// -----------------------------------------------------------------------------

export async function introspectCommand(options: IntrospectCommandOptions = {}): Promise<void> {
  try {
    // Load config
    const config = await loadConfig({
      configPath: options.config,
      silent: true,
    })

    // Collect data
    const userEntities = config.entities || []
    const plugins = (config.plugins || []) as ConfigPlugin[]
    const pluginEntities = extractPluginEntities(plugins)
    const summary = getPluginSummary(plugins)

    // JSON output
    if (options.json) {
      const output = {
        userEntities: userEntities.map(e => ({
          name: e.name,
          fields: Object.keys(e.config.fields),
          timestamps: e.config.timestamps,
          internal: (e.config as any).internal,
        })),
        plugins: summary.details,
        totals: {
          userEntities: userEntities.length,
          pluginEntities: pluginEntities.length,
          totalEntities: userEntities.length + pluginEntities.length,
          plugins: plugins.length,
        },
      }
      console.log(JSON.stringify(output, null, 2))
      return
    }

    // Pretty output
    console.log("\n🔍 nevr introspect\n")

    // User entities
    if (userEntities.length > 0) {
      console.log("📦 User Entities:")
      for (const entity of userEntities) {
        const fieldCount = Object.keys(entity.config.fields).length
        const flags: string[] = []
        if (entity.config.timestamps) flags.push("timestamps")
        if ((entity.config as any).internal) flags.push("internal")
        const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : ""
        console.log(`   - ${entity.name} (${fieldCount} fields)${flagStr}`)
      }
      console.log()
    } else {
      console.log("📦 User Entities: (none)")
      console.log()
    }

    // Plugins
    if (plugins.length > 0) {
      console.log("🔌 Plugins:")
      for (const detail of summary.details) {
        console.log(`   ${detail.id}:`)
        if (detail.entities.length > 0) {
          console.log(`     Entities: ${detail.entities.join(", ")}`)
        }
        if (detail.extends.length > 0) {
          console.log(`     Extends: ${detail.extends.join(", ")}`)
        }
        if (detail.entities.length === 0 && detail.extends.length === 0) {
          console.log(`     (no schema)`)
        }
      }
      console.log()
    } else {
      console.log("🔌 Plugins: (none)")
      console.log()
    }

    // Summary
    const totalEntities = userEntities.length + pluginEntities.length
    console.log("📊 Summary:")
    console.log(`   Total entities: ${totalEntities}`)
    console.log(`     - User: ${userEntities.length}`)
    console.log(`     - Plugin: ${pluginEntities.length}`)
    if (summary.totalExtensions > 0) {
      console.log(`   Field extensions: ${summary.totalExtensions}`)
    }
    console.log()

  } catch (error: any) {
    console.error(`\n❌ Introspect failed: ${error.message}`)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

export default introspectCommand
