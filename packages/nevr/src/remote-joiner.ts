// =============================================================================
// REMOTE JOINER (Pillar 2: Link Engine)
// API-level stitching for cross-service data
//
// Architecture:
// - Remote relations are joined at API level, not database level
// - Enables true domain isolation (plugins like Stripe, Auth can be separate)
// - No foreign keys in database - virtual links via API
// - Transparent to the client (same response format as local relations)
// =============================================================================

import type { Entity, Driver, RelationDef, IncludeConfig } from "./types.js"
import type { ServiceContainer } from "./container.js"
import { getLogger } from "./logger.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Remote fetch result
 */
interface RemoteFetchResult {
  data: Record<string, unknown>[]
  byId: Map<string, Record<string, unknown>>
}

/**
 * Remote joiner options
 */
export interface RemoteJoinerOptions {
  /** Default batch size for fetching remote data */
  batchSize?: number
  /** Timeout for remote fetches in ms */
  timeout?: number
  /** Cache remote results */
  cache?: boolean
}

/**
 * Stitching context for a single request
 */
interface StitchContext {
  entities: Map<string, Entity>
  container: ServiceContainer
  driver: Driver
}

// -----------------------------------------------------------------------------
// Remote Joiner Class
// -----------------------------------------------------------------------------

export class RemoteJoiner {
  private options: Required<RemoteJoinerOptions>

  constructor(options: RemoteJoinerOptions = {}) {
    this.options = {
      batchSize: options.batchSize ?? 100,
      timeout: options.timeout ?? 5000,
      cache: options.cache ?? true,
    }
  }

  /**
   * Stitch remote relations onto records
   *
   * @param records - Records to stitch onto
   * @param entity - Entity definition
   * @param include - Include configuration
   * @param ctx - Stitching context
   */
  async stitch<T extends Record<string, unknown>>(
    records: T[],
    entity: Entity,
    include: Record<string, boolean | IncludeConfig>,
    ctx: StitchContext
  ): Promise<(T & Record<string, any>)[]> {
    if (records.length === 0) return records

    const { fields } = entity.config
    const remoteRelations: { fieldName: string; relation: RelationDef; includeConfig: boolean | IncludeConfig }[] = []

    // Find remote relations in include
    for (const [fieldName, includeConfig] of Object.entries(include)) {
      const fieldDef = fields[fieldName]
      if (!fieldDef?.relation?.remote) continue

      remoteRelations.push({
        fieldName,
        relation: fieldDef.relation,
        includeConfig,
      })
    }

    if (remoteRelations.length === 0) return records

    // Stitch each remote relation
    for (const { fieldName, relation, includeConfig } of remoteRelations) {
      await this.stitchRelation(records, fieldName, relation, includeConfig, ctx)
    }

    return records
  }

  /**
   * Stitch a single remote relation onto records
   */
  private async stitchRelation<T extends Record<string, unknown>>(
    records: T[],
    fieldName: string,
    relation: RelationDef,
    includeConfig: boolean | IncludeConfig,
    ctx: StitchContext
  ): Promise<void> {
    const foreignKey = relation.foreignKey
    const referencedEntity = relation.entity()

    // Collect IDs to fetch
    const idsToFetch = new Set<string>()
    for (const record of records) {
      const fkValue = record[foreignKey]
      if (fkValue && typeof fkValue === "string") {
        idsToFetch.add(fkValue)
      }
    }

    if (idsToFetch.size === 0) return

    // Fetch remote data
    const remoteData = await this.fetchRemoteData(
      referencedEntity.name,
      Array.from(idsToFetch),
      relation,
      includeConfig,
      ctx
    )

    // Stitch onto records
    for (const record of records) {
      const fkValue = record[foreignKey] as string
      if (fkValue && remoteData.byId.has(fkValue)) {
        (record as any)[fieldName] = remoteData.byId.get(fkValue)
      } else {
        (record as any)[fieldName] = null
      }
    }
  }

  /**
   * Fetch remote data by IDs
   */
  private async fetchRemoteData(
    entityName: string,
    ids: string[],
    relation: RelationDef,
    includeConfig: boolean | IncludeConfig,
    ctx: StitchContext
  ): Promise<RemoteFetchResult> {
    // Batch fetch to avoid overloading
    const batches = this.chunk(ids, this.options.batchSize)
    const allData: Record<string, unknown>[] = []

    for (const batch of batches) {
      const batchData = await this.fetchBatch(entityName, batch, relation, includeConfig, ctx)
      allData.push(...batchData)
    }

    // Build ID map
    const byId = new Map<string, Record<string, unknown>>()
    for (const record of allData) {
      const id = record[relation.references] as string
      if (id) {
        byId.set(id, record)
      }
    }

    return { data: allData, byId }
  }

