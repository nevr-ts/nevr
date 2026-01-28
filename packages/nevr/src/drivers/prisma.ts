// =============================================================================
// PRISMA DRIVER
// Prisma database driver for nevr - uses Driver Factory pattern
// Implements adapter patterns
// =============================================================================

import type { Driver, QueryOptions, Where, IncludeConfig } from "../types.js"
import {
  createDriverFactory,
  normalizeWhereOperators,
  type DriverFactoryConfig,
  type CustomDriverMethods,
  type TransformConfig,
} from "./base.js"

// -----------------------------------------------------------------------------
// Prisma Client Type
// -----------------------------------------------------------------------------

type PrismaModel = {
  findUnique: (args: any) => Promise<unknown>
  findFirst: (args: any) => Promise<unknown>
  findMany: (args: any) => Promise<unknown[]>
  create: (args: any) => Promise<unknown>
  createMany: (args: any) => Promise<{ count: number }>
  update: (args: any) => Promise<unknown>
  updateMany: (args: any) => Promise<{ count: number }>
  delete: (args: any) => Promise<unknown>
  deleteMany: (args: any) => Promise<{ count: number }>
  upsert: (args: any) => Promise<unknown>
  count: (args: any) => Promise<number>
  aggregate: (args: any) => Promise<unknown>
  groupBy: (args: any) => Promise<unknown[]>
}

type PrismaClient = {
  [key: string]: PrismaModel | unknown
  $transaction?: <R>(callback: (tx: any) => Promise<R>) => Promise<R>
  $queryRaw?: <R>(query: any, ...params: any[]) => Promise<R>
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

export interface PrismaDriverConfig {
  /**
   * Database provider (for schema generation)
   */
  provider?: "sqlite" | "postgresql" | "mysql" | "sqlserver" | "mongodb" | "cockroachdb"

  /**
   * Use plural table names
   * @default false
   */
  usePlural?: boolean

  /**
   * Enable debug logs
   * @default false
   */
  debugLogs?: boolean | {
    input?: boolean
    transform?: boolean
    query?: boolean
    output?: boolean
    logCondition?: () => boolean
  }

  /**
   * Enable transactions
   * @default true
   */
  transactions?: boolean

  /**
   * Input/output transformations
   */
  transform?: TransformConfig

  /**
   * Custom model name mapping (entity name -> Prisma model name)
   */
  modelMap?: Record<string, string>
}

// -----------------------------------------------------------------------------
// Helper: Get Model
// -----------------------------------------------------------------------------

function getModel(
  client: PrismaClient,
  entity: string,
  modelMap?: Record<string, string>
): PrismaModel {
  // Check model map first
  const mappedName = modelMap?.[entity]
  if (mappedName && client[mappedName] && typeof (client[mappedName] as any).findMany === "function") {
    return client[mappedName] as PrismaModel
  }

  // Try exact name
  if (client[entity] && typeof (client[entity] as any).findMany === "function") {
    return client[entity] as PrismaModel
  }

  // Try lowercase
  const lower = entity.toLowerCase()
  if (client[lower] && typeof (client[lower] as any).findMany === "function") {
    return client[lower] as PrismaModel
  }

  // Try PascalCase
  const pascal = entity.charAt(0).toUpperCase() + entity.slice(1)
  if (client[pascal] && typeof (client[pascal] as any).findMany === "function") {
    return client[pascal] as PrismaModel
  }

  throw new Error(`Model "${entity}" not found in Prisma client`)
}

// -----------------------------------------------------------------------------
// Helper: Convert Include Config to Prisma Format
// -----------------------------------------------------------------------------

function convertInclude(
  include: Record<string, boolean | IncludeConfig>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(include)) {
    if (value === true) {
      result[key] = true
    } else if (typeof value === "object") {
      const prismaInclude: Record<string, unknown> = {}

      if (value.select) {
        prismaInclude.select = value.select.reduce((acc, field) => {
          acc[field] = true
          return acc
        }, {} as Record<string, boolean>)
      }

      if (value.where) {
        prismaInclude.where = normalizeWhereOperators(value.where)
      }

      if (value.orderBy) {
        prismaInclude.orderBy = value.orderBy
      }

      if (value.take) {
        prismaInclude.take = value.take
      }

      if (value.include) {
        prismaInclude.include = convertInclude(value.include)
      }

      result[key] = Object.keys(prismaInclude).length > 0 ? prismaInclude : true
    }
  }

  return result
}

// -----------------------------------------------------------------------------
// Create Custom Driver Methods for Prisma (Enhanced)
// Includes batch operations, aggregations, and escape hatches
// -----------------------------------------------------------------------------

