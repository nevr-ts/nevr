// =============================================================================
// PRISMA DRIVER
// Prisma database driver for zapi - uses Driver Factory pattern
// =============================================================================

import type { Driver, QueryOptions, Where } from "../types.js"
import { createDriverFactory, type DriverFactoryConfig, type CustomDriverMethods } from "../driver/index.js"

// -----------------------------------------------------------------------------
// Prisma Client Type
// -----------------------------------------------------------------------------

type PrismaModel = {
  findUnique: (args: any) => Promise<unknown>
  findFirst: (args: any) => Promise<unknown>
  findMany: (args: any) => Promise<unknown[]>
  create: (args: any) => Promise<unknown>
  update: (args: any) => Promise<unknown>
  delete: (args: any) => Promise<unknown>
  count: (args: any) => Promise<number>
}

type PrismaClient = {
  [key: string]: PrismaModel | unknown
  $transaction?: <R>(callback: (tx: any) => Promise<R>) => Promise<R>
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
  debugLogs?: boolean

  /**
   * Enable transactions
   * @default true
   */
  transactions?: boolean
}

// -----------------------------------------------------------------------------
// Helper: Get Model
// -----------------------------------------------------------------------------

function getModel(client: PrismaClient, entity: string): PrismaModel {
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
// Helper: Convert Where Clause
// -----------------------------------------------------------------------------

function convertWhere(where: Where): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue

    // Check if it's an operator object
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const operators = value as Record<string, unknown>

      // Convert string booleans
      if ("equals" in operators) {
        if (operators.equals === "true") result[key] = true
        else if (operators.equals === "false") result[key] = false
        else result[key] = operators.equals
      } else if (Object.keys(operators).some(k => 
        ["not", "in", "notIn", "lt", "lte", "gt", "gte", "contains", "startsWith", "endsWith"].includes(k)
      )) {
        result[key] = operators
      } else {
        result[key] = value
      }
    } else {
      // Simple value - convert string booleans
      if (value === "true") result[key] = true
      else if (value === "false") result[key] = false
      else result[key] = value
    }
  }

  return result
}

// -----------------------------------------------------------------------------
// Create Custom Driver Methods for Prisma
// -----------------------------------------------------------------------------

interface CreateArgs {
  model: string
  data: Record<string, unknown>
}

interface FindOneArgs {
  model: string
  where: Where
}

interface FindManyArgs {
  model: string
  where?: Where
  limit?: number
  offset?: number
  orderBy?: Record<string, "asc" | "desc">
}

interface UpdateArgs {
  model: string
  where: Where
  update: Record<string, unknown>
}

interface DeleteArgs {
  model: string
  where: Where
}

interface CountArgs {
  model: string
  where?: Where
}

function createPrismaDriverMethods(
  client: PrismaClient,
  config: DriverFactoryConfig
): CustomDriverMethods {
  return {
    async create<T extends Record<string, unknown>>(args: CreateArgs): Promise<T> {
      const { model, data } = args
      const prismaModel = getModel(client, model)
      return prismaModel.create({ data }) as Promise<T>
    },

    async findOne<T>(args: FindOneArgs): Promise<T | null> {
      const { model, where } = args
      const prismaModel = getModel(client, model)
      const result = await prismaModel.findFirst({
        where: convertWhere(where),
      })
      return result as T | null
    },

    async findMany<T>(args: FindManyArgs): Promise<T[]> {
      const { model, where, limit, offset, orderBy } = args
      const prismaModel = getModel(client, model)

      const queryArgs: Record<string, unknown> = {}

      if (where) {
        queryArgs.where = convertWhere(where)
      }

      if (orderBy && Object.keys(orderBy).length > 0) {
        queryArgs.orderBy = orderBy
      }

      if (limit !== undefined) {
        queryArgs.take = limit
      }

      if (offset !== undefined) {
        queryArgs.skip = offset
      }

      return prismaModel.findMany(queryArgs) as Promise<T[]>
    },

    async update<T>(args: UpdateArgs): Promise<T | null> {
      const { model, where, update } = args
      const prismaModel = getModel(client, model)
      const result = await prismaModel.update({
        where: convertWhere(where),
        data: update,
      })
      return result as T | null
    },

    async delete(args: DeleteArgs): Promise<void> {
      const { model, where } = args
      const prismaModel = getModel(client, model)
      await prismaModel.delete({
        where: convertWhere(where),
      })
    },

    async count(args: CountArgs): Promise<number> {
      const { model, where } = args
      const prismaModel = getModel(client, model)
      return prismaModel.count({
        where: where ? convertWhere(where) : undefined,
      })
    },
  }
}

// -----------------------------------------------------------------------------
// Prisma Driver Factory
// -----------------------------------------------------------------------------

/**
 * Create a Prisma driver for zapi
 *
 * @example
 * ```typescript
 * import { PrismaClient } from "@prisma/client"
 * import { prisma } from "@zapi-ts/driver-prisma"
 *
 * const client = new PrismaClient()
 * const driver = prisma(client)
 *
 * const api = zapi({
 *   entities: [...],
 *   driver,
 * })
 * ```
 */
export function prisma(client: PrismaClient, config: PrismaDriverConfig = {}): Driver {
  const driverConfig: DriverFactoryConfig = {
    driverId: "prisma",
    driverName: "Prisma",
    usePlural: config.usePlural,
    debugLogs: config.debugLogs,
    supportsJSON: true,
    supportsDates: true,
    supportsBooleans: true,
    supportsTransactions: config.transactions !== false,
  }

  const driver = createDriverFactory({
    config: driverConfig,
    client,
    createCustomDriver: createPrismaDriverMethods,
  })

  // Add transaction support if enabled
  if (config.transactions !== false && client.$transaction) {
    ;(driver as any).transaction = async <R>(
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

  // Store reference to raw client for plugins (like auth)
  ;(driver as any).prisma = client
  ;(driver as any).db = client
  ;(driver as any)._prisma = client

  return driver
}

// -----------------------------------------------------------------------------
// Re-exports
// -----------------------------------------------------------------------------

export type { PrismaClient, PrismaModel }
export default prisma