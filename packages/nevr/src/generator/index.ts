// =============================================================================
// NEVR GENERATOR
// Schema generation for nevr projects
// Consolidated - no longer depends on nevr/generator
// =============================================================================

import type { Entity } from "../types.js"
import type { NevrConfig, ConfigPlugin } from "../config.js"
import {
  extractPluginEntities,
  extractPluginExtensions,
  applyExtensionsToEntities,
  getPluginSummary,
} from "./plugin-extractor.js"

// Import from local core (consolidated from nevr/generator)
import {
  generate as coreGenerate,
  generatePrismaSchema as coreGeneratePrismaSchema,
  generatePrismaHeader,
  generatePrismaModels,
  generateSchema,
  generateOpenAPI as coreGenerateOpenAPI,
  type GenerateOptions as CoreGenerateOptions,
  type GenerateResult as CoreGenerateResult,
  type OpenAPIGenerateOptions,
  type OpenAPISpec,
} from "./core.js"

// -----------------------------------------------------------------------------
// Re-exports
// -----------------------------------------------------------------------------

export { extractPluginEntities, extractPluginExtensions, applyExtensionsToEntities, getPluginSummary }
export { generatePrismaHeader, generatePrismaModels, generateSchema }
export type { OpenAPIGenerateOptions, OpenAPISpec }

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface GenerateOptions {
  /** Output directory */
  outDir?: string
  /** Database provider */
  provider?: "sqlite" | "postgresql" | "mysql"
  /** Force regeneration (skip cache) */
  force?: boolean
  /** Enable incremental generation */
  incremental?: boolean
  /** Silent mode (no console output) */
  silent?: boolean
  /** Enable schema splitting by namespace */
  splitSchema?: boolean
}

export interface GenerateFromConfigOptions extends GenerateOptions {
  /** Config object (if already loaded) */
  config?: NevrConfig
  /** Config file path */
  configPath?: string
}

export interface GenerateResult {
  /** Generated files */
  files: string[]
  /** Main schema path */
  schemaPath: string
  /** Namespace files (when splitSchema is enabled) */
  namespaceFiles?: Record<string, string>
  /** Entity counts */
  counts: {
    user: number
    plugin: number
    total: number
  }
  /** Plugin details */
  plugins: Array<{
    id: string
    entities: string[]
    extends: string[]
  }>
  /** Cache info */
  cache?: {
    wasIncremental: boolean
    changedEntities: string[]
    unchangedEntities: string[]
    skipped: boolean
  }
}

// -----------------------------------------------------------------------------
// Unified Generate Function
// -----------------------------------------------------------------------------

/**
 * Generate schema from config (auto-extracts plugin entities)
 *
 * @example
 * ```typescript
 * import { generateFromConfig } from "nevr/generator"
 *
 * // Uses nevr.config.ts automatically
 * await generateFromConfig()
 *
 * // Or with custom config
 * await generateFromConfig({
 *   config: {
 *     database: "postgresql",
 *     entities: [post],
 *     plugins: [auth()],
 *   }
 * })
 * ```
 */
export async function generateFromConfig(
  options: GenerateFromConfigOptions = {}
): Promise<GenerateResult> {
  const { loadConfig, mergeWithDefaults } = await import("../cli/utils/config-loader.js")

  // Load config if not provided
  const config = options.config || await loadConfig({
    configPath: options.configPath,
    silent: options.silent,
  })

  const mergedConfig = mergeWithDefaults(config)

  // Extract user entities
  const userEntities = config.entities || []

  // Extract plugin entities
  const plugins = (config.plugins || []) as ConfigPlugin[]
  const pluginEntities = extractPluginEntities(plugins)

  // Extract and apply extensions to BOTH user and plugin entities
  // (e.g., username plugin extends auth's user entity, payment extends user)
  const extensions = extractPluginExtensions(plugins)
  applyExtensionsToEntities(userEntities, extensions)
  applyExtensionsToEntities(pluginEntities, extensions)

  // Merge all entities
  const allEntities = [...userEntities, ...pluginEntities]

  // Check for duplicates
  const names = allEntities.map(e => e.name)
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
  if (duplicates.length > 0) {
    throw new Error(`Entity name collision: ${duplicates.join(", ")}`)
  }

  // Generate using local core
  const result = coreGenerate(allEntities, {
    outDir: options.outDir || mergedConfig.outDir,
    prismaProvider: options.provider || mergedConfig.database,
    incremental: options.incremental ?? mergedConfig.incremental,
    force: options.force,
    splitSchema: options.splitSchema,
  })

  // Get plugin summary
  const pluginSummary = getPluginSummary(plugins)

  return {
    files: result.files,
    schemaPath: result.schemaPath,
    namespaceFiles: result.namespaceFiles,
    counts: {
      user: userEntities.length,
      plugin: pluginEntities.length,
      total: allEntities.length,
    },
    plugins: pluginSummary.details,
    cache: result.cache,
  }
}

/**
 * Generate schema from entities array
 */
export function generate(
  entities: Entity[],
  options: GenerateOptions = {}
): GenerateResult {
  const result = coreGenerate(entities, {
    outDir: options.outDir || "./prisma",
    prismaProvider: options.provider || "sqlite",
    incremental: options.incremental ?? true,
    force: options.force,
    splitSchema: options.splitSchema,
  })

  return {
    files: result.files,
    schemaPath: result.schemaPath,
    namespaceFiles: result.namespaceFiles,
    counts: {
      user: entities.length,
      plugin: 0,
      total: entities.length,
    },
    plugins: [],
    cache: result.cache,
  }
}

/**
 * Generate Prisma schema string
 */
export function generatePrismaSchema(
  entities: Entity[],
  options: { provider?: string } = {}
): string {
  return coreGeneratePrismaSchema(entities, options)
}

/**
 * Generate OpenAPI specification
 */
export function generateOpenAPI(
  entities: Entity[],
  options: OpenAPIGenerateOptions
): OpenAPISpec {
  return coreGenerateOpenAPI(entities, options)
}
