// =============================================================================
// SERVICE CONTAINER (Pillar 3: Functional DI)
// Typed dependency injection for NEVR
// Enables plugins to register services and resolve them at runtime
//
// Architecture:
// - Services are registered with factories (lazy instantiation)
// - Singleton (default) or transient lifecycle
// - Scoped lifecycle for per-request services
// - Circular dependency detection
// - Type-safe resolution with generics
// =============================================================================

import type { Driver } from "./types.js"
import { getLogger } from "./logger.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Service factory function
 * Receives the container context for resolving dependencies
 */
export type ServiceFactory<T> = (ctx: ServiceContext) => T | Promise<T>

/**
 * Service registration options
 */
export interface ServiceOptions {
  /** Service lifecycle: singleton (default), transient, or scoped (per-request) */
  lifecycle?: "singleton" | "transient" | "scoped"
  /** Optional description for debugging */
  description?: string
  /** Tags for grouping services */
  tags?: string[]
  /** Priority for ordering (higher = earlier initialization) */
  priority?: number
}

/**
 * Registered service definition
 */
interface ServiceDefinition<T = unknown> {
  factory: ServiceFactory<T>
  options: ServiceOptions
  instance?: T
  initialized: boolean
}

/**
 * Context passed to service factories
 */
export interface ServiceContext {
  /** Resolve another service by ID */
  resolve: <T = unknown>(serviceId: string) => T
  /** Async resolve for services that need initialization */
  resolveAsync: <T = unknown>(serviceId: string) => Promise<T>
  /** Get the database driver */
  driver: Driver
  /** Check if a service exists */
  has: (serviceId: string) => boolean
  /** Get all service IDs */
  getServiceIds: () => string[]
  /** Get services by tag */
  getByTag: (tag: string) => string[]
}

/**
 * Service registry interface for typed service resolution
 */
export interface ServiceRegistry {
  [key: string]: unknown
}

/**
 * Typed resolver function
 */
export type TypedResolver<TRegistry extends ServiceRegistry> = <K extends keyof TRegistry>(
  serviceId: K
) => TRegistry[K]

// -----------------------------------------------------------------------------
// Service Container
// -----------------------------------------------------------------------------

export class ServiceContainer {
  private services = new Map<string, ServiceDefinition>()
  private driver: Driver | null = null
  private initializing = new Set<string>()

  /**
   * Set the database driver
   */
  setDriver(driver: Driver): void {
    this.driver = driver
  }

  /**
   * Register a service with a factory function
   */
  register<T>(
    serviceId: string,
    factory: ServiceFactory<T>,
    options: ServiceOptions = {}
  ): this {
    if (this.services.has(serviceId)) {
      getLogger().warn(`[ServiceContainer] Service "${serviceId}" is being overwritten`)
    }

    this.services.set(serviceId, {
      factory,
      options: { lifecycle: "singleton", ...options },
      initialized: false,
    })

    return this
  }

  /**
   * Register a service instance directly (already instantiated)
   */
  registerInstance<T>(serviceId: string, instance: T, options: ServiceOptions = {}): this {
    this.services.set(serviceId, {
      factory: () => instance,
      options: { lifecycle: "singleton", ...options },
      instance,
      initialized: true,
    })

    return this
  }

  /**
   * Register multiple services at once
   */
  registerMany(
    services: Record<string, ServiceFactory<unknown> | { factory: ServiceFactory<unknown>; options?: ServiceOptions }>
  ): this {
    for (const [id, factoryOrConfig] of Object.entries(services)) {
      if (typeof factoryOrConfig === "function") {
        this.register(id, factoryOrConfig)
      } else {
        this.register(id, factoryOrConfig.factory, factoryOrConfig.options)
      }
    }

    return this
  }

  /**
   * Check if a service is registered
   */
  has(serviceId: string): boolean {
    return this.services.has(serviceId)
  }

