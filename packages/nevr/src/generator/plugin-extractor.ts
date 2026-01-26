// =============================================================================
// PLUGIN SCHEMA EXTRACTOR
// Extracts entity definitions from plugins for schema generation
// =============================================================================

import type { Entity, FieldDef, FieldType } from "../types.js"
import type { ConfigPlugin, PluginEntityDef } from "../config.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface FieldBuilderLike {
  build(): FieldDef
}

interface PlainFieldDef {
  type: FieldType
  optional?: boolean
  unique?: boolean
  default?: unknown
  [key: string]: unknown
}

// -----------------------------------------------------------------------------
// Field Conversion
// -----------------------------------------------------------------------------

/**
 * Check if value is a FieldBuilder instance
 */
function isFieldBuilder(value: unknown): value is FieldBuilderLike {
  return (
    value !== null &&
    typeof value === "object" &&
    "build" in value &&
    typeof (value as any).build === "function"
  )
}

/**
 * Check if value is a plain field definition
 */
function isPlainFieldDef(value: unknown): value is PlainFieldDef {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    typeof (value as any).type === "string"
  )
}

/**
 * Internal FieldBuilder state with underscore prefix
 */
interface FieldBuilderState {
  _type: FieldType
  _optional?: boolean
  _unique?: boolean
  _hasDefault?: boolean
  _default?: unknown
  _min?: number
  _max?: number
  _isEmail?: boolean
  _validation?: unknown
  _security?: { omit?: boolean }
  _access?: { write?: string }
  _meta?: unknown
}

/**
 * Check if value is internal FieldBuilder state (underscore-prefixed)
 */
function isFieldBuilderState(value: unknown): value is FieldBuilderState {
  return (
    value !== null &&
    typeof value === "object" &&
    "_type" in value &&
    typeof (value as any)._type === "string"
  )
}

/**
 * Convert plain field definition to FieldDef
 */
function convertPlainFieldDef(fieldDef: PlainFieldDef): FieldDef {
  const result: FieldDef = {
    type: fieldDef.type,
    optional: fieldDef.optional || false,
    unique: fieldDef.unique || false,
    hasDefault: fieldDef.default !== undefined,
    default: fieldDef.default,
    min: fieldDef.min as number | undefined,
    max: fieldDef.max as number | undefined,
    isEmail: fieldDef.isEmail as boolean | undefined,
    validation: fieldDef.validation as FieldDef["validation"],
    meta: fieldDef.meta as FieldDef["meta"],
  }

  // Handle security properties
  if (fieldDef.omit) {
    result.security = { ...result.security, omit: fieldDef.omit as boolean }
  }

  // Handle access properties (use any since these are runtime conversions from plugin schemas)
  if (fieldDef.writable) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result as any).access = { ...(result as any).access, write: fieldDef.writable }
  }

  return result
}

/**
 * Convert internal FieldBuilder state to FieldDef
 */
function convertFieldBuilderState(state: FieldBuilderState): FieldDef {
  const result: FieldDef = {
    type: state._type,
    optional: state._optional || false,
    unique: state._unique || false,
    hasDefault: state._hasDefault || false,
    default: state._default,
    min: state._min,
    max: state._max,
    isEmail: state._isEmail,
    validation: state._validation as FieldDef["validation"],
    meta: state._meta as FieldDef["meta"],
  }

  // Handle security properties
  if (state._security?.omit) {
    result.security = { ...result.security, omit: state._security.omit }
  }

  // Handle access properties
  if (state._access?.write) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result as any).access = { ...(result as any).access, write: state._access.write }
  }

  return result
}

/**
 * Build field definition from various input types
 */
function buildFieldDef(value: unknown): FieldDef | null {
  // FieldBuilder instance with build() method
  if (isFieldBuilder(value)) {
    return value.build()
  }

  // Internal FieldBuilder state (underscore-prefixed)
  if (isFieldBuilderState(value)) {
    return convertFieldBuilderState(value)
  }

  // Plain field definition
  if (isPlainFieldDef(value)) {
    return convertPlainFieldDef(value)
  }

  // Unknown type - skip
  return null
}

