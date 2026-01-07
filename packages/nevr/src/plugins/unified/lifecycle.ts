// =============================================================================
// UNIFIED LIFECYCLE MANAGER
// Manages plugin lifecycle across all phases
// =============================================================================

import type { NevrInstance, NevrRequest } from "../../types.js"
import type { UnifiedPlugin, LifecycleHooks, Interceptor, InterceptorContext, PluginDependency, DependencySpec } from "./types.js"
import { normalizePlugin, validateUnifiedPlugin } from "./compat.js"
import { getLogger } from "../../logger.js"

// -----------------------------------------------------------------------------
// Lifecycle Manager Class
// -----------------------------------------------------------------------------

export class LifecycleManager {
    private plugins: UnifiedPlugin[] = []
    private initialized = new Set<string>()
    private errors = new Map<string, Error>()

    /**
     * Register a plugin
     */
    async register(plugin: UnifiedPlugin, nevr: NevrInstance): Promise<void> {
        const id = plugin.meta.id

        // Validate plugin
        const errors = validateUnifiedPlugin(plugin)
        if (errors.length > 0) {
            throw new Error(`[${id}] Plugin validation failed: ${errors.join(", ")}`)
        }

        // Check for duplicates
        if (this.plugins.some(p => p.meta.id === id)) {
            throw new Error(`[${id}] Plugin already registered`)
        }

        // Call onRegister hook
        try {
            if (plugin.lifecycle?.onRegister) {
                await plugin.lifecycle.onRegister(nevr)
            }

            this.plugins.push(plugin)
        } catch (error) {
            this.errors.set(id, error as Error)
            throw new Error(`[${id}] onRegister failed: ${(error as Error).message}`)
        }
    }

    /**
     * Initialize all registered plugins
     * Respects dependency order
     */
    async initialize(nevr: NevrInstance): Promise<void> {
        // Sort by dependencies (topological sort)
        const sorted = this.topologicalSort()

        for (const plugin of sorted) {
            const id = plugin.meta.id

            if (this.initialized.has(id)) {
                continue
            }

            try {
                // Call onInit hook
                if (plugin.lifecycle?.onInit) {
                    await plugin.lifecycle.onInit(nevr)
                }

                this.initialized.add(id)
            } catch (error) {
                this.errors.set(id, error as Error)
                throw new Error(`[${id}] onInit failed: ${(error as Error).message}`)
            }
        }
    }

    /**
     * Shutdown all plugins in reverse order
     */
    async shutdown(nevr: NevrInstance): Promise<void> {
        // Shutdown in reverse order
        const reversed = [...this.plugins].reverse()

        for (const plugin of reversed) {
            const id = plugin.meta.id

            try {
                if (plugin.lifecycle?.onShutdown) {
                    await plugin.lifecycle.onShutdown(nevr)
                }
            } catch (error) {
                getLogger().error(`[${id}] onShutdown failed:`, error)
                // Don't throw - continue shutting down other plugins
            }
        }
    }

    /**
     * Execute onRequest hook for all plugins
     */
    async onRequest(req: NevrRequest, nevr: NevrInstance): Promise<void> {
        for (const plugin of this.plugins) {
            try {
                if (plugin.lifecycle?.onRequest) {
                    await plugin.lifecycle.onRequest(req, nevr)
                }
            } catch (error) {
                getLogger().error(`[${plugin.meta.id}] onRequest failed:`, error)
                // Continue with other plugins
            }
        }
    }

    /**
     * Execute onError hook for all plugins
     */
    async onError(error: Error, req: NevrRequest, nevr: NevrInstance): Promise<void> {
        for (const plugin of this.plugins) {
            try {
                if (plugin.lifecycle?.onError) {
                    await plugin.lifecycle.onError(error, req, nevr)
                }
            } catch (hookError) {
                getLogger().error(`[${plugin.meta.id}] onError hook failed:`, hookError)
                // Continue with other plugins
            }
        }
    }

    /**
     * Execute before interceptors for a request
     */
    async executeBeforeInterceptors(ctx: InterceptorContext): Promise<void> {
        for (const plugin of this.plugins) {
            if (!plugin.interceptors?.before) continue

            for (const interceptor of plugin.interceptors.before) {
                if (this.matchesPath(interceptor, ctx)) {
                    try {
                        await interceptor.handler(ctx)
                    } catch (error) {
                        getLogger().error(`[${plugin.meta.id}] Before interceptor failed:`, error)
                        throw error
                    }
                }
            }
        }
    }