  /**
   * Get all registered service IDs
   */
  getServiceIds(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * Get services by tag
   */
  getByTag(tag: string): string[] {
    const result: string[] = []

    for (const [id, def] of this.services) {
      if (def.options.tags?.includes(tag)) {
        result.push(id)
      }
    }

    return result
  }

  /**
   * Synchronously resolve a service
   * Throws if service requires async initialization
   */
  resolve<T = unknown>(serviceId: string): T {
    const definition = this.services.get(serviceId)

    if (!definition) {
      throw new Error(`[ServiceContainer] Service "${serviceId}" not found. Available: ${this.getServiceIds().join(", ")}`)
    }

    // Return cached singleton
    if (definition.options.lifecycle === "singleton" && definition.initialized) {
      return definition.instance as T
    }

    // Check for circular dependency
    if (this.initializing.has(serviceId)) {
      throw new Error(`[ServiceContainer] Circular dependency detected: "${serviceId}"`)
    }

    this.initializing.add(serviceId)

    try {
      const ctx = this.createContext()
      const result = definition.factory(ctx)

      // If factory returns a promise, we can't resolve synchronously
      if (result instanceof Promise) {
        throw new Error(
          `[ServiceContainer] Service "${serviceId}" requires async initialization. Use resolveAsync() instead.`
        )
      }

      // Cache singleton
      if (definition.options.lifecycle === "singleton") {
        definition.instance = result
        definition.initialized = true
      }

      return result as T
    } finally {
      this.initializing.delete(serviceId)
    }
  }

  /**
   * Asynchronously resolve a service
   */
  async resolveAsync<T = unknown>(serviceId: string): Promise<T> {
    const definition = this.services.get(serviceId)

    if (!definition) {
      throw new Error(`[ServiceContainer] Service "${serviceId}" not found. Available: ${this.getServiceIds().join(", ")}`)
    }

    // Return cached singleton
    if (definition.options.lifecycle === "singleton" && definition.initialized) {
      return definition.instance as T
    }

    // Check for circular dependency
    if (this.initializing.has(serviceId)) {
      throw new Error(`[ServiceContainer] Circular dependency detected: "${serviceId}"`)
    }

    this.initializing.add(serviceId)

    try {
      const ctx = this.createContext()
      const result = await definition.factory(ctx)

      // Cache singleton
      if (definition.options.lifecycle === "singleton") {
        definition.instance = result
        definition.initialized = true
      }

      return result as T
    } finally {
      this.initializing.delete(serviceId)
    }
  }

  /**
   * Create a service context for factory functions
   */
  private createContext(): ServiceContext {
    if (!this.driver) {
      throw new Error("[ServiceContainer] Driver not set. Call setDriver() first.")
    }

    return {
      resolve: <T = unknown>(id: string) => this.resolve<T>(id),
      resolveAsync: <T = unknown>(id: string) => this.resolveAsync<T>(id),
      driver: this.driver,
      has: (id: string) => this.has(id),
      getServiceIds: () => this.getServiceIds(),
      getByTag: (tag: string) => this.getByTag(tag),
    }
  }

  /**
   * Get a resolver bound to this container
   * Use this for typed resolution in hooks and actions
   */
  getResolver(): ServiceContext {
    return this.createContext()
  }

  /**
   * Initialize all singleton services
   * Call this during application startup
   */
  async initializeAll(): Promise<void> {
    for (const [id, def] of this.services) {
      if (def.options.lifecycle === "singleton" && !def.initialized) {
        await this.resolveAsync(id)
      }
    }
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear()
  }

  /**
   * Unregister a service
   */
  unregister(serviceId: string): boolean {
    return this.services.delete(serviceId)
  }
}

// -----------------------------------------------------------------------------
// Global Container (optional singleton pattern)
// -----------------------------------------------------------------------------

let globalContainer: ServiceContainer | null = null

/**
 * Get or create the global service container
 */
export function getGlobalContainer(): ServiceContainer {
  if (!globalContainer) {
    globalContainer = new ServiceContainer()
  }
  return globalContainer
}

/**
 * Set a custom global container
 */
export function setGlobalContainer(container: ServiceContainer): void {
  globalContainer = container
}

/**
 * Clear the global container (for testing)
 */
export function clearGlobalContainer(): void {
  globalContainer?.clear()
  globalContainer = null
}

// -----------------------------------------------------------------------------
// Factory Helpers
// -----------------------------------------------------------------------------

/**
 * Create a service that depends on other services
 */
export function createService<T, TDeps extends Record<string, unknown>>(
  dependencies: (keyof TDeps)[],
  factory: (deps: TDeps, ctx: ServiceContext) => T | Promise<T>
): ServiceFactory<T> {
  return async (ctx) => {
    const deps = {} as TDeps

    for (const depId of dependencies) {
      deps[depId] = await ctx.resolveAsync(depId as string)
    }

    return factory(deps, ctx)
  }
}

/**
 * Create a lazy service that initializes on first use
 */
export function lazyService<T>(factory: () => T | Promise<T>): ServiceFactory<T> {
  return async () => factory()
}

// -----------------------------------------------------------------------------
// Type Helpers for Plugin Authors
// -----------------------------------------------------------------------------

/**
 * Define a typed service registry for a plugin
 *
 * @example
 * ```typescript
 * // In plugin
 * interface MyPluginServices {
 *   mailer: MailerService
 *   queue: QueueService
 * }
 *
 * // Usage
 * ctx.resolve<MyPluginServices["mailer"]>("mailer")
 * ```
 */
export type DefineServices<T extends ServiceRegistry> = T

/**
 * Merge multiple service registries
 */
export type MergeServices<A extends ServiceRegistry, B extends ServiceRegistry> = A & B

// -----------------------------------------------------------------------------
// Context Extension for Hooks/Actions
// -----------------------------------------------------------------------------

/**
 * Extended context passed to hooks and actions
 * Includes service resolution capabilities
 */
export interface ResolverContext extends ServiceContext {
  /** Shorthand for resolve */
  services: ServiceContext
}

/**
 * Create a resolver context for hooks and actions
 */
export function createResolverContext(container: ServiceContainer): ResolverContext {
  const ctx = container.getResolver()
  return {
    ...ctx,
    services: ctx,
  }
}

// -----------------------------------------------------------------------------
// Scoped Container (Per-Request Services)
// -----------------------------------------------------------------------------

/**
 * A scoped container that inherits from a parent but has its own instance cache
 * Used for per-request services like "currentUser", "requestId", etc.
 */
export class ScopedContainer {
  private parent: ServiceContainer
  private scopedInstances = new Map<string, unknown>()
  private driver: Driver | null = null

