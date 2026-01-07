// =============================================================================
// PLUGIN REGISTRY
// Essential plugin management functions
// Delegates to unified/runtime.ts as the single source of truth
// =============================================================================

import type { NevrInstance } from "../../types.js"
import type { NevrPlugin, ResolvedPlugin, PluginFactory } from "./contract.js"
import { resolvePlugin } from "./resolver.js"
import {
    registerPlugin as unifiedRegisterPlugin,
    getPlugin as unifiedGetPlugin,
    listPlugins as unifiedListPlugins,
    clearPluginRegistry as unifiedClearPluginRegistry,
    initializePlugins as unifiedInitializePlugins,
} from "../unified/runtime.js"

// -----------------------------------------------------------------------------
// Initialization State Tracking
// -----------------------------------------------------------------------------

const initializationState = new Map<string, { initialized: boolean; error?: Error }>()

// -----------------------------------------------------------------------------
// Plugin Instance Management
// -----------------------------------------------------------------------------

/**
 * Register a plugin instance
 */
export function registerPluginInstance(plugin: NevrPlugin): void {
    const id = plugin.meta.id

    if (unifiedGetPlugin(id)) {
        throw new Error(`[Nevr] Plugin "${id}" is already registered`)
    }

    unifiedRegisterPlugin(plugin as any)
    initializationState.set(id, { initialized: false })
}

/**
 * Get a registered plugin instance
 */
export function getPluginInstance(id: string): NevrPlugin | undefined {
    return unifiedGetPlugin(id) as NevrPlugin | undefined
}

/**
 * Get a plugin's entity reference by plugin.entity format
 */
export function getPluginEntity(ref: string): { pluginId: string; entityName: string } | undefined {
    const [pluginId, entityName] = ref.split(".")
    if (!pluginId || !entityName) return undefined

    const plugin = unifiedGetPlugin(pluginId)
    if (!plugin) return undefined

    return { pluginId, entityName }
}

/**
 * Mark plugin as initialized
 */
export function markPluginInitialized(id: string): void {
    const state = initializationState.get(id)
    if (state) {
        state.initialized = true
    }
}

/**
 * Check if plugin is initialized
 */
export function isPluginInitialized(id: string): boolean {
    return initializationState.get(id)?.initialized || false
}

/**
 * Get all registered plugins
 */
export function getAllPlugins(): NevrPlugin[] {
    return unifiedListPlugins() as NevrPlugin[]
}

/**
 * Clear registry (for testing)
 */
export function clearPluginRegistry(): void {
    unifiedClearPluginRegistry()
    initializationState.clear()
}

// -----------------------------------------------------------------------------
// Plugin Resolution
// -----------------------------------------------------------------------------

/**
 * Resolve all registered plugins
 */
export function resolveAllPlugins(): ResolvedPlugin[] {
    const resolved: ResolvedPlugin[] = []
    const plugins = unifiedListPlugins()

    for (const plugin of plugins) {
        resolved.push(resolvePlugin(plugin as NevrPlugin))
    }

    return resolved
}

// -----------------------------------------------------------------------------
// Plugin Initialization
// -----------------------------------------------------------------------------

/**
 * Initialize all registered plugins with dependency ordering
 */
export async function initializeAllPlugins(nevr: NevrInstance): Promise<void> {
    const sorted = topologicalSort(getAllPlugins())

    for (const plugin of sorted) {
        const id = plugin.meta.id

        try {
            if (plugin.lifecycle?.onRegister) {
                await plugin.lifecycle.onRegister(nevr)
            }

            if (plugin.lifecycle?.onInit) {
                await plugin.lifecycle.onInit(nevr)
            }

            markPluginInitialized(id)
        } catch (error) {
            const state = initializationState.get(id)
            if (state) {
                state.error = error as Error
            }
            throw new Error(`[Nevr] Failed to initialize plugin "${id}": ${(error as Error).message}`)
        }
    }
}

// -----------------------------------------------------------------------------
// Dependency Resolution
// -----------------------------------------------------------------------------

function topologicalSort(plugins: NevrPlugin[]): NevrPlugin[] {
    const sorted: NevrPlugin[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const pluginMap = new Map(plugins.map(p => [p.meta.id, p]))

    function visit(plugin: NevrPlugin) {
        const id = plugin.meta.id

        if (visited.has(id)) return
        if (visiting.has(id)) {
            throw new Error(`[Nevr] Circular plugin dependency detected: ${id}`)
        }

        visiting.add(id)

        for (const depId of plugin.meta.dependencies || []) {
            const dep = pluginMap.get(depId)
            if (dep) {
                visit(dep)
            } else {
                throw new Error(`[Nevr] Plugin "${id}" depends on missing plugin "${depId}"`)
            }
        }

        visiting.delete(id)
        visited.add(id)
        sorted.push(plugin)
    }

    for (const plugin of plugins) {
        visit(plugin)
    }

    return sorted
}

// -----------------------------------------------------------------------------
// Plugin Validation
// -----------------------------------------------------------------------------

export function validatePlugin(plugin: NevrPlugin): string[] {
    const errors: string[] = []

    if (!plugin.meta?.id) {
        errors.push("Plugin must have meta.id")
    }

    if (!plugin.meta?.name) {
        errors.push("Plugin must have meta.name")
    }

    if (!plugin.meta?.version) {
        errors.push("Plugin must have meta.version")
    }

    if (plugin.meta?.id && !/^[a-z][a-z0-9-]*$/.test(plugin.meta.id)) {
        errors.push("Plugin ID must be lowercase alphanumeric with hyphens, starting with a letter")
    }

    const reserved = ["nevr", "core", "system"]
    if (plugin.meta?.id && reserved.includes(plugin.meta.id)) {
        errors.push(`Plugin ID "${plugin.meta.id}" is reserved`)
    }

    return errors
}
