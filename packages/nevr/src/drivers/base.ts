// =============================================================================
// DRIVER SYSTEM
// Database abstraction layer
// Entity-first approach with full where clause operators
// =============================================================================

import type { Where, WhereOperator, QueryOptions, SortDirection, IncludeConfig } from "../types.js"
import { getLogger } from "../logger.js"

// -----------------------------------------------------------------------------
// Driver Debug Logging
// -----------------------------------------------------------------------------

export type DriverDebugLogOption =
  | boolean
  | {
    logCondition?: (() => boolean) | undefined
    // Stage 1: Input received
    input?: boolean | undefined
    // Stage 2: After transformation
    transform?: boolean | undefined
    // Stage 3: Query execution
    query?: boolean | undefined
    // Stage 4: Output result
    output?: boolean | undefined
    // Per-operation logs
    create?: boolean | undefined
    update?: boolean | undefined
    findOne?: boolean | undefined
    findMany?: boolean | undefined
    delete?: boolean | undefined
    count?: boolean | undefined
  }

// -----------------------------------------------------------------------------
// Where Clause Utilities
// -----------------------------------------------------------------------------

/**
 * Normalize where clause operators to Prisma format
 * Handles snake_case aliases and operator conversions
 */
export function normalizeWhereOperators(where: Where): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue

    // Handle boolean string conversion
    if (value === "true") {
      result[key] = true
      continue
    }
    if (value === "false") {
      result[key] = false
      continue
    }

    // Handle operator object
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const op = value as WhereOperator
      const normalized: Record<string, unknown> = {}
      let hasOperator = false

      // Exact match
      if ("equals" in op) { normalized.equals = op.equals; hasOperator = true }
      if ("eq" in op) { normalized.equals = op.eq; hasOperator = true }

      // Not equal
      if ("not" in op) { normalized.not = op.not; hasOperator = true }
      if ("ne" in op) { normalized.not = op.ne; hasOperator = true }

      // In array
      if ("in" in op) { normalized.in = op.in; hasOperator = true }
      if ("notIn" in op) { normalized.notIn = op.notIn; hasOperator = true }
      if ("not_in" in op) { normalized.notIn = op.not_in; hasOperator = true }

      // Comparison
      if ("lt" in op) { normalized.lt = op.lt; hasOperator = true }
      if ("lte" in op) { normalized.lte = op.lte; hasOperator = true }
      if ("gt" in op) { normalized.gt = op.gt; hasOperator = true }
      if ("gte" in op) { normalized.gte = op.gte; hasOperator = true }

      // String matching
      if ("contains" in op) {
        normalized.contains = op.contains
        if (op.mode === "insensitive") normalized.mode = "insensitive"
        hasOperator = true
      }
      if ("startsWith" in op) { normalized.startsWith = op.startsWith; hasOperator = true }
      if ("starts_with" in op) { normalized.startsWith = op.starts_with; hasOperator = true }
      if ("endsWith" in op) { normalized.endsWith = op.endsWith; hasOperator = true }
      if ("ends_with" in op) { normalized.endsWith = op.ends_with; hasOperator = true }

      if (hasOperator) {
        result[key] = normalized
      } else {
        // Plain object, use as-is
        result[key] = value
      }
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Normalize sort direction to Prisma format
 */
export function normalizeSortDirection(
  orderBy: Record<string, SortDirection>
): Record<string, "asc" | "desc"> | Array<Record<string, unknown>> {
  const hasNulls = Object.values(orderBy).some(
    v => typeof v === "object" && v !== null && "nulls" in v
  )

  if (hasNulls) {
    // Use array format for nulls handling
    return Object.entries(orderBy).map(([field, dir]) => {
      if (typeof dir === "object" && dir !== null) {
        return { [field]: { sort: dir.sort, nulls: dir.nulls } }
      }
      return { [field]: dir }
    })
  }

  // Simple format
  const result: Record<string, "asc" | "desc"> = {}
  for (const [field, dir] of Object.entries(orderBy)) {
    result[field] = typeof dir === "object" ? dir.sort : dir
  }
  return result
}

export interface DriverFactoryConfig {
  /**
   * Unique identifier for the driver
   */
  driverId: string

  /**
   * Human-readable name
   */
  driverName?: string | undefined

  /**
   * Use plural table names
   * @default false
   */
  usePlural?: boolean | undefined

  /**
   * Enable debug logs
   * @default false
   */
  debugLogs?: DriverDebugLogOption | undefined

