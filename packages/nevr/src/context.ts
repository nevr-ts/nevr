// =============================================================================
// NEVR CONTEXT
// Consolidated global state management for better testability and isolation
// =============================================================================

import type { NamedRule } from "./rules.js"
import type { Plugin } from "./types.js"
import { ServiceContainer } from "./container.js"
import { LifecycleManager } from "./plugins/unified/lifecycle.js"
import type { UnifiedPlugin } from "./plugins/unified/types.js"
import type { NevrPlugin, PluginFactory, ResolvedPlugin } from "./plugins/core/contract.js"
import { resolvePlugin } from "./plugins/core/resolver.js"
import { normalizePlugin, validateUnifiedPlugin, detectPluginType } from "./plugins/unified/facade.js"
import type { AnyPlugin } from "./plugins/unified/facade.js"

// -----------------------------------------------------------------------------
// Rule Registry (Encapsulated)
// -----------------------------------------------------------------------------

/**
 * Registry for managing named rules with support for introspection
 * Previously was a global Map, now encapsulated in context
 */
export class RuleRegistry {
    private rules = new Map<string, NamedRule>()

    /**
     * Register a named rule
     */
    register(name: string, rule: NamedRule): void {
        this.rules.set(name, rule)
    }

    /**
     * Get a rule by name
     */
    get(name: string): NamedRule | undefined {
        return this.rules.get(name)
    }

    /**
     * Get all registered rules (returns a copy)
     */
    getAll(): Map<string, NamedRule> {
        return new Map(this.rules)
    }

    /**
     * Check if a rule exists
     */
    has(name: string): boolean {
        return this.rules.has(name)
    }

    /**
     * Clear all rules
     */
    clear(): void {
        this.rules.clear()
    }
}

// -----------------------------------------------------------------------------
// Plugin Manager (Encapsulated)
// Combines core registry and unified lifecycle manager
// -----------------------------------------------------------------------------

interface PluginRegistryEntry {
    plugin: NevrPlugin
    initialized: boolean
    error?: Error
}

/**
 * Unified plugin manager that consolidates:
 * - Core plugin registry (plugins/core/registry.ts)
 * - Plugin factories (plugins/core/registry.ts)
 * - Entity cache (plugins/core/reference.ts)
 * - Lifecycle manager (plugins/unified/lifecycle.ts)
 */
export class PluginManager {
    private registry = new Map<string, PluginRegistryEntry>()
    private factories = new Map<string, PluginFactory>()
    private entityCache = new Map<string, any>()
    private lifecycleManager = new LifecycleManager()

    // -------------------------------------------------------------------------
    // Factory Registration
    // -------------------------------------------------------------------------

    /**
     * Register a plugin factory (e.g., registerFactory("auth", authPlugin))
     */
    registerFactory<T>(id: string, factory: PluginFactory<T>): void {
        if (this.factories.has(id)) {
            throw new Error(`[Nevr] Plugin factory "${id}" is already registered`)
        }
        this.factories.set(id, factory as PluginFactory)
    }

    /**
     * Get a plugin factory by ID
     */
    getFactory(id: string): PluginFactory | undefined {
        return this.factories.get(id)
    }

    /**
     * Create a plugin instance from a registered factory
     */
    createFromFactory<T>(id: string, options?: T): NevrPlugin<T> | undefined {
        const factory = this.factories.get(id)
        if (!factory) return undefined
        return factory(options) as NevrPlugin<T>
    }

    // -------------------------------------------------------------------------
    // Instance Registration
    // -------------------------------------------------------------------------

    /**
     * Register any plugin (legacy, new, or unified)
     * This is the **recommended** method for registering plugins.
     * 
     * Automatically:
     * - Detects plugin type
     * - Normalizes to UnifiedPlugin
     * - Validates the plugin
     * - Stores in registry
     * 
     * @throws Error if plugin is invalid or already registered
     */
    register(plugin: AnyPlugin): UnifiedPlugin {
        const type = detectPluginType(plugin)
        if (type === "unknown") {
            throw new Error("[Nevr] Unknown plugin format")
        }

        const normalized = normalizePlugin(plugin)
        const errors = validateUnifiedPlugin(normalized)

        if (errors.length > 0) {
            throw new Error(`[Nevr] Invalid plugin "${normalized.meta.id}": ${errors.join(", ")}`)
        }

        const id = normalized.meta.id
        if (this.registry.has(id)) {
            throw new Error(`[Nevr] Plugin "${id}" is already registered`)
        }

        // Store as NevrPlugin (compatible type)
        this.registry.set(id, {
            plugin: normalized as unknown as NevrPlugin,
            initialized: false
        })

        return normalized
    }

    /**
     * Register a new-style NevrPlugin instance directly
     * @deprecated Use register() instead - it handles all plugin types
     */
    registerInstance(plugin: NevrPlugin): void {
        const id = plugin.meta.id
        if (this.registry.has(id)) {
            throw new Error(`[Nevr] Plugin "${id}" is already registered`)
        }
        this.registry.set(id, { plugin, initialized: false })
    }

