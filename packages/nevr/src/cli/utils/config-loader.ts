// =============================================================================
// CONFIG LOADER
// Loads nevr.config.ts from the project
// =============================================================================

import { existsSync } from "fs"
import { resolve, dirname } from "path"
import { pathToFileURL } from "url"
import type { NevrConfig } from "../../config.js"

// -----------------------------------------------------------------------------
// Config File Locations
// -----------------------------------------------------------------------------

const CONFIG_FILES = [
  "nevr.config.ts",
  "nevr.config.js",
  "nevr.config.mjs",
  "src/nevr.config.ts",
  "src/nevr.config.js",
  "src/nevr.config.mjs",
]

// -----------------------------------------------------------------------------
// Config Loader
// -----------------------------------------------------------------------------

export interface LoadConfigOptions {
  /** Custom config file path */
  configPath?: string
  /** Current working directory */
  cwd?: string
  /** Suppress console output */
  silent?: boolean
}

/**
 * Find the config file in the project
 */
export function findConfigFile(options: LoadConfigOptions = {}): string | null {
  const cwd = options.cwd || process.cwd()

  // Custom path provided
  if (options.configPath) {
    const customPath = resolve(cwd, options.configPath)
    if (existsSync(customPath)) {
      return customPath
    }
    return null
  }

  // Search default locations
  for (const file of CONFIG_FILES) {
    const filePath = resolve(cwd, file)
    if (existsSync(filePath)) {
      return filePath
    }
  }

  return null
}

/**
 * Load nevr config from file
 *
 * Supports:
 * - TypeScript files (.ts) - requires tsx/ts-node
 * - JavaScript files (.js, .mjs)
 * - Default export or named `config` export
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<NevrConfig> {
  const configPath = findConfigFile(options)

  if (!configPath) {
    throw new Error(
      `No nevr config found. Create one of:\n` +
      CONFIG_FILES.map(f => `  - ${f}`).join("\n") +
      `\n\nOr specify a custom path with --config`
    )
  }

  if (!options.silent) {
    console.log(`   Loading config from: ${configPath}`)
  }

  try {
    // Convert to file URL for ESM import
    const configUrl = pathToFileURL(configPath).href

    // Dynamic import
    const module = await import(configUrl)

    // Support default export or named config export
    const config = module.default || module.config

    if (!config) {
      throw new Error(
        `Config file must export a default config or named 'config' export.\n` +
        `Example:\n` +
        `  export default defineConfig({ ... })\n` +
        `  // or\n` +
        `  export const config = defineConfig({ ... })`
      )
    }

    return config as NevrConfig
  } catch (error: any) {
    // Handle TypeScript files that need transpilation
    if (configPath.endsWith(".ts") && error.code === "ERR_UNKNOWN_FILE_EXTENSION") {
      throw new Error(
        `Cannot load TypeScript config directly.\n` +
        `Install tsx or ts-node:\n` +
        `  npm i -D tsx\n` +
        `\n` +
        `Then run with:\n` +
        `  npx tsx node_modules/.bin/nevr generate\n` +
        `  # or add to package.json scripts:\n` +
        `  "generate": "tsx node_modules/.bin/nevr generate"`
      )
    }

    throw new Error(`Failed to load config: ${error.message}`)
  }
}

/**
 * Get default config values
 */
export function getDefaultConfig(): Required<Pick<NevrConfig, "database" | "outDir" | "incremental">> {
  return {
    database: "sqlite",
    outDir: "./prisma",
    incremental: true,
  }
}

/**
 * Merge config with defaults
 */
export function mergeWithDefaults(config: NevrConfig): NevrConfig & Required<Pick<NevrConfig, "database" | "outDir" | "incremental">> {
  const defaults = getDefaultConfig()
  return {
    ...defaults,
    ...config,
  }
}