  /**
   * Database supports JSON columns natively
   * @default false
   */
  supportsJSON?: boolean | undefined

  /**
   * Database supports Date objects natively
   * @default true
   */
  supportsDates?: boolean | undefined

  /**
   * Database supports boolean natively
   * @default true
   */
  supportsBooleans?: boolean | undefined

  /**
   * Database supports transactions
   * @default false
   */
  supportsTransactions?: boolean | undefined

  /**
   * Database supports batch operations (createMany, updateMany, deleteMany)
   * @default false
   */
  supportsBatch?: boolean | undefined

  /**
   * Database supports upsert
   * @default false
   */
  supportsUpsert?: boolean | undefined

  /**
   * Database supports aggregations
   * @default false
   */
  supportsAggregations?: boolean | undefined

  /**
   * Custom ID generator
   */
  generateId?: (() => string) | undefined

  /**
   * Transform model name (e.g., pluralize, case conversion)
   */
  transformModelName?: ((model: string) => string) | undefined

  /**
   * Transform field name (e.g., snake_case to camelCase)
   */
  transformFieldName?: ((field: string, model: string) => string) | undefined

  /**
   * Input/output transformation config
   */
  transform?: TransformConfig | undefined
}

// -----------------------------------------------------------------------------
// Driver Interface (What drivers must implement)
// -----------------------------------------------------------------------------

export interface Driver {
  /**
   * Unique identifier for the driver
   */
  id: string

  /**
   * Human-readable name
   */
  name: string

  /**
   * Find a single record
   */
  findOne<T>(entity: string, where: Where): Promise<T | null>

  /**
   * Find multiple records with filtering, sorting, pagination
   */
  findMany<T>(entity: string, options?: QueryOptions): Promise<T[]>

  /**
   * Create a new record
   */
  create<T>(entity: string, data: Record<string, unknown>): Promise<T>

  /**
   * Update an existing record
   */
  update<T>(entity: string, where: Where, data: Record<string, unknown>): Promise<T>

  /**
   * Delete a record
   */
  delete(entity: string, where: Where): Promise<void>

  /**
   * Count records matching a condition
   */
  count(entity: string, where?: Where): Promise<number>

  /**
   * Execute multiple operations in a transaction
   */
  transaction?<R>(callback: (driver: Driver) => Promise<R>): Promise<R>

  /**
   * Get the raw database client (for advanced use cases)
   */
  getClient(): unknown
}

// -----------------------------------------------------------------------------
// Input/Output Transformation
// -----------------------------------------------------------------------------

export interface TransformConfig {
  /** Transform data before saving to database */
  input?: (data: Record<string, unknown>, entity: string) => Record<string, unknown> | Promise<Record<string, unknown>>
  /** Transform data after reading from database */
  output?: (data: Record<string, unknown>, entity: string) => Record<string, unknown> | Promise<Record<string, unknown>>
  /** Transform field name to database column name */
  fieldToColumn?: (field: string, entity: string) => string
  /** Transform database column name to field name */
  columnToField?: (column: string, entity: string) => string
}

// -----------------------------------------------------------------------------
// Custom Driver Creator Interface (Enhanced)
// -----------------------------------------------------------------------------

export interface CustomDriverMethods {
  // Core CRUD
  create<T extends Record<string, unknown>>(data: {
    model: string
    data: T
    select?: string[] | undefined
  }): Promise<T>

  findOne<T>(data: {
    model: string
    where: Where
    select?: string[] | undefined
    include?: Record<string, boolean | IncludeConfig> | undefined
  }): Promise<T | null>

  findMany<T>(data: {
    model: string
    where?: Where | undefined
    limit?: number | undefined
    offset?: number | undefined
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, unknown>> | undefined
    include?: Record<string, boolean | IncludeConfig> | undefined
    distinct?: string[] | undefined
  }): Promise<T[]>

  update<T>(data: {
    model: string
    where: Where
    update: Record<string, unknown>
  }): Promise<T | null>

  delete(data: { model: string; where: Where }): Promise<void>

  count(data: { model: string; where?: Where | undefined }): Promise<number>

  // Optional batch operations
  createMany?<T>(data: {
    model: string
    data: Record<string, unknown>[]
    skipDuplicates?: boolean
  }): Promise<T[]>

  updateMany?(data: {
    model: string
    where: Where
    update: Record<string, unknown>
  }): Promise<{ count: number }>