    /**
     * Execute after interceptors for a request
     */
    async executeAfterInterceptors(ctx: InterceptorContext): Promise<void> {
        // Execute in reverse order
        const reversed = [...this.plugins].reverse()

        for (const plugin of reversed) {
            if (!plugin.interceptors?.after) continue

            for (const interceptor of plugin.interceptors.after) {
                if (this.matchesPath(interceptor, ctx)) {
                    try {
                        await interceptor.handler(ctx)
                    } catch (error) {
                        getLogger().error(`[${plugin.meta.id}] After interceptor failed:`, error)
                        // Don't throw - after interceptors shouldn't break response
                    }
                }
            }
        }
    }

    /**
     * Get all registered plugins
     */
    getPlugins(): UnifiedPlugin[] {
        return [...this.plugins]
    }

    /**
     * Get plugin by ID
     */
    getPlugin(id: string): UnifiedPlugin | undefined {
        return this.plugins.find(p => p.meta.id === id)
    }

    /**
     * Check if plugin is initialized
     */
    isInitialized(id: string): boolean {
        return this.initialized.has(id)
    }

    /**
     * Get error for a plugin (if any)
     */
    getError(id: string): Error | undefined {
        return this.errors.get(id)
    }

    /**
     * Clear all plugins (for testing)
     */
    clear(): void {
        this.plugins = []
        this.initialized.clear()
        this.errors.clear()
    }

    /**
     * Hot reload a plugin with new options
     */
    async hotReload(pluginId: string, newOptions: any, nevr: NevrInstance): Promise<boolean> {
        const plugin = this.getPlugin(pluginId)
        if (!plugin) {
            throw new Error(`[${pluginId}] Plugin not found for hot reload`)
        }

        if (!plugin.lifecycle?.onHotReload) {
            getLogger().warn(`[${pluginId}] Plugin does not support hot reload (no onHotReload hook)`)
            return false
        }

        try {
            await plugin.lifecycle.onHotReload(nevr, newOptions)
            // Update options on the plugin
            plugin.options = { ...plugin.options, ...newOptions }
            return true
        } catch (error) {
            getLogger().error(`[${pluginId}] Hot reload failed:`, error)
            throw error
        }
    }

    /**
     * Hot reload all plugins supporting it
     */
    async hotReloadAll(newOptionsMap: Record<string, any>, nevr: NevrInstance): Promise<Map<string, boolean>> {
        const results = new Map<string, boolean>()

        for (const [pluginId, newOptions] of Object.entries(newOptionsMap)) {
            try {
                const success = await this.hotReload(pluginId, newOptions, nevr)
                results.set(pluginId, success)
            } catch (error) {
                results.set(pluginId, false)
            }
        }

        return results
    }

    /**
     * Get plugins that support hot reload
     */
    getHotReloadablePlugins(): UnifiedPlugin[] {
        return this.plugins.filter(p => p.lifecycle?.onHotReload)
    }

    // -------------------------------------------------------------------------
    // Private Methods
    // -------------------------------------------------------------------------

    /**
     * Check if interceptor matches the request path
     */
    private matchesPath(interceptor: Interceptor, ctx: InterceptorContext): boolean {
        const { matcher } = interceptor

        // String matcher - exact match or glob pattern
        if (typeof matcher === "string") {
            if (matcher.includes("*")) {
                // Simple glob matching
                const pattern = matcher.replace(/\*/g, ".*")
                const regex = new RegExp(`^${pattern}$`)
                return regex.test(ctx.path)
            }
            return ctx.path === matcher
        }

        // RegExp matcher
        if (matcher instanceof RegExp) {
            return matcher.test(ctx.path)
        }

        // Function matcher
        if (typeof matcher === "function") {
            try {
                return matcher(ctx)
            } catch (error) {
                getLogger().error("Interceptor matcher function failed:", error)
                return false
            }
        }

        return false
    }

    /**
     * Topological sort based on dependencies
     * Supports both simple string deps and rich dependency objects
     */
    private topologicalSort(): UnifiedPlugin[] {
        const sorted: UnifiedPlugin[] = []
        const visited = new Set<string>()
        const visiting = new Set<string>()

        const pluginMap = new Map(this.plugins.map(p => [p.meta.id, p]))

        const visit = (plugin: UnifiedPlugin) => {
            const id = plugin.meta.id

            if (visited.has(id)) return
            if (visiting.has(id)) {
                throw new Error(`[Nevr] Circular plugin dependency detected: ${id}`)
            }

            visiting.add(id)

            // Visit dependencies first
            const dependencies = plugin.meta.dependencies || []
            for (const depSpec of dependencies) {
                const { depId, version, optional } = this.parseDependency(depSpec)
                const dep = pluginMap.get(depId)

                if (dep) {
                    // Check version constraint if specified
                    if (version && version !== "*") {
                        this.checkVersionConstraint(id, depId, dep.meta.version, version)
                    }
                    visit(dep)
                } else if (!optional) {
                    // Only throw for required dependencies
                    throw new Error(`[${id}] depends on missing plugin "${depId}"`)
                } else {
                    // Optional dependency not found - that's okay
                    getLogger().debug(`[${id}] Optional dependency "${depId}" not found (skipping)`)
                }
            }

            visiting.delete(id)
            visited.add(id)
            sorted.push(plugin)
        }

        for (const plugin of this.plugins) {
            visit(plugin)
        }

        return sorted
    }

