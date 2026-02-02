// =============================================================================
// PLUGIN COMPATIBILITY LAYER
// Type detection and validation for unified plugins
// =============================================================================

import type { Entity, FieldDef } from "../../types.js"
import type { NevrPlugin as NewPlugin } from "../core/contract.js"
import type {
    UnifiedPlugin,
    UnifiedPluginMeta,
    LifecycleHooks,
    EntityHooks,
    RequestInterceptors,
    PluginSchema,
    FieldDefinition,
    EntityDefinition,
} from "./types.js"

// -----------------------------------------------------------------------------
// Type Guards
// -----------------------------------------------------------------------------

/**
 * Detect if a plugin is a valid unified/new plugin
 */
export function isNewPlugin(plugin: any): plugin is NewPlugin {
    if (!plugin || typeof plugin !== "object") return false

    // New plugins have meta.id as required field
    return (
        "meta" in plugin &&
        plugin.meta &&
        typeof plugin.meta === "object" &&
        "id" in plugin.meta &&
        typeof plugin.meta.id === "string"
    )
}

/**
 * Detect if already unified (same check as isNewPlugin)
 */
export function isUnifiedPlugin(plugin: any): plugin is UnifiedPlugin {
    return isNewPlugin(plugin)
}

// -----------------------------------------------------------------------------
// Plugin Normalization
// -----------------------------------------------------------------------------

/**
 * Convert FieldDef to FieldDefinition
 */
function fieldDefToDefinition(field: FieldDef): FieldDefinition {
    return {
        type: field.type,
        required: !field.optional,
        unique: field.unique || false,
        default: field.default,
        references: field.relation ? {
            entity: field.relation.entity().name,
            field: field.relation.references,
        } : undefined,
        locked: false,
        input: true,
        returned: true,
        sortable: false,
        index: false,
    }
}

/**
 * Normalize a new-style plugin to unified interface
 */
export function normalizeNewPlugin(modern: NewPlugin): UnifiedPlugin {
    const lifecycle: LifecycleHooks = {
        onRegister: modern.lifecycle?.onRegister,
        onInit: modern.lifecycle?.onInit || (modern.init ? async (nevr) => {
            await modern.init?.({ nevr, driver: (nevr as any).driver } as any)
        } : undefined),
        onRequest: modern.lifecycle?.onRequest,
        onResponse: modern.lifecycle?.onResponse,
        onError: modern.lifecycle?.onError,
        onShutdown: modern.lifecycle?.onShutdown,
    }

    // Convert requestHooks to interceptors OR preserve existing interceptors
    let interceptors: RequestInterceptors | undefined
    if (modern.requestHooks) {
        interceptors = {
            before: modern.requestHooks.before?.map(hook => ({
                matcher: hook.matcher as any,
                handler: hook.handler as any,
            })),
            after: modern.requestHooks.after?.map(hook => ({
                matcher: hook.matcher as any,
                handler: hook.handler as any,
            })),
        }
    } else if ((modern as any).interceptors) {
        // Preserve existing interceptors if already present
        interceptors = (modern as any).interceptors
    }

    // Convert databaseHooks to entityHooks
    let entityHooks: EntityHooks | undefined
    if (modern.databaseHooks) {
        entityHooks = {}
        for (const [entityName, hooks] of Object.entries(modern.databaseHooks)) {
            if (!hooks) continue

            entityHooks[entityName] = {
                create: hooks.create as any,
                update: hooks.update as any,
                delete: hooks.delete as any,
            }
        }
    }

    return {
        meta: modern.meta as UnifiedPluginMeta,
        schema: modern.schema as PluginSchema,
        migrations: modern.migrations,
        lifecycle,
        interceptors,
        entityHooks,
        options: modern.options,
        extension: modern.extension as any,
        endpoints: modern.endpoints as any,
        $Infer: modern.$Infer,
        $ErrorCodes: modern.$ERROR_CODES,
        rateLimit: modern.rateLimit,
    }
}

// -----------------------------------------------------------------------------
// Universal Normalizer
// -----------------------------------------------------------------------------

/**
 * Normalize any plugin to unified interface
 */
export function normalizePlugin(plugin: NewPlugin | UnifiedPlugin): UnifiedPlugin {
    // If already unified, normalize it
    if (isUnifiedPlugin(plugin)) {
        return normalizeNewPlugin(plugin as NewPlugin)
    }

    throw new Error("[Nevr] Unknown plugin format - must have meta.id")
}

/**
 * Normalize multiple plugins
 */
export function normalizePlugins(plugins: readonly (NewPlugin | UnifiedPlugin)[]): UnifiedPlugin[] {
    return plugins.map(normalizePlugin)
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

/**
 * Validate a unified plugin
 */
export function validateUnifiedPlugin(plugin: UnifiedPlugin): string[] {
    const errors: string[] = []

    // Required fields
    if (!plugin.meta?.id) {
        errors.push("Plugin must have meta.id")
    }

    if (!plugin.meta?.name) {
        errors.push("Plugin must have meta.name")
    }

    if (!plugin.meta?.version) {
        errors.push("Plugin must have meta.version")
    }

    // ID format
    if (plugin.meta?.id && !/^[a-z][a-z0-9-]*$/.test(plugin.meta.id)) {
        errors.push("Plugin ID must be lowercase alphanumeric with hyphens, starting with a letter")
    }

    // Reserved IDs
    const reserved = ["nevr", "core", "system", "unified"]
    if (plugin.meta?.id && reserved.includes(plugin.meta.id)) {
        errors.push(`Plugin ID "${plugin.meta.id}" is reserved`)
    }

    return errors
}