  deleteMany?(data: {
    model: string
    where: Where
  }): Promise<{ count: number }>

  upsert?<T>(data: {
    model: string
    where: Where
    create: Record<string, unknown>
    update: Record<string, unknown>
  }): Promise<T>

  // Optional advanced operations
  findFirst?<T>(data: {
    model: string
    where?: Where | undefined
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, unknown>> | undefined
    include?: Record<string, boolean | IncludeConfig> | undefined
  }): Promise<T | null>

  exists?(data: { model: string; where: Where }): Promise<boolean>

  aggregate?<T>(data: {
    model: string
    where?: Where | undefined
    _count?: boolean | Record<string, boolean>
    _sum?: Record<string, boolean>
    _avg?: Record<string, boolean>
    _min?: Record<string, boolean>
    _max?: Record<string, boolean>
  }): Promise<T>

  groupBy?<T>(data: {
    model: string
    by: string[]
    where?: Where | undefined
    _count?: boolean | Record<string, boolean>
    _sum?: Record<string, boolean>
    _avg?: Record<string, boolean>
  }): Promise<T[]>
}

// -----------------------------------------------------------------------------
// Driver Factory
// -----------------------------------------------------------------------------

export interface DriverFactoryOptions<TClient = unknown> {
  config: DriverFactoryConfig
  client: TClient
  createCustomDriver: (client: TClient, config: DriverFactoryConfig) => CustomDriverMethods
}

/**
 * Create a driver using the factory pattern
 * This allows consistent driver creation across different database adapters
 * Includes 4-stage logging and transformations
 */