    /**
     * Get a registered plugin instance
     */
    getInstance(id: string): NevrPlugin | undefined {
        return this.registry.get(id)?.plugin
    }

    /**
     * Get all registered plugins
     */
    getAllInstances(): NevrPlugin[] {
        return Array.from(this.registry.values()).map(e => e.plugin)
    }

    /**
     * Mark a plugin as initialized
     */
    markInitialized(id: string): void {
        const entry = this.registry.get(id)
        if (entry) {
            entry.initialized = true
        }
    }

    /**
     * Check if plugin is initialized
     */
    isInitialized(id: string): boolean {
        return this.registry.get(id)?.initialized ?? false
    }

    // -------------------------------------------------------------------------
    // Entity Resolution
    // -------------------------------------------------------------------------

    /**
     * Get plugin entity reference (e.g., "auth.user")
     */
    getEntityRef(ref: string): { pluginId: string; entityName: string } | undefined {
        const [pluginId, entityName] = ref.split(".")
        if (!pluginId || !entityName) return undefined

        if (!this.registry.has(pluginId)) return undefined
        return { pluginId, entityName }
    }

    /**
     * Cache an entity for quick lookup
     */
    cacheEntity(key: string, entity: any): void {
        this.entityCache.set(key, entity)
    }

    /**
     * Get cached entity
     */
    getCachedEntity(key: string): any | undefined {
        return this.entityCache.get(key)
    }

    // -------------------------------------------------------------------------
    // Plugin Resolution
    // -------------------------------------------------------------------------

    /**
     * Resolve all registered plugins to their final form
     */
    resolveAll(): ResolvedPlugin[] {
        const resolved: ResolvedPlugin[] = []
        for (const entry of this.registry.values()) {
            resolved.push(resolvePlugin(entry.plugin))
        }
        return resolved
    }

    // -------------------------------------------------------------------------
    // Lifecycle Management
    // -------------------------------------------------------------------------

    /**
     * Get the lifecycle manager for unified plugins
     */
    getLifecycleManager(): LifecycleManager {
        return this.lifecycleManager
    }

    /**
     * Register a unified plugin with lifecycle management
     */
    async registerUnified(plugin: UnifiedPlugin, nevr: any): Promise<void> {
        await this.lifecycleManager.register(plugin, nevr)
    }

    /**
     * Initialize all unified plugins
     */
    async initializeUnified(nevr: any): Promise<void> {
        await this.lifecycleManager.initialize(nevr)
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    /**
     * Clear all plugin state (for testing)
     */
    clear(): void {
        this.registry.clear()
        this.factories.clear()
        this.entityCache.clear()
        this.lifecycleManager.clear()
    }
}

// -----------------------------------------------------------------------------
// NevrContext - Consolidated Global State
// -----------------------------------------------------------------------------

/**
 * NevrContext encapsulates all global state for a Nevr instance.
 * 
 * Benefits:
 * - **Test Isolation**: Each test can have its own context
 * - **Explicit Dependencies**: No hidden global state
 * - **Multiple Instances**: Run multiple Nevr instances if needed
 * 
 * @example
 * ```typescript
 * // Production: Let nevr() create default context
 * const api = nevr({ entities: [...] })
 * 
 * // Testing: Create isolated context
 * const ctx = createNevrContext()
 * const api = nevr({ context: ctx, entities: [...] })
 * 
 * afterEach(() => {
 *   ctx.clear() // One call clears everything
 * })
 * ```
 */
export interface NevrContext {
    /** Service container for dependency injection */
    services: ServiceContainer
    /** Rule registry for named authorization rules */
    rules: RuleRegistry
    /** Plugin manager for plugin lifecycle and resolution */
    plugins: PluginManager
}

/**
 * Create a new, isolated NevrContext
 * 
 * Use this for:
 * - Test isolation (each test gets fresh state)
 * - Multiple Nevr instances (rare but possible)
 * - Custom configurations
 */
export function createNevrContext(): NevrContext {
    return {
        services: new ServiceContainer(),
        rules: new RuleRegistry(),
        plugins: new PluginManager(),
    }
}

// -----------------------------------------------------------------------------
// Global Context (Backward Compatibility)
// These provide backward compatibility with existing code
// Will be deprecated in v2.0
// -----------------------------------------------------------------------------

let globalContext: NevrContext | null = null

/**
 * Get or create the global context
 * @deprecated Use createNevrContext() and pass to nevr() instead
 */
export function getGlobalContext(): NevrContext {
    if (!globalContext) {
        globalContext = createNevrContext()
    }
    return globalContext
}

/**
 * Set a custom global context
 * @deprecated Use createNevrContext() and pass to nevr() instead
 */
export function setGlobalContext(context: NevrContext): void {
    globalContext = context
}

/**
 * Clear the global context (for testing)
 */
export function clearGlobalContext(): void {
    if (globalContext) {
        globalContext.services.clear()
        globalContext.rules.clear()
        globalContext.plugins.clear()
    }
    globalContext = null
}
