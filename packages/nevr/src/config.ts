// =============================================================================
// NEVR CONFIG
// Configuration helper for nevr projects
// =============================================================================

import type { Entity } from "./types.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Plugin metadata interface
 */
export interface ConfigPluginMeta {
  id: string
  name: string
  version: string
  description?: string
}

/**
 * Plugin interface for config
 * Compatible with actual NevrPlugin type for runtime use
 */
export interface ConfigPlugin {
  /** Plugin metadata (required for runtime compatibility) */
  meta: ConfigPluginMeta
  /** Plugin schema for generation */
  schema?: {
    entities?: Record<string, PluginEntityDef>
    extend?: Record<string, Record<string, unknown>>
  }
}

export interface PluginEntityDef {
  fields: Record<string, unknown>
  internal?: boolean
  required?: boolean
  description?: string
}

/**
 * Nevr configuration for both generation and runtime
 */
export interface NevrConfig {
  /**
   * Database provider for schema generation
   * @default "sqlite"
   */
  database?: "sqlite" | "postgresql" | "mysql"

  /**
   * Output directory for generated schema
   * @default "./prisma"
   */
  outDir?: string

  /**
   * User-defined entities
   */
  entities?: readonly Entity[]

  /**
   * Plugins (schemas auto-extracted during generation)
   */
  plugins?: readonly ConfigPlugin[]

  /**
   * Enable incremental generation with caching
   * @default true
   */
  incremental?: boolean
}

// -----------------------------------------------------------------------------
// defineConfig Helper
// -----------------------------------------------------------------------------

/**
 * Define nevr configuration with TypeScript support
 *
 * @example
 * ```typescript
 * // nevr.config.ts
 * import { defineConfig } from "nevr"
 * import { auth } from "nevr/plugins/auth"
 * import { post } from "./entities/post.js"
 *
 * export default defineConfig({
 *   database: "postgresql",
 *   entities: [post],
 *   plugins: [auth()],
 * })
 * ```
 */
export function defineConfig<const T extends NevrConfig>(config: T): T {
  return config
}

export default defineConfig