export function createDriverFactory<TClient = unknown>(
  options: DriverFactoryOptions<TClient>
): Driver {
  const { config, client, createCustomDriver } = options
  const customDriver = createCustomDriver(client, config)
  const prefix = `[${config.driverName || config.driverId}]`

  // 4-stage logging
  const shouldLogStage = (stage: "input" | "transform" | "query" | "output"): boolean => {
    if (!config.debugLogs) return false
    if (config.debugLogs === true) return true
    if (typeof config.debugLogs === "object") {
      if (config.debugLogs.logCondition && !config.debugLogs.logCondition()) {
        return false
      }
      return (config.debugLogs as Record<string, boolean>)[stage] !== false
    }
    return false
  }

  const shouldLogOperation = (operation: string): boolean => {
    if (!config.debugLogs) return false
    if (config.debugLogs === true) return true
    if (typeof config.debugLogs === "object") {
      if (config.debugLogs.logCondition && !config.debugLogs.logCondition()) {
        return false
      }
      return (config.debugLogs as Record<string, boolean>)[operation] !== false
    }
    return false
  }

  const log = {
    input: (operation: string, data: unknown): void => {
      if (shouldLogStage("input") && shouldLogOperation(operation)) {
        getLogger().debug(`${prefix} [INPUT] ${operation}:`, data)
      }
    },
    transform: (operation: string, data: unknown): void => {
      if (shouldLogStage("transform") && shouldLogOperation(operation)) {
        getLogger().debug(`${prefix} [TRANSFORM] ${operation}:`, data)
      }
    },
    query: (operation: string, data: unknown): void => {
      if (shouldLogStage("query") && shouldLogOperation(operation)) {
        getLogger().debug(`${prefix} [QUERY] ${operation}:`, data)
      }
    },
    output: (operation: string, data: unknown): void => {
      if (shouldLogStage("output") && shouldLogOperation(operation)) {
        getLogger().debug(`${prefix} [OUTPUT] ${operation}:`, data)
      }
    },
  }

  const getModelName = (model: string): string => {
    if (config.transformModelName) {
      return config.transformModelName(model)
    }
    return model
  }

  // Apply input transformation
  const transformInput = async (
    data: Record<string, unknown>,
    entity: string
  ): Promise<Record<string, unknown>> => {
    if (config.transform?.input) {
      return config.transform.input(data, entity)
    }
    return data
  }

  // Apply output transformation
  const transformOutput = async <T>(
    data: T,
    entity: string
  ): Promise<T> => {
    if (config.transform?.output && data && typeof data === "object") {
      return config.transform.output(data as Record<string, unknown>, entity) as Promise<T>
    }
    return data
  }

  // Create driver with all optional methods
  const driver = {
    id: config.driverId,
    name: config.driverName || config.driverId,

    // -------------------------------------------------------------------------
    // Core CRUD
    // -------------------------------------------------------------------------

    async findOne<T>(entity: string, where: Where): Promise<T | null> {
      const model = getModelName(entity)
      log.input("findOne", { model, where })

      const normalizedWhere = normalizeWhereOperators(where)
      log.transform("findOne", { normalizedWhere })

      log.query("findOne", { model, where: normalizedWhere })
      const result = await customDriver.findOne<T>({ model, where: normalizedWhere })

      const transformed = result ? await transformOutput(result, entity) : null
      log.output("findOne", transformed)
      return transformed
    },

    async findMany<T>(entity: string, options: QueryOptions = {}): Promise<T[]> {
      const model = getModelName(entity)
      log.input("findMany", { model, options })

      const normalizedWhere = options.where
        ? normalizeWhereOperators(options.where)
        : undefined
      const normalizedOrderBy = options.orderBy
        ? normalizeSortDirection(options.orderBy)
        : undefined
      log.transform("findMany", { where: normalizedWhere, orderBy: normalizedOrderBy })

      log.query("findMany", { model, where: normalizedWhere, orderBy: normalizedOrderBy })
      const results = await customDriver.findMany<T>({
        model,
        where: normalizedWhere,
        limit: options.take,
        offset: options.skip,
        orderBy: normalizedOrderBy as Record<string, "asc" | "desc">,
        include: options.include,
        distinct: options.distinct,
      })

      const transformed = await Promise.all(
        results.map(r => transformOutput(r, entity))
      )
      log.output("findMany", { count: transformed.length })
      return transformed
    },

    async create<T>(entity: string, data: Record<string, unknown>): Promise<T> {
      const model = getModelName(entity)
      log.input("create", { model, data })

      const transformedData = await transformInput(data, entity)
      log.transform("create", { data: transformedData })

      log.query("create", { model, data: transformedData })
      const result = await customDriver.create<T & Record<string, unknown>>({
        model,
        data: transformedData as T & Record<string, unknown>,
      })

      const transformed = await transformOutput(result as T, entity)
      log.output("create", transformed)
      return transformed
    },

    async update<T>(entity: string, where: Where, data: Record<string, unknown>): Promise<T> {
      const model = getModelName(entity)
      log.input("update", { model, where, data })

      const normalizedWhere = normalizeWhereOperators(where)
      const transformedData = await transformInput(data, entity)
      log.transform("update", { where: normalizedWhere, data: transformedData })

      log.query("update", { model, where: normalizedWhere, data: transformedData })
      const result = await customDriver.update<T>({
        model,
        where: normalizedWhere,
        update: transformedData,
      })
      if (!result) {
        throw new Error(`Record not found for update: ${model}`)
      }

      const transformed = await transformOutput(result, entity)
      log.output("update", transformed)
      return transformed
    },

    async delete(entity: string, where: Where): Promise<void> {
      const model = getModelName(entity)
      log.input("delete", { model, where })

      const normalizedWhere = normalizeWhereOperators(where)
      log.transform("delete", { where: normalizedWhere })

      log.query("delete", { model, where: normalizedWhere })
      await customDriver.delete({ model, where: normalizedWhere })
      log.output("delete", { success: true })
    },

    async count(entity: string, where?: Where): Promise<number> {
      const model = getModelName(entity)
      log.input("count", { model, where })

      const normalizedWhere = where ? normalizeWhereOperators(where) : undefined
      log.transform("count", { where: normalizedWhere })

      log.query("count", { model, where: normalizedWhere })
      const count = await customDriver.count({ model, where: normalizedWhere })
      log.output("count", { count })
      return count
    },

    // -------------------------------------------------------------------------
    // Raw Access
    // -------------------------------------------------------------------------

    getClient(): TClient {
      return client
    },
  }

  // -------------------------------------------------------------------------
  // Add batch operations if supported (cast to any for extension)
  // -------------------------------------------------------------------------

  const extendedDriver = driver as any

  if (customDriver.createMany) {
    extendedDriver.createMany = async <T>(
      entity: string,
      data: Record<string, unknown>[]
    ): Promise<T[]> => {
      const model = getModelName(entity)
      log.input("createMany", { model, count: data.length })

      const transformedData = await Promise.all(
        data.map(d => transformInput(d, entity))
      )
      log.query("createMany", { model, count: transformedData.length })

      const results = await customDriver.createMany!<T>({ model, data: transformedData })
      log.output("createMany", { count: results.length })
      return results
    }
  }

  if (customDriver.updateMany) {
    extendedDriver.updateMany = async <T>(
      entity: string,
      where: Where,
      data: Record<string, unknown>
    ): Promise<{ count: number }> => {
      const model = getModelName(entity)
      const normalizedWhere = normalizeWhereOperators(where)
      const transformedData = await transformInput(data, entity)

      log.query("updateMany", { model, where: normalizedWhere })
      const result = await customDriver.updateMany!({ model, where: normalizedWhere, update: transformedData })
      log.output("updateMany", result)
      return result
    }
  }

  if (customDriver.deleteMany) {
    extendedDriver.deleteMany = async (
      entity: string,
      where: Where
    ): Promise<{ count: number }> => {
      const model = getModelName(entity)
      const normalizedWhere = normalizeWhereOperators(where)

      log.query("deleteMany", { model, where: normalizedWhere })
      const result = await customDriver.deleteMany!({ model, where: normalizedWhere })
      log.output("deleteMany", result)
      return result
    }
  }

  if (customDriver.upsert) {
    extendedDriver.upsert = async <T>(
      entity: string,
      where: Where,
      create: Record<string, unknown>,
      update: Record<string, unknown>
    ): Promise<T> => {
      const model = getModelName(entity)
      const normalizedWhere = normalizeWhereOperators(where)
      const transformedCreate = await transformInput(create, entity)
      const transformedUpdate = await transformInput(update, entity)

      log.query("upsert", { model, where: normalizedWhere })
      const result = await customDriver.upsert!<T>({
        model,
        where: normalizedWhere,
        create: transformedCreate,
        update: transformedUpdate,
      })

      const transformed = await transformOutput(result, entity)
      log.output("upsert", transformed)
      return transformed
    }
  }

  if (customDriver.findFirst) {
    extendedDriver.findFirst = async <T>(
      entity: string,
      options?: QueryOptions
    ): Promise<T | null> => {
      const model = getModelName(entity)
      const normalizedWhere = options?.where
        ? normalizeWhereOperators(options.where)
        : undefined
      const normalizedOrderBy = options?.orderBy
        ? normalizeSortDirection(options.orderBy)
        : undefined

      log.query("findFirst", { model, where: normalizedWhere })
      const result = await customDriver.findFirst!<T>({
        model,
        where: normalizedWhere,
        orderBy: normalizedOrderBy as Record<string, "asc" | "desc">,
        include: options?.include,
      })

      const transformed = result ? await transformOutput(result, entity) : null
      log.output("findFirst", transformed)
      return transformed
    }
  }

  if (customDriver.exists) {
    extendedDriver.exists = async (entity: string, where: Where): Promise<boolean> => {
      const model = getModelName(entity)
      const normalizedWhere = normalizeWhereOperators(where)
      log.query("exists", { model, where: normalizedWhere })
      return customDriver.exists!({ model, where: normalizedWhere })
    }
  }

  if (customDriver.aggregate) {
    extendedDriver.aggregate = async <T>(
      entity: string,
      operations: {
        _count?: boolean | Record<string, boolean>
        _sum?: Record<string, boolean>
        _avg?: Record<string, boolean>
        _min?: Record<string, boolean>
        _max?: Record<string, boolean>
      },
      where?: Where
    ): Promise<T> => {
      const model = getModelName(entity)
      const normalizedWhere = where ? normalizeWhereOperators(where) : undefined
      log.query("aggregate", { model, operations, where: normalizedWhere })
      return customDriver.aggregate!<T>({
        model,
        where: normalizedWhere,
        ...operations,
      })
    }
  }

  if (customDriver.groupBy) {
    extendedDriver.groupBy = async <T>(
      entity: string,
      by: string[],
      operations?: {
        _count?: boolean | Record<string, boolean>
        _sum?: Record<string, boolean>
        _avg?: Record<string, boolean>
      },
      where?: Where
    ): Promise<T[]> => {
      const model = getModelName(entity)
      const normalizedWhere = where ? normalizeWhereOperators(where) : undefined
      log.query("groupBy", { model, by, where: normalizedWhere })
      return customDriver.groupBy!<T>({
        model,
        by,
        where: normalizedWhere,
        ...operations,
      })
    }
  }

  return extendedDriver as Driver
}

// -----------------------------------------------------------------------------
// Re-exports
// -----------------------------------------------------------------------------

export type { Where, WhereOperator, QueryOptions, SortDirection, IncludeConfig } from "../types.js"
