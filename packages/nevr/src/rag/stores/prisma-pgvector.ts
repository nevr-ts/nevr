// =============================================================================
// PRISMA PGVECTOR STORE
// Vector store using PostgreSQL pgvector extension with Prisma
// =============================================================================

import type {
    VectorStore,
    VectorStoreConfig,
    VectorMetadata,
    VectorSearchResult,
    VectorSearchOptions,
} from "./types.js"
import { VectorStoreError } from "./types.js"

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

export interface PrismaPgvectorConfig extends VectorStoreConfig {
    type: "prisma-pgvector"
    connection: {
        /** Prisma client instance */
        prisma: PrismaClientLike
        /** Table name for vectors (default: "nevr_vectors") */
        tableName?: string
        /** Schema name (default: "public") */
        schema?: string
        /** Vector dimensions (default: 1536 for OpenAI) */
        dimensions?: number
        /** Index type: "ivfflat" | "hnsw" (default: "hnsw") */
        indexType?: "ivfflat" | "hnsw"
        /** HNSW m parameter (default: 16) */
        hnswM?: number
        /** HNSW ef_construction parameter (default: 64) */
        hnswEfConstruction?: number
        /** IVF lists parameter (default: 100) */
        ivfLists?: number
    }
}

/** Minimal Prisma client interface */
interface PrismaClientLike {
    $queryRaw: <T>(query: TemplateStringsArray | string, ...values: any[]) => Promise<T>
    $executeRaw: (query: TemplateStringsArray | string, ...values: any[]) => Promise<number>
    $queryRawUnsafe: <T>(query: string, ...values: any[]) => Promise<T>
    $executeRawUnsafe: (query: string, ...values: any[]) => Promise<number>
}

// -----------------------------------------------------------------------------
// Prisma PGVector Store
// -----------------------------------------------------------------------------

/**
 * Prisma PGVector Store
 *
 * Uses PostgreSQL's pgvector extension for efficient vector storage and similarity search.
 * Requires pgvector extension to be installed in PostgreSQL.
 *
 * @example
 * ```typescript
 * // Install pgvector extension in PostgreSQL:
 * // CREATE EXTENSION IF NOT EXISTS vector;
 *
 * import { PrismaClient } from "@prisma/client"
 * import { PrismaPgvectorStore } from "nevr/rag"
 *
 * const prisma = new PrismaClient()
 *
 * const store = new PrismaPgvectorStore({
 *   type: "prisma-pgvector",
 *   connection: {
 *     prisma,
 *     tableName: "nevr_vectors",
 *     dimensions: 1536,
 *   },
 * })
 *
 * // Initialize the table (run once)
 * await store.initialize()
 *
 * // Use the store
 * await store.upsert("post:123:content", [...], { entity: "post", field: "content", recordId: "123" })
 * const results = await store.search([...], { limit: 10 })
 * ```
 */
export class PrismaPgvectorStore implements VectorStore {
    readonly name = "prisma-pgvector"

    private prisma: PrismaClientLike
    private tableName: string
    private schema: string
    private dimensions: number
    private indexType: "ivfflat" | "hnsw"
    private hnswM: number
    private hnswEfConstruction: number
    private ivfLists: number
    private namespace: string
    private initialized = false

    constructor(config: PrismaPgvectorConfig) {
        if (!config.connection?.prisma) {
            throw new VectorStoreError("Prisma client is required", "prisma-pgvector")
        }

        this.prisma = config.connection.prisma
        this.tableName = config.connection.tableName || "nevr_vectors"
        this.schema = config.connection.schema || "public"
        this.dimensions = config.connection.dimensions || 1536
        this.indexType = config.connection.indexType || "hnsw"
        this.hnswM = config.connection.hnswM || 16
        this.hnswEfConstruction = config.connection.hnswEfConstruction || 64
        this.ivfLists = config.connection.ivfLists || 100
        this.namespace = config.namespace || "default"
    }

    /**
     * Get fully qualified table name
     */
    private get fullTableName(): string {
        return `"${this.schema}"."${this.tableName}"`
    }