function createPrismaDriverMethods(
  client: PrismaClient,
  config: DriverFactoryConfig & { modelMap?: Record<string, string> }
): CustomDriverMethods {
  const getModelForEntity = (entity: string) => getModel(client, entity, config.modelMap)

  return {
    // -------------------------------------------------------------------------
    // Core CRUD
    // -------------------------------------------------------------------------

    async create<T extends Record<string, unknown>>(args: {
      model: string
      data: Record<string, unknown>
      select?: string[]
    }): Promise<T> {
      const prismaModel = getModelForEntity(args.model)
      const queryArgs: Record<string, unknown> = { data: args.data }

      if (args.select) {
        queryArgs.select = args.select.reduce((acc, field) => {
          acc[field] = true
          return acc
        }, {} as Record<string, boolean>)
      }

      return prismaModel.create(queryArgs) as Promise<T>
    },

    async findOne<T>(args: {
      model: string
      where: Where
      select?: string[]
      include?: Record<string, boolean | IncludeConfig>
    }): Promise<T | null> {
      const prismaModel = getModelForEntity(args.model)
      const queryArgs: Record<string, unknown> = { where: args.where }

      if (args.select) {
        queryArgs.select = args.select.reduce((acc, field) => {
          acc[field] = true
          return acc
        }, {} as Record<string, boolean>)
      }

      if (args.include) {
        queryArgs.include = convertInclude(args.include)
      }

      return prismaModel.findFirst(queryArgs) as Promise<T | null>
    },

    async findMany<T>(args: {
      model: string
      where?: Where
      limit?: number
      offset?: number
      orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, unknown>>
      include?: Record<string, boolean | IncludeConfig>
      distinct?: string[]
    }): Promise<T[]> {
      const prismaModel = getModelForEntity(args.model)
      const queryArgs: Record<string, unknown> = {}

      if (args.where) {
        queryArgs.where = args.where
      }

      if (args.orderBy) {
        queryArgs.orderBy = args.orderBy
      }

      if (args.limit !== undefined) {
        queryArgs.take = args.limit
      }

      if (args.offset !== undefined) {
        queryArgs.skip = args.offset
      }

      if (args.include) {
        queryArgs.include = convertInclude(args.include)
      }

      if (args.distinct) {
        queryArgs.distinct = args.distinct
      }

      return prismaModel.findMany(queryArgs) as Promise<T[]>
    },

    async update<T>(args: {
      model: string
      where: Where
      update: Record<string, unknown>
    }): Promise<T | null> {
      const prismaModel = getModelForEntity(args.model)
      const result = await prismaModel.update({
        where: args.where,
        data: args.update,
      })
      return result as T | null
    },

    async delete(args: { model: string; where: Where }): Promise<void> {
      const prismaModel = getModelForEntity(args.model)
      await prismaModel.delete({ where: args.where })
    },

    async count(args: { model: string; where?: Where }): Promise<number> {
      const prismaModel = getModelForEntity(args.model)
      return prismaModel.count({
        where: args.where,
      })
    },

    // -------------------------------------------------------------------------
    // Batch Operations
    // -------------------------------------------------------------------------

    async createMany<T>(args: {
      model: string
      data: Record<string, unknown>[]
      skipDuplicates?: boolean
    }): Promise<T[]> {
      const prismaModel = getModelForEntity(args.model)

      // Prisma createMany doesn't return created records, so we use transaction
      // to create and return all records
      if (client.$transaction) {
        const createOperations = args.data.map(data => prismaModel.create({ data }))
        const results = await client.$transaction(async () => {
          return Promise.all(createOperations)
        })
        return results as T[]
      }

      // Fallback: create one by one
      const results: T[] = []
      for (const data of args.data) {
        const result = await prismaModel.create({ data })
        results.push(result as T)
      }
      return results
    },

    async updateMany(args: {
      model: string
      where: Where
      update: Record<string, unknown>
    }): Promise<{ count: number }> {
      const prismaModel = getModelForEntity(args.model)
      return prismaModel.updateMany({
        where: args.where,
        data: args.update,
      })
    },

    async deleteMany(args: {
      model: string
      where: Where
    }): Promise<{ count: number }> {
      const prismaModel = getModelForEntity(args.model)
      return prismaModel.deleteMany({ where: args.where })
    },

    async upsert<T>(args: {
      model: string
      where: Where
      create: Record<string, unknown>
      update: Record<string, unknown>
    }): Promise<T> {
      const prismaModel = getModelForEntity(args.model)
      return prismaModel.upsert({
        where: args.where,
        create: args.create,
        update: args.update,
      }) as Promise<T>
    },

    // -------------------------------------------------------------------------
    // Advanced Queries
    // -------------------------------------------------------------------------

    async findFirst<T>(args: {
      model: string
      where?: Where
      orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, unknown>>
      include?: Record<string, boolean | IncludeConfig>
    }): Promise<T | null> {
      const prismaModel = getModelForEntity(args.model)
      const queryArgs: Record<string, unknown> = {}

      if (args.where) {
        queryArgs.where = args.where
      }

      if (args.orderBy) {
        queryArgs.orderBy = args.orderBy
      }

      if (args.include) {
        queryArgs.include = convertInclude(args.include)
      }

      return prismaModel.findFirst(queryArgs) as Promise<T | null>
    },

    async exists(args: { model: string; where: Where }): Promise<boolean> {
      const prismaModel = getModelForEntity(args.model)
      const count = await prismaModel.count({ where: args.where })
      return count > 0
    },

    async aggregate<T>(args: {
      model: string
      where?: Where
      _count?: boolean | Record<string, boolean>
      _sum?: Record<string, boolean>
      _avg?: Record<string, boolean>
      _min?: Record<string, boolean>
      _max?: Record<string, boolean>
    }): Promise<T> {
      const prismaModel = getModelForEntity(args.model)
      const queryArgs: Record<string, unknown> = {}

      if (args.where) {
        queryArgs.where = args.where
      }
      if (args._count !== undefined) {
        queryArgs._count = args._count
      }
      if (args._sum) {
        queryArgs._sum = args._sum
      }
      if (args._avg) {
        queryArgs._avg = args._avg
      }
      if (args._min) {
        queryArgs._min = args._min
      }
      if (args._max) {
        queryArgs._max = args._max
      }

      return prismaModel.aggregate(queryArgs) as Promise<T>
    },

    async groupBy<T>(args: {
      model: string
      by: string[]
      where?: Where
      _count?: boolean | Record<string, boolean>
      _sum?: Record<string, boolean>
      _avg?: Record<string, boolean>
    }): Promise<T[]> {
      const prismaModel = getModelForEntity(args.model)
      const queryArgs: Record<string, unknown> = {
        by: args.by,
      }

      if (args.where) {
        queryArgs.where = args.where
      }
      if (args._count !== undefined) {
        queryArgs._count = args._count
      }
      if (args._sum) {
        queryArgs._sum = args._sum
      }
      if (args._avg) {
        queryArgs._avg = args._avg
      }

      return prismaModel.groupBy(queryArgs) as Promise<T[]>
    },
  }
}

