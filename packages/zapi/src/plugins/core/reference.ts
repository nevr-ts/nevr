// =============================================================================
// PLUGIN REFERENCE
// Helpers for referencing plugin entities in relationships
// =============================================================================

import type { RelationDef, Entity } from "../../types.js"
import { getPluginInstance } from "./registry.js"

// -----------------------------------------------------------------------------
// Plugin Entity Reference Cache
// -----------------------------------------------------------------------------

const entityCache = new Map<string, Entity>()

// -----------------------------------------------------------------------------
// Plugin Reference Function
// Used in relationships: belongsTo(() => plugin("auth").user)
// -----------------------------------------------------------------------------

export interface PluginEntityRef {
  [entityName: string]: () => Entity
}

/**
 * Reference a plugin's entities
 * 
 * Usage:
 *   belongsTo(() => plugin("auth").user)
 *   hasMany(() => plugin("payments").subscription)
 */
export function plugin(pluginId: string): PluginEntityRef {
  return new Proxy({} as PluginEntityRef, {
    get(_, entityName: string) {
      return () => {
        const cacheKey = `${pluginId}.${entityName}`
        
        // Check cache first
        if (entityCache.has(cacheKey)) {
          return entityCache.get(cacheKey)!
        }
        
        // Get plugin instance
        const pluginInstance = getPluginInstance(pluginId)
        if (!pluginInstance) {
          throw new Error(`[Zapi] Plugin "${pluginId}" not found. Make sure it's registered.`)
        }
        
        // Find entity in plugin's schema
        const schema = pluginInstance.schema
        if (!schema?.entities?.[entityName]) {
          throw new Error(`[Zapi] Entity "${entityName}" not found in plugin "${pluginId}"`)
        }
        
        // Create a placeholder entity for relationship resolution
        const entity: Entity = {
          name: entityName,
          config: {
            fields: {},
            rules: {},
            timestamps: true,
          },
        }
        
        entityCache.set(cacheKey, entity)
        return entity
      }
    },
  })
}

// -----------------------------------------------------------------------------
// String-based Reference Parser
// Parses "auth.user" style references
// -----------------------------------------------------------------------------

export function parseEntityRef(ref: string): { pluginId: string | null; entityName: string } {
  if (ref.includes(".")) {
    const [pluginId, entityName] = ref.split(".")
    return { pluginId, entityName }
  }
  
  return { pluginId: null, entityName: ref }
}

/**
 * Resolve a string reference to an entity
 * Supports both "entityName" and "pluginId.entityName" formats
 */
export function resolveEntityRef(ref: string, localEntities: Map<string, Entity>): Entity | undefined {
  const { pluginId, entityName } = parseEntityRef(ref)
  
  if (pluginId) {
    // Plugin entity reference
    const cacheKey = `${pluginId}.${entityName}`
    if (entityCache.has(cacheKey)) {
      return entityCache.get(cacheKey)
    }
    
    const pluginInstance = getPluginInstance(pluginId)
    if (!pluginInstance?.schema?.entities?.[entityName]) {
      return undefined
    }
    
    // Return placeholder - actual entity will be resolved during initialization
    return { name: entityName, config: { fields: {}, rules: {}, timestamps: true } }
  }
  
  // Local entity reference
  return localEntities.get(entityName)
}

// -----------------------------------------------------------------------------
// Clear Cache (for testing)
// -----------------------------------------------------------------------------

export function clearEntityCache(): void {
  entityCache.clear()
}

// -----------------------------------------------------------------------------
// Helper: Get Plugin Entity as Entity Function
// Converts getPluginEntity result to a function that returns Entity
// -----------------------------------------------------------------------------

/**
 * Get a plugin entity as a function that returns Entity
 * Useful for relationships: belongsTo(() => getPluginEntityFn("auth", "user"))
 * 
 * @example
 * belongsTo(() => getPluginEntityFn("auth", "user"))
 */
export function getPluginEntityFn(pluginId: string, entityName: string): () => Entity {
  return () => {
    const cacheKey = `${pluginId}.${entityName}`
    
    // Check cache first
    if (entityCache.has(cacheKey)) {
      return entityCache.get(cacheKey)!
    }
    
    // Get plugin instance
    const pluginInstance = getPluginInstance(pluginId)
    if (!pluginInstance) {
      throw new Error(`[Zapi] Plugin "${pluginId}" not found. Make sure it's registered.`)
    }
    
    // Find entity in plugin's schema
    const schema = pluginInstance.schema
    if (!schema?.entities?.[entityName]) {
      throw new Error(`[Zapi] Entity "${entityName}" not found in plugin "${pluginId}"`)
    }
    
    // Create a placeholder entity for relationship resolution
    const entity: Entity = {
      name: entityName,
      config: {
        fields: {},
        rules: {},
        timestamps: true,
      },
    }
    
    entityCache.set(cacheKey, entity)
    return entity
  }
}