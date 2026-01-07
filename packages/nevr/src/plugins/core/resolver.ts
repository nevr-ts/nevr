// =============================================================================
// PLUGIN RESOLVER
// Resolves plugin extensions and merges schemas
// =============================================================================

import type { Entity, FieldDef, Route, Middleware } from "../../types.js"
import { getLogger } from "../../logger.js"
import type {
  NevrPlugin,
  PluginSchema,
  PluginExtension,
  PluginFieldDef,
  PluginFieldDefObject,
  PluginEntityDef,
  PluginExtensionEntityDef,
  ResolvedPlugin,
  ResolvedEntityMeta,
  PluginLifecycleHooks,
  EntityRoutesConfig,
} from "./contract.js"
import { FieldBuilder, RelationBuilder, SelfRefBuilder } from "../../fields.js"

// Re-export types for convenience
export type { ResolvedEntityMeta, ResolvedPlugin } from "./contract.js"

// -----------------------------------------------------------------------------
// Resolve PluginFieldDef to Plain Object
// Converts FieldBuilder instances to PluginFieldDefObject for processing
// -----------------------------------------------------------------------------

export function resolvePluginFieldDef(field: PluginFieldDef): PluginFieldDefObject {
  // If it's a FieldBuilder, build it to get the FieldDef
  if (field instanceof FieldBuilder) {
    const built = field._build()
    return {
      type: built.type as PluginFieldDefObject["type"],
      required: !built.optional,
      unique: built.unique,
      default: built.default,
      // Map security.omit to returned: false
      input: built.security?.omit ? false : undefined,
      returned: built.security?.omit ? false : undefined,
    }
  }

  // If it's a RelationBuilder, build it
  if (field instanceof RelationBuilder) {
    const built = (field as any)._build("relation")
    return {
      type: "string",
      required: !built.optional,
      unique: built.unique,
      references: built.relation ? {
        entity: typeof built.relation.entity === "function"
          ? built.relation.entity()?.name || "unknown"
          : "unknown",
        field: built.relation.references || "id",
      } : undefined,
    }
  }

  // If it's a SelfRefBuilder, build it
  if (field instanceof SelfRefBuilder) {
    const built = (field as any)._build("selfRef")
    return {
      type: "string",
      required: !built.optional,
      unique: built.unique,
    }
  }

  // It's already a plain object
  return field as PluginFieldDefObject
}

// -----------------------------------------------------------------------------
// Convert Plugin Field to Nevr Field
// -----------------------------------------------------------------------------

function toNevrField(field: PluginFieldDef): FieldDef {
  const resolved = resolvePluginFieldDef(field)
  return {
    type: resolved.type,
    optional: !resolved.required,
    unique: resolved.unique || false,
    default: resolved.default,
    hasDefault: resolved.default !== undefined,
    relation: resolved.references ? {
      type: "belongsTo",
      entity: () => ({ name: resolved.references!.entity, config: { fields: {}, rules: {}, timestamps: false } }),
      foreignKey: resolved.references.entity + "Id",
      references: resolved.references.field || "id",
    } : undefined,
  }
}

// -----------------------------------------------------------------------------
// Convert Plugin Entity to Nevr Entity
// Entity-First: Plugin entities get the same capabilities as regular entities
// -----------------------------------------------------------------------------

function toNevrEntity(name: string, def: PluginEntityDef): Entity {
  const fields: Record<string, FieldDef> = {}

  for (const [fieldName, fieldDef] of Object.entries(def.fields)) {
    fields[fieldName] = toNevrField(fieldDef)
  }

  return {
    name,
    config: {
      fields,
      // Use plugin entity rules OR internal entity rules
      rules: def.rules || {
        // Internal entities have no public CRUD routes
        create: def.internal ? [] : undefined,
        read: def.internal ? [] : undefined,
        update: def.internal ? [] : undefined,
        delete: def.internal ? [] : undefined,
        list: def.internal ? [] : undefined,
      },
      timestamps: true,
      // Entity-First: Carry over actions from plugin entity
      actions: def.actions,
      // Entity-First: Carry over validators from plugin entity
      validators: def.validators,
    },
  }
}

// -----------------------------------------------------------------------------
// Entity Rename Tracking
// -----------------------------------------------------------------------------

interface EntityRenameInfo {
  originalName: string
  newName: string
  routePath?: string
  internal?: boolean
}

// -----------------------------------------------------------------------------
// Apply Extension to Schema
// -----------------------------------------------------------------------------

interface ApplyExtensionResult {
  schema: PluginSchema
  renames: Map<string, EntityRenameInfo>
}