  constructor(parent: ServiceContainer) {
    this.parent = parent
  }

  /**
   * Set the driver for this scope
   */
  setDriver(driver: Driver): void {
    this.driver = driver
  }

  /**
   * Set a scoped value directly (e.g., currentUser for this request)
   */
  set<T>(serviceId: string, value: T): void {
    this.scopedInstances.set(serviceId, value)
  }

  /**
   * Resolve a service - checks scoped instances first, then parent
   */
  resolve<T = unknown>(serviceId: string): T {
    // Check scoped instances first
    if (this.scopedInstances.has(serviceId)) {
      return this.scopedInstances.get(serviceId) as T
    }

    // Delegate to parent
    return this.parent.resolve<T>(serviceId)
  }

  /**
   * Async resolve
   */
  async resolveAsync<T = unknown>(serviceId: string): Promise<T> {
    // Check scoped instances first
    if (this.scopedInstances.has(serviceId)) {
      return this.scopedInstances.get(serviceId) as T
    }

    // Delegate to parent
    return this.parent.resolveAsync<T>(serviceId)
  }

  /**
   * Check if a service exists
   */
  has(serviceId: string): boolean {
    return this.scopedInstances.has(serviceId) || this.parent.has(serviceId)
  }

  /**
   * Get the driver
   */
  getDriver(): Driver {
    return this.driver || (this.parent as any).driver
  }

  /**
   * Create a service context for this scope
   */
  getContext(): ServiceContext {
    const driver = this.getDriver()
    if (!driver) {
      throw new Error("[ScopedContainer] Driver not available")
    }

    return {
      resolve: <T = unknown>(id: string) => this.resolve<T>(id),
      resolveAsync: <T = unknown>(id: string) => this.resolveAsync<T>(id),
      driver,
      has: (id: string) => this.has(id),
      getServiceIds: () => this.parent.getServiceIds(),
      getByTag: (tag: string) => this.parent.getByTag(tag),
    }
  }
}

/**
 * Create a scoped container from a parent
 */
export function createScope(parent: ServiceContainer): ScopedContainer {
  return new ScopedContainer(parent)
}