    /**
     * Initialize the vector table and index
     * Should be called once during application startup
     */
    async initialize(): Promise<void> {
        if (this.initialized) return

        try {
            // Ensure pgvector extension exists
            await this.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`)

            // Create table if not exists
            await this.prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS ${this.fullTableName} (
                    id TEXT PRIMARY KEY,
                    namespace TEXT NOT NULL DEFAULT 'default',
                    vector vector(${this.dimensions}),
                    metadata JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `)

            // Create indexes
            await this.prisma.$executeRawUnsafe(`
                CREATE INDEX IF NOT EXISTS idx_${this.tableName}_namespace
                ON ${this.fullTableName} (namespace)
            `)

            await this.prisma.$executeRawUnsafe(`
                CREATE INDEX IF NOT EXISTS idx_${this.tableName}_metadata_entity
                ON ${this.fullTableName} ((metadata->>'entity'))
            `)

            await this.prisma.$executeRawUnsafe(`
                CREATE INDEX IF NOT EXISTS idx_${this.tableName}_metadata_record
                ON ${this.fullTableName} ((metadata->>'recordId'))
            `)

            // Create vector similarity index
            if (this.indexType === "hnsw") {
                await this.prisma.$executeRawUnsafe(`
                    CREATE INDEX IF NOT EXISTS idx_${this.tableName}_vector_hnsw
                    ON ${this.fullTableName}
                    USING hnsw (vector vector_cosine_ops)
                    WITH (m = ${this.hnswM}, ef_construction = ${this.hnswEfConstruction})
                `)
            } else {
                await this.prisma.$executeRawUnsafe(`
                    CREATE INDEX IF NOT EXISTS idx_${this.tableName}_vector_ivfflat
                    ON ${this.fullTableName}
                    USING ivfflat (vector vector_cosine_ops)
                    WITH (lists = ${this.ivfLists})
                `)
            }

            this.initialized = true
        } catch (error) {
            throw new VectorStoreError(
                `Failed to initialize pgvector table: ${error instanceof Error ? error.message : String(error)}`,
                "prisma-pgvector",
                error instanceof Error ? error : undefined
            )
        }
    }

    /**
     * Convert vector array to pgvector format
     */
    private vectorToString(vector: number[]): string {
        return `[${vector.join(",")}]`
    }

    async upsert(id: string, vector: number[], metadata: VectorMetadata): Promise<void> {
        await this.ensureInitialized()

        const vectorStr = this.vectorToString(vector)
        const metadataJson = JSON.stringify(metadata)

        await this.prisma.$executeRawUnsafe(`
            INSERT INTO ${this.fullTableName} (id, namespace, vector, metadata, updated_at)
            VALUES ($1, $2, $3::vector, $4::jsonb, NOW())
            ON CONFLICT (id) DO UPDATE SET
                vector = EXCLUDED.vector,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        `, id, this.namespace, vectorStr, metadataJson)
    }

    async upsertBatch(items: Array<{ id: string; vector: number[]; metadata: VectorMetadata }>): Promise<void> {
        await this.ensureInitialized()

        if (items.length === 0) return

        // Use a transaction for batch upsert
        const values = items.map((item, i) => {
            const offset = i * 4
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}::vector, $${offset + 4}::jsonb, NOW())`
        }).join(", ")

        const params: any[] = []
        for (const item of items) {
            params.push(item.id, this.namespace, this.vectorToString(item.vector), JSON.stringify(item.metadata))
        }

        await this.prisma.$executeRawUnsafe(`
            INSERT INTO ${this.fullTableName} (id, namespace, vector, metadata, updated_at)
            VALUES ${values}
            ON CONFLICT (id) DO UPDATE SET
                vector = EXCLUDED.vector,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        `, ...params)
    }

    async search(queryVector: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
        await this.ensureInitialized()

        const { limit = 10, minScore = 0, entities, fields, filter } = options
        const vectorStr = this.vectorToString(queryVector)

        // Build WHERE clause
        const conditions: string[] = [`namespace = $1`]
        const params: any[] = [this.namespace]
        let paramIndex = 2

        if (entities && entities.length > 0) {
            conditions.push(`metadata->>'entity' = ANY($${paramIndex})`)
            params.push(entities)
            paramIndex++
        }

        if (fields && fields.length > 0) {
            conditions.push(`metadata->>'field' = ANY($${paramIndex})`)
            params.push(fields)
            paramIndex++
        }

        if (filter) {
            for (const [key, value] of Object.entries(filter)) {
                conditions.push(`metadata->>'${key}' = $${paramIndex}`)
                params.push(String(value))
                paramIndex++
            }
        }

        const whereClause = conditions.join(" AND ")

        // Cosine similarity: 1 - cosine_distance
        // pgvector uses <=> for cosine distance
        const results = await this.prisma.$queryRawUnsafe<Array<{
            id: string
            score: number
            metadata: VectorMetadata
        }>>(`
            SELECT
                id,
                1 - (vector <=> $${paramIndex}::vector) as score,
                metadata
            FROM ${this.fullTableName}
            WHERE ${whereClause}
            ORDER BY vector <=> $${paramIndex}::vector
            LIMIT $${paramIndex + 1}
        `, ...params, vectorStr, limit)

        return results
            .filter(r => r.score >= minScore)
            .map(r => ({
                id: r.id,
                score: r.score,
                metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata,
            }))
    }

    async delete(id: string): Promise<void> {
        await this.ensureInitialized()

        await this.prisma.$executeRawUnsafe(`
            DELETE FROM ${this.fullTableName}
            WHERE id = $1 AND namespace = $2
        `, id, this.namespace)
    }

    async deleteByFilter(filter: { entity?: string; recordId?: string }): Promise<number> {
        await this.ensureInitialized()

        const conditions: string[] = [`namespace = $1`]
        const params: any[] = [this.namespace]
        let paramIndex = 2

        if (filter.entity) {
            conditions.push(`metadata->>'entity' = $${paramIndex}`)
            params.push(filter.entity)
            paramIndex++
        }

        if (filter.recordId) {
            conditions.push(`metadata->>'recordId' = $${paramIndex}`)
            params.push(filter.recordId)
            paramIndex++
        }

        const whereClause = conditions.join(" AND ")

        const result = await this.prisma.$executeRawUnsafe(`
            DELETE FROM ${this.fullTableName}
            WHERE ${whereClause}
        `, ...params)

        return result
    }

    async get(id: string): Promise<{ vector: number[]; metadata: VectorMetadata } | null> {
        await this.ensureInitialized()

        const results = await this.prisma.$queryRawUnsafe<Array<{
            vector: string
            metadata: VectorMetadata
        }>>(`
            SELECT vector::text, metadata
            FROM ${this.fullTableName}
            WHERE id = $1 AND namespace = $2
            LIMIT 1
        `, id, this.namespace)

        if (results.length === 0) return null

        const row = results[0]
        // Parse vector from pgvector string format "[0.1,0.2,...]"
        const vectorStr = row.vector.replace(/^\[|\]$/g, "")
        const vector = vectorStr.split(",").map(Number)

        return {
            vector,
            metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
        }
    }

    async count(filter?: { entity?: string }): Promise<number> {
        await this.ensureInitialized()

        const conditions: string[] = [`namespace = $1`]
        const params: any[] = [this.namespace]

        if (filter?.entity) {
            conditions.push(`metadata->>'entity' = $2`)
            params.push(filter.entity)
        }

        const whereClause = conditions.join(" AND ")

        const results = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
            SELECT COUNT(*) as count
            FROM ${this.fullTableName}
            WHERE ${whereClause}
        `, ...params)

        return Number(results[0]?.count || 0)
    }

    /**
     * Drop the vector table (use with caution!)
     */
    async drop(): Promise<void> {
        await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${this.fullTableName}`)
        this.initialized = false
    }

    /**
     * Vacuum and analyze the table for optimal performance
     */
    async optimize(): Promise<void> {
        await this.ensureInitialized()
        await this.prisma.$executeRawUnsafe(`VACUUM ANALYZE ${this.fullTableName}`)
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize()
        }
    }
}

export default PrismaPgvectorStore