function applyExtension(
  schema: PluginSchema,
  extension: PluginExtension,
  pluginId: string
): ApplyExtensionResult {
  const result: PluginSchema = {
    entities: {},
    extend: { ...schema.extend },
  }

  // Deep copy entities to avoid mutation
  if (schema.entities) {
    for (const [name, def] of Object.entries(schema.entities)) {
      result.entities![name] = {
        ...def,
        fields: { ...def.fields },
      }
    }
  }

  // Track entity renames
  const renames = new Map<string, EntityRenameInfo>()

  // Apply entity modifications
  if (extension.entities && result.entities) {
    for (const [entityName, entityExt] of Object.entries(extension.entities)) {
      const entity = result.entities[entityName]

      if (!entity) {
        getLogger().warn(`[${pluginId}] Cannot extend non-existent entity: ${entityName}`)
        continue
      }

      // Remove entity if requested (and allowed)
      if (entityExt.remove) {
        if (entity.required) {
          getLogger().warn(`[${pluginId}] Cannot remove required entity: ${entityName}`)
        } else {
          delete result.entities[entityName]
          continue
        }
      }

      // Handle entity rename
      if (entityExt.rename) {
        const newName = entityExt.rename
        result.entities[newName] = entity
        delete result.entities[entityName]

        renames.set(newName, {
          originalName: entityName,
          newName,
          routePath: entityExt.routePath,
          internal: entityExt.internal,
        })
      } else if (entityExt.routePath || entityExt.internal !== undefined) {
        // Track route path / internal changes without rename
        renames.set(entityName, {
          originalName: entityName,
          newName: entityName,
          routePath: entityExt.routePath,
          internal: entityExt.internal,
        })
      }

      // Get the entity reference (might have been renamed)
      const targetName = entityExt.rename || entityName
      const targetEntity = result.entities[targetName]

      if (!targetEntity) continue

      // Apply internal flag
      if (entityExt.internal !== undefined) {
        targetEntity.internal = entityExt.internal
      }

      // Apply route path override
      if (entityExt.routePath) {
        targetEntity.routePath = entityExt.routePath
      }

      // Add new fields directly
      if (entityExt.addFields) {
        for (const [fieldName, fieldDef] of Object.entries(entityExt.addFields)) {
          targetEntity.fields[fieldName] = fieldDef
        }
      }

      // Modify existing fields
      if (entityExt.fields) {
        for (const [fieldName, fieldExt] of Object.entries(entityExt.fields)) {
          const field = targetEntity.fields[fieldName]

          // Add new field
          if (fieldExt.add) {
            targetEntity.fields[fieldName] = fieldExt.add
            continue
          }

          // Field operations require field to exist
          if (!field) {
            getLogger().warn(`[${pluginId}] Cannot modify non-existent field: ${targetName}.${fieldName}`)
            continue
          }

          // Remove field (if not locked)
          if (fieldExt.remove) {
            const resolvedField = resolvePluginFieldDef(field)
            if (resolvedField.locked) {
              getLogger().warn(`[${pluginId}] Cannot remove locked field: ${targetName}.${fieldName}`)
            } else {
              delete targetEntity.fields[fieldName]
            }
            continue
          }

          // Rename field
          if (fieldExt.rename) {
            targetEntity.fields[fieldExt.rename] = field
            delete targetEntity.fields[fieldName]
          }

          // Override field properties
          if (fieldExt.override) {
            Object.assign(field, fieldExt.override)
          }
        }
      }
    }
  }

  // Add new entities
  if (extension.addEntities) {
    if (!result.entities) result.entities = {}
    for (const [entityName, entityDef] of Object.entries(extension.addEntities)) {
      // Namespace the entity name
      result.entities[`${pluginId}_${entityName}`] = entityDef

      // Track as a new entity (no rename, but track for routing)
      renames.set(`${pluginId}_${entityName}`, {
        originalName: entityName,
        newName: `${pluginId}_${entityName}`,
        routePath: entityDef.routePath,
        internal: entityDef.internal,
      })
    }
  }

  return { schema: result, renames }
}

// -----------------------------------------------------------------------------
// Compute Base Path
// -----------------------------------------------------------------------------

function computeBasePath(meta: { id: string; basePath?: string | false }, extension?: PluginExtension): string {
  // Extension basePath takes precedence
  if (extension?.basePath !== undefined) {
    if (extension.basePath === false) return ""
    return extension.basePath.startsWith("/") ? extension.basePath : `/${extension.basePath}`
  }

  // Then meta basePath
  if (meta.basePath !== undefined) {
    if (meta.basePath === false) return ""
    return meta.basePath.startsWith("/") ? meta.basePath : `/${meta.basePath}`
  }

  // Default: "/" + plugin id
  return `/${meta.id}`
}

// -----------------------------------------------------------------------------
// Resolve Plugin
// Applies extension and converts to Nevr-compatible format
// -----------------------------------------------------------------------------

