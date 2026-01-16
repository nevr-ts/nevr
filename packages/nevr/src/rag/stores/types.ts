// =============================================================================
// VECTOR STORE TYPES
// Abstraction layer for vector databases (Prisma pgvector, Pinecone, etc.)
// =============================================================================

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
    /** Store type */
    type: "memory" | "prisma-pgvector" | "pinecone" | string
    /** Connection options (store-specific) */
    connection?: Record<string, unknown>
    /** Namespace/collection for vector isolation */
    namespace?: string
}

/**
 * Search result from vector store
 */
export interface VectorSearchResult {
    /** Unique identifier (entity:recordId:field) */
    id: string
    /** Similarity score (0-1, higher = more similar) */
    score: number
    /** Associated metadata */
    metadata: VectorMetadata
    /** The original vector (optional, for debugging) */
    vector?: number[]
}

/**
 * Metadata stored with each vector
 */
export interface VectorMetadata {
    /** Entity name */
    entity: string
    /** Field name */
    field: string
    /** Record ID in database */
    recordId: string
    /** Original text (truncated for storage) */
    text?: string
    /** Any additional user metadata */
    [key: string]: unknown
}

/**
 * Search options
 */
export interface VectorSearchOptions {
    /** Maximum results to return */
    limit?: number
    /** Minimum similarity score (0-1) */
    minScore?: number
    /** Filter by entities */
    entities?: string[]
    /** Filter by fields */
    fields?: string[]
    /** Custom metadata filters */
    filter?: Record<string, unknown>
}

/**
 * Vector store interface
 * Implement this to add support for new vector databases
 */
export interface VectorStore {
    /** Store name */
    readonly name: string

    /**
     * Insert or update a vector
     */
    upsert(id: string, vector: number[], metadata: VectorMetadata): Promise<void>

    /**
     * Batch upsert vectors
     */
    upsertBatch(items: Array<{ id: string; vector: number[]; metadata: VectorMetadata }>): Promise<void>

    /**
     * Search for similar vectors
     */
    search(queryVector: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>

    /**
     * Delete a vector by ID
     */
    delete(id: string): Promise<void>

    /**
     * Delete vectors by filter
     */
    deleteByFilter(filter: { entity?: string; recordId?: string }): Promise<number>

    /**
     * Get a vector by ID
     */
    get(id: string): Promise<{ vector: number[]; metadata: VectorMetadata } | null>

    /**
     * Count vectors (optionally filtered)
     */
    count(filter?: { entity?: string }): Promise<number>
}

/**
 * Error thrown when vector store operations fail
 */
export class VectorStoreError extends Error {
    constructor(
        message: string,
        public readonly store: string,
        public readonly cause?: Error
    ) {
        super(`[${store}] ${message}`)
        this.name = "VectorStoreError"
    }
}