// -----------------------------------------------------------------------------
// Prisma Driver Factory
// -----------------------------------------------------------------------------

/**
 * Create a Prisma driver for nevr
 * Implements adapter patterns with entity-first approach
 *
 * @example
 * ```typescript
 * import { PrismaClient } from "@prisma/client"
 * import { prisma } from "nevr"
 *
 * const client = new PrismaClient()
 * const driver = prisma(client, {
 *   // Optional: 4-stage debug logging
 *   debugLogs: {
 *     input: true,
 *     transform: true,
 *     query: true,
 *     output: true,
 *   },
 *   // Optional: custom model mapping
 *   modelMap: {
 *     user: "User",
 *     session: "Session",
 *   },
 * })
 *
 * const api = nevr({
 *   entities: [...],
 *   driver,
 * })
 * ```
 */
export function prisma(client: any, config: PrismaDriverConfig = {}): Driver {
  const driverConfig: DriverFactoryConfig & { modelMap?: Record<string, string> } = {
    driverId: "prisma",
    driverName: "Prisma",
    usePlural: config.usePlural,
    debugLogs: config.debugLogs,
    supportsJSON: true,
    supportsDates: true,
    supportsBooleans: true,
    supportsTransactions: config.transactions !== false,
    supportsBatch: true,
    supportsUpsert: true,
    supportsAggregations: true,
    transform: config.transform,
    modelMap: config.modelMap,
  }

  const driver = createDriverFactory({
    config: driverConfig,
    client,
    createCustomDriver: createPrismaDriverMethods,
  })

  // Add transaction support if enabled
  if (config.transactions !== false && client.$transaction) {
    ; (driver as any).transaction = async <R>(
      callback: (tx: Driver) => Promise<R>
    ): Promise<R> => {
      return client.$transaction!(async (txClient: PrismaClient) => {
        const txDriver = createDriverFactory({
          config: driverConfig,
          client: txClient,
          createCustomDriver: createPrismaDriverMethods,
        })
        return callback(txDriver)
      })
    }
  }

  // Add raw query escape hatch
  if (client.$queryRaw) {
    ; (driver as any).raw = async <T>(query: string, params?: unknown[]): Promise<T> => {
      // Use tagged template for safety, but allow raw queries for escape hatch
      return client.$queryRaw!`${query}` as Promise<T>
    }
  }

  // Store reference to raw client for plugins (like auth)
  ; (driver as any).prisma = client
    ; (driver as any).db = client
    ; (driver as any)._prisma = client

  return driver
}

// -----------------------------------------------------------------------------
// Re-exports
// -----------------------------------------------------------------------------

export type { PrismaClient, PrismaModel }
export { normalizeWhereOperators }
export default prisma