// -----------------------------------------------------------------------------
// Entity Extraction
// -----------------------------------------------------------------------------

/**
 * Convert PluginEntityDef to Entity
 */
function pluginEntityDefToEntity(name: string, def: PluginEntityDef): Entity {
  const fields: Record<string, FieldDef> = {}

  for (const [fieldName, fieldValue] of Object.entries(def.fields)) {
    const fieldDef = buildFieldDef(fieldValue)
    if (fieldDef) {
      fields[fieldName] = fieldDef
    }
  }

  const entity: Entity = {
    name,
    config: {
      fields,
      rules: {},
      timestamps: true,
    },
  }

  // Store internal flag as a custom property (for filtering in API routes)
  if (def.internal) {
    (entity as any)._internal = true
  }

  return entity
}

/**
 * Extract all entities from plugins
 *
 * @example
 * ```typescript
 * const plugins = [auth(), payment()]
 * const entities = extractPluginEntities(plugins)
 * // Returns: [userEntity, sessionEntity, subscriptionEntity, ...]
 * ```
 */
export function extractPluginEntities(plugins: ConfigPlugin[]): Entity[] {
  const entities: Entity[] = []

  for (const plugin of plugins) {
    if (!plugin.schema?.entities) continue

    const pluginId = plugin.meta.id

    for (const [entityName, entityDef] of Object.entries(plugin.schema.entities)) {
      try {
        const entity = pluginEntityDefToEntity(entityName, entityDef)

        // Tag entity with plugin source for debugging
        ; (entity as any)._pluginId = pluginId

        entities.push(entity)
      } catch (error) {
        console.warn(`   Warning: Failed to extract entity "${entityName}" from plugin "${pluginId}"`)
      }
    }
  }

  return entities
}

/**
 * Extract field extensions from plugins
 *
 * @example
 * ```typescript
 * // Payment plugin extends user with stripeCustomerId
 * const extensions = extractPluginExtensions([payment()])
 * // Returns: Map { "user" => { stripeCustomerId: FieldDef } }
 * ```
 */
export function extractPluginExtensions(plugins: ConfigPlugin[]): Map<string, Record<string, FieldDef>> {
  const extensions = new Map<string, Record<string, FieldDef>>()

  for (const plugin of plugins) {
    if (!plugin.schema?.extend) continue

    for (const [entityName, fields] of Object.entries(plugin.schema.extend)) {
      const existing = extensions.get(entityName) || {}

      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        const fieldDef = buildFieldDef(fieldValue)
        if (fieldDef) {
          existing[fieldName] = fieldDef
        }
      }

      extensions.set(entityName, existing)
    }
  }

  return extensions
}

/**
 * Apply plugin extensions to user entities
 *
 * Modifies entities in-place to add fields from plugins
 */
export function applyExtensionsToEntities(
  entities: Entity[],
  extensions: Map<string, Record<string, FieldDef>>
): void {
  for (const entity of entities) {
    const ext = extensions.get(entity.name)
    if (ext) {
      Object.assign(entity.config.fields, ext)
    }
  }
}

/**
 * Get summary of extracted plugin data
 */
export function getPluginSummary(plugins: ConfigPlugin[]): {
  totalPlugins: number
  totalEntities: number
  totalExtensions: number
  details: Array<{
    id: string
    entities: string[]
    extends: string[]
  }>
} {
  const details: Array<{ id: string; entities: string[]; extends: string[] }> = []
  let totalEntities = 0
  let totalExtensions = 0

  for (const plugin of plugins) {
    const id = plugin.meta.id
    const entities = Object.keys(plugin.schema?.entities || {})
    const extendsEntities = Object.keys(plugin.schema?.extend || {})

    totalEntities += entities.length
    totalExtensions += extendsEntities.length

    details.push({ id, entities, extends: extendsEntities })
  }

  return {
    totalPlugins: plugins.length,
    totalEntities,
    totalExtensions,
    details,
  }
}