    /**
     * Parse a dependency specification into its components
     */
    private parseDependency(dep: DependencySpec): { depId: string; version?: string; optional: boolean } {
        if (typeof dep === "string") {
            return { depId: dep, version: undefined, optional: false }
        }
        return {
            depId: dep.id,
            version: dep.version,
            optional: dep.optional ?? false,
        }
    }

    /**
     * Check if a plugin version satisfies a version constraint
     * Supports basic semver patterns: ^, ~, >=, <=, >, <, =
     */
    private checkVersionConstraint(
        dependentId: string,
        dependencyId: string,
        actualVersion: string,
        constraint: string
    ): void {
        // Parse versions
        const parseVersion = (v: string): number[] => {
            const clean = v.replace(/^[~^>=<]+/, "")
            return clean.split(".").map(n => parseInt(n, 10) || 0)
        }

        const actual = parseVersion(actualVersion)
        const required = parseVersion(constraint)

        // Determine comparison operation
        let satisfies = false

        if (constraint.startsWith("^")) {
            // Caret: compatible with version (same major)
            satisfies = actual[0] === required[0] && this.compareVersions(actual, required) >= 0
        } else if (constraint.startsWith("~")) {
            // Tilde: approximately equivalent (same major.minor)
            satisfies = actual[0] === required[0] && actual[1] === required[1] && actual[2] >= required[2]
        } else if (constraint.startsWith(">=")) {
            satisfies = this.compareVersions(actual, required) >= 0
        } else if (constraint.startsWith("<=")) {
            satisfies = this.compareVersions(actual, required) <= 0
        } else if (constraint.startsWith(">")) {
            satisfies = this.compareVersions(actual, required) > 0
        } else if (constraint.startsWith("<")) {
            satisfies = this.compareVersions(actual, required) < 0
        } else {
            // Exact match
            satisfies = actual[0] === required[0] && actual[1] === required[1] && actual[2] === required[2]
        }

        if (!satisfies) {
            throw new Error(
                `[${dependentId}] requires "${dependencyId}" version ${constraint}, ` +
                `but found version ${actualVersion}`
            )
        }
    }

    /**
     * Compare two version arrays
     * Returns: -1 if a < b, 0 if a == b, 1 if a > b
     */
    private compareVersions(a: number[], b: number[]): number {
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const av = a[i] || 0
            const bv = b[i] || 0
            if (av < bv) return -1
            if (av > bv) return 1
        }
        return 0
    }
}

// -----------------------------------------------------------------------------
// Global Lifecycle Manager Instance
// -----------------------------------------------------------------------------

let globalLifecycleManager: LifecycleManager | null = null

/**
 * Get or create the global lifecycle manager
 */
export function getLifecycleManager(): LifecycleManager {
    if (!globalLifecycleManager) {
        globalLifecycleManager = new LifecycleManager()
    }
    return globalLifecycleManager
}

/**
 * Set a custom lifecycle manager (for testing)
 */
export function setLifecycleManager(manager: LifecycleManager): void {
    globalLifecycleManager = manager
}

/**
 * Clear the global lifecycle manager
 */
export function clearLifecycleManager(): void {
    globalLifecycleManager = null
}

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

/**
 * Register and initialize multiple plugins
 */
export async function registerAndInitializePlugins(
    plugins: any[],
    nevr: NevrInstance
): Promise<UnifiedPlugin[]> {
    const manager = getLifecycleManager()
    const normalized: UnifiedPlugin[] = []

    // Normalize all plugins first
    for (const plugin of plugins) {
        const unified = normalizePlugin(plugin)
        normalized.push(unified)
    }

    // Register all
    for (const plugin of normalized) {
        await manager.register(plugin, nevr)
    }

    // Initialize all
    await manager.initialize(nevr)

    return normalized
}

/**
 * Execute plugin lifecycle hook
 */
export async function executeLifecycleHook(
    hookName: keyof LifecycleHooks,
    ...args: any[]
): Promise<void> {
    const manager = getLifecycleManager()
    const plugins = manager.getPlugins()

    for (const plugin of plugins) {
        const hook = plugin.lifecycle?.[hookName]
        if (hook) {
            try {
                await (hook as any)(...args)
            } catch (error) {
                getLogger().error(`[${plugin.meta.id}] ${hookName} failed:`, error)
                if (hookName !== "onError") {
                    throw error
                }
            }
        }
    }
}