export function resolvePlugin(plugin: NevrPlugin): ResolvedPlugin {
  const { meta, schema, extension, lifecycle } = plugin

  // Compute the base path for this plugin
  const basePath = computeBasePath(meta, extension)

  // Apply extension if provided
  let resolvedSchema = schema || { entities: {}, extend: {} }
  let entityRenames = new Map<string, EntityRenameInfo>()

  if (extension) {
    const result = applyExtension(resolvedSchema, extension, meta.id)
    resolvedSchema = result.schema
    entityRenames = result.renames
  }

  // Convert plugin entities to Nevr entities and build metadata
  const entities: Entity[] = []
  const entityMeta = new Map<string, ResolvedEntityMeta>()

  if (resolvedSchema.entities) {
    for (const [name, def] of Object.entries(resolvedSchema.entities)) {
      const entity = toNevrEntity(name, def)

      // Build entity metadata
      const renameInfo = entityRenames.get(name)
      const routeConfig = extension?.entityRoutes?.[name] || extension?.entityRoutes?.[renameInfo?.originalName || name]

      const isInternal = renameInfo?.internal ?? def.internal ?? false
      const entityRoutePath = renameInfo?.routePath || def.routePath

      // Attach plugin metadata directly to entity
      entity.plugin = {
        id: meta.id,
        basePath: basePath || undefined,
        routePath: entityRoutePath,
        internal: isInternal,
      }

      entities.push(entity)

      entityMeta.set(name, {
        originalName: renameInfo?.originalName || name,
        pluginId: meta.id,
        basePath,
        routePath: entityRoutePath,
        internal: isInternal,
        routeConfig,
      })
    }
  }

  // Resolve routes (can be array or factory)
  const resolvedRoutes: Route[] = []
  // Routes are resolved later when NevrInstance is available

  // Resolve middleware (can be array or factory)
  const resolvedMiddleware: Middleware[] = []
  // Middleware is resolved later when NevrInstance is available

  return {
    meta,
    basePath,
    entities,
    entityMeta,
    routes: resolvedRoutes,
    middleware: resolvedMiddleware,
    hooks: {},
    lifecycle: lifecycle || {},
    routeOverrides: extension?.routes,
    entityRoutes: extension?.entityRoutes,
  }
}

// -----------------------------------------------------------------------------
// Get Plugin Field Extensions
// Returns fields to add to developer's entities
// -----------------------------------------------------------------------------

export function getPluginFieldExtensions(
  plugin: NevrPlugin
): Map<string, Record<string, FieldDef>> {
  const extensions = new Map<string, Record<string, FieldDef>>()

  const schema = plugin.schema
  if (!schema?.extend) return extensions

  for (const [entityName, fields] of Object.entries(schema.extend)) {
    const nevrFields: Record<string, FieldDef> = {}

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      nevrFields[fieldName] = toNevrField(fieldDef)
    }

    extensions.set(entityName, nevrFields)
  }

  return extensions
}

// -----------------------------------------------------------------------------
// Merge Multiple Plugin Resolutions
// -----------------------------------------------------------------------------

export interface MergedPlugins {
  entities: Entity[]
  entityMeta: Map<string, ResolvedEntityMeta>
  routes: Route[]
  middleware: Middleware[]
}

export function mergeResolvedPlugins(plugins: ResolvedPlugin[]): MergedPlugins {
  const entities: Entity[] = []
  const entityMeta = new Map<string, ResolvedEntityMeta>()
  const routes: Route[] = []
  const middleware: Middleware[] = []

  for (const plugin of plugins) {
    entities.push(...plugin.entities)
    routes.push(...plugin.routes)
    middleware.push(...plugin.middleware)

    // Merge entity metadata
    for (const [name, meta] of plugin.entityMeta) {
      entityMeta.set(name, meta)
    }
  }

  return { entities, entityMeta, routes, middleware }
}

// -----------------------------------------------------------------------------
// Helper: Get full route path for an entity
// -----------------------------------------------------------------------------

export function getEntityRoutePath(
  entityName: string,
  entityMeta: Map<string, ResolvedEntityMeta>,
  pluralize: (s: string) => string
): string {
  const meta = entityMeta.get(entityName)

  if (!meta) {
    // Not a plugin entity - use root path
    return `/${pluralize(entityName)}`
  }

  // Use custom route path or pluralized name
  const entityPath = meta.routePath || pluralize(entityName)

  // Combine with base path
  if (meta.basePath) {
    return `${meta.basePath}/${entityPath}`
  }

  return `/${entityPath}`
}

// -----------------------------------------------------------------------------
// Helper: Check if entity route is disabled
// -----------------------------------------------------------------------------

export function isEntityRouteDisabled(
  entityName: string,
  operation: "list" | "create" | "read" | "update" | "delete",
  entityMeta: Map<string, ResolvedEntityMeta>
): boolean {
  const meta = entityMeta.get(entityName)

  if (!meta) return false
  if (meta.internal) return true

  const routeConfig = meta.routeConfig?.[operation]
  if (!routeConfig) return false

  if (routeConfig === "disable") return true
  if (typeof routeConfig === "object" && routeConfig.disable) return true

  return false
}

// -----------------------------------------------------------------------------
// Helper: Get custom route handler for an entity operation
// -----------------------------------------------------------------------------

export function getEntityRouteHandler(
  entityName: string,
  operation: "list" | "create" | "read" | "update" | "delete",
  entityMeta: Map<string, ResolvedEntityMeta>
): ((req: any, nevr: any) => Promise<any>) | undefined {
  const meta = entityMeta.get(entityName)

  if (!meta) return undefined

  const routeConfig = meta.routeConfig?.[operation]
  if (!routeConfig) return undefined

  if (typeof routeConfig === "function") return routeConfig
  if (typeof routeConfig === "object" && routeConfig.handler) return routeConfig.handler

  return undefined
}
