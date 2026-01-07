// =============================================================================
// ENHANCED DRIVER
// Wraps any driver with validation, transform, and security enhancements
// =============================================================================

import type { Driver, Where, QueryOptions, Entity } from "../types.js"
import { enhanceWriteData, enhanceReadData, enhanceReadDataArray, hasEnhancements } from "./index.js"
import type { EnhancementOptions } from "./index.js"

// -----------------------------------------------------------------------------
// Enhanced Driver Options
// -----------------------------------------------------------------------------

export interface EnhancedDriverOptions extends EnhancementOptions {
  /** Entity registry for looking up entity definitions */
  entities: Record<string, Entity>
}

// -----------------------------------------------------------------------------
// Enhanced Driver Wrapper
// -----------------------------------------------------------------------------

/**
 * Create an enhanced driver that applies validation, transforms, and security
 * automatically on all operations.
 *
 * @example
 * ```typescript
 * const baseDriver = prismaDriver(prisma)
 * const driver = createEnhancedDriver(baseDriver, {
 *   entities: { user, post, order },
 * })
 *
 * // Now all operations automatically:
 * // - Validate input
 * // - Transform strings (trim, lower, upper)
 * // - Hash passwords
 * // - Encrypt fields
 * // - Omit sensitive fields from responses
 * ```
 */
export function createEnhancedDriver(
  baseDriver: Driver,
  options: EnhancedDriverOptions
): Driver {
  const { entities, ...enhancementOptions } = options

  return {
    id: `enhanced:${baseDriver.id}`,
    name: `Enhanced ${baseDriver.name}`,

    async findOne<T>(entity: string, where: Where): Promise<T | null> {
      const result = await baseDriver.findOne<Record<string, unknown>>(entity, where)
      if (!result) return null

      const entityDef = entities[entity]
      if (entityDef && hasEnhancements(entityDef)) {
        return (await enhanceReadData(result, entityDef, enhancementOptions)) as T
      }
      return result as T
    },

    async findMany<T>(entity: string, queryOptions?: QueryOptions): Promise<T[]> {
      const results = await baseDriver.findMany<Record<string, unknown>>(entity, queryOptions)

      const entityDef = entities[entity]
      if (entityDef && hasEnhancements(entityDef)) {
        return (await enhanceReadDataArray(results, entityDef, enhancementOptions)) as T[]
      }
      return results as T[]
    },

    async create<T>(entity: string, data: Record<string, unknown>): Promise<T> {
      const entityDef = entities[entity]
      let processedData = data

      if (entityDef && hasEnhancements(entityDef)) {
        processedData = await enhanceWriteData(data, entityDef, "create", enhancementOptions)
      }

      const result = await baseDriver.create<Record<string, unknown>>(entity, processedData)

      if (entityDef && hasEnhancements(entityDef)) {
        return (await enhanceReadData(result, entityDef, enhancementOptions)) as T
      }
      return result as T
    },

    async update<T>(entity: string, where: Where, data: Record<string, unknown>): Promise<T> {
      const entityDef = entities[entity]
      let processedData = data

      if (entityDef && hasEnhancements(entityDef)) {
        processedData = await enhanceWriteData(data, entityDef, "update", enhancementOptions)
      }

      const result = await baseDriver.update<Record<string, unknown>>(entity, where, processedData)

      if (entityDef && hasEnhancements(entityDef)) {
        return (await enhanceReadData(result, entityDef, enhancementOptions)) as T
      }
      return result as T
    },

    async delete(entity: string, where: Where): Promise<void> {
      return baseDriver.delete(entity, where)
    },

    async count(entity: string, where?: Where): Promise<number> {
      return baseDriver.count(entity, where)
    },

    transaction: baseDriver.transaction
      ? async <R>(callback: (driver: Driver) => Promise<R>): Promise<R> => {
          return baseDriver.transaction!((txDriver) => {
            // Wrap the transaction driver with enhancements
            const enhancedTxDriver = createEnhancedDriver(txDriver, options)
            return callback(enhancedTxDriver)
          })
        }
      : undefined,

    getClient: baseDriver.getClient
      ? (): unknown => baseDriver.getClient!()
      : undefined,
  }
}

/**
 * Type guard to check if a driver is enhanced
 */
export function isEnhancedDriver(driver: Driver): boolean {
  return driver.id?.startsWith("enhanced:") ?? false
}

/**
 * Get the base driver from an enhanced driver
 */
export function getBaseDriver(driver: Driver): Driver {
  // The enhanced driver wraps the base driver
  // This is a limitation - we can't easily extract the base driver
  // without additional tracking
  return driver
}