  /**
   * Fetch a batch of records
   */
  private async fetchBatch(
    entityName: string,
    ids: string[],
    relation: RelationDef,
    includeConfig: boolean | IncludeConfig,
    ctx: StitchContext
  ): Promise<Record<string, unknown>[]> {
    // If remoteService is specified, use that service
    if (relation.remoteService) {
      try {
        const service = ctx.container.resolve<RemoteService>(relation.remoteService)
        return await service.fetchByIds(entityName, ids, { include: includeConfig })
      } catch (error) {
        getLogger().error(`[RemoteJoiner] Failed to fetch from service "${relation.remoteService}":`, error)
        return []
      }
    }

    // Otherwise use the default driver
    try {
      const where = { [relation.references]: { in: ids } }
      const select = typeof includeConfig === "object" && includeConfig.select
        ? includeConfig.select
        : undefined

      return await ctx.driver.findMany<Record<string, unknown>>(entityName, {
        where,
        select,
      })
    } catch (error) {
      getLogger().error(`[RemoteJoiner] Failed to fetch from driver:`, error)
      return []
    }
  }

  /**
   * Split array into chunks
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

// -----------------------------------------------------------------------------
// Remote Service Interface
// -----------------------------------------------------------------------------

/**
 * Interface for remote services that provide data
 * Plugins can implement this to serve as data sources for remote relations
 */
export interface RemoteService {
  /** Fetch records by IDs */
  fetchByIds(
    entityName: string,
    ids: string[],
    options?: { include?: boolean | IncludeConfig; select?: string[] }
  ): Promise<Record<string, unknown>[]>

  /** Fetch a single record by ID */
  fetchById?(
    entityName: string,
    id: string,
    options?: { include?: boolean | IncludeConfig; select?: string[] }
  ): Promise<Record<string, unknown> | null>
}

// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------

/**
 * Create a remote joiner instance
 */
export function createRemoteJoiner(options?: RemoteJoinerOptions): RemoteJoiner {
  return new RemoteJoiner(options)
}

// -----------------------------------------------------------------------------
// Integration Helper
// -----------------------------------------------------------------------------

/**
 * Check if an entity has remote relations that need stitching
 */
export function hasRemoteRelations(entity: Entity): boolean {
  const { fields } = entity.config

  for (const fieldDef of Object.values(fields)) {
    if (fieldDef.relation?.remote) {
      return true
    }
  }

  return false
}

/**
 * Get remote relation field names from entity
 */
export function getRemoteRelationFields(entity: Entity): string[] {
  const { fields } = entity.config
  const remoteFields: string[] = []

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    if (fieldDef.relation?.remote) {
      remoteFields.push(fieldName)
    }
  }

  return remoteFields
}

/**
 * Filter include config to only local relations
 * Returns the local includes for the driver and remote includes for the joiner
 */
export function splitIncludes(
  entity: Entity,
  include: Record<string, boolean | IncludeConfig>
): {
  local: Record<string, boolean | IncludeConfig>
  remote: Record<string, boolean | IncludeConfig>
} {
  const { fields } = entity.config
  const local: Record<string, boolean | IncludeConfig> = {}
  const remote: Record<string, boolean | IncludeConfig> = {}

  for (const [fieldName, config] of Object.entries(include)) {
    const fieldDef = fields[fieldName]

    if (fieldDef?.relation?.remote) {
      remote[fieldName] = config
    } else {
      local[fieldName] = config
    }
  }

  return { local, remote }
}

/**
 * Validate that all remote relations have their services registered
 * Call this during application startup to catch configuration errors early
 *
 * @returns Array of error messages, empty if all services are registered
 */
export function validateRemoteRelations(
  entities: Map<string, Entity>,
  container: ServiceContainer
): string[] {
  const errors: string[] = []

  for (const [entityName, entity] of entities) {
    const { fields } = entity.config

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      if (!fieldDef.relation?.remote) continue

      const serviceId = fieldDef.relation.remoteService
      if (!serviceId) {
        errors.push(
          `[${entityName}.${fieldName}] Remote relation is missing 'remoteService'. ` +
          `Use .remote("serviceId") to specify the service.`
        )
        continue
      }

      // Check if service is registered
      if (!container.has(serviceId)) {
        errors.push(
          `[${entityName}.${fieldName}] Remote service "${serviceId}" is not registered. ` +
          `Register it using container.register("${serviceId}", factory).`
        )
      }
    }
  }

  return errors
}
