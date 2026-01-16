// =============================================================================
// IN-MEMORY VECTOR STORE
// Simple in-memory store for development and testing
// Uses cosine similarity for vector search
// =============================================================================

import type {
    VectorStore,
    VectorStoreConfig,
    VectorMetadata,
    VectorSearchResult,
    VectorSearchOptions,
} from "./types.js"

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    if (magnitude === 0) return 0

    return dotProduct / magnitude
}

/**
 * Stored vector entry
 */
interface StoredVector {
    id: string
    vector: number[]
    metadata: VectorMetadata
}

/**
 * In-Memory Vector Store
 * 
 * Suitable for:
 * - Development and testing
 * - Small datasets (< 10,000 vectors)
 * - Prototyping before deploying to production store
 * 
 * NOT suitable for:
 * - Production workloads
 * - Persistence across restarts
 * - Large datasets
 * 
 * @example
 * ```typescript
 * const store = new InMemoryVectorStore()
 * 
 * await store.upsert("post:123:content", [0.1, 0.2, ...], {
 *   entity: "post",
 *   field: "content",
 *   recordId: "123",
 * })
 * 
 * const results = await store.search([0.15, 0.25, ...], { limit: 10 })
 * ```
 */
export class InMemoryVectorStore implements VectorStore {
    readonly name = "memory"

    private vectors = new Map<string, StoredVector>()
    private namespace: string

    constructor(config?: VectorStoreConfig) {
        this.namespace = config?.namespace || "default"
    }

    private getKey(id: string): string {
        return `${this.namespace}:${id}`
    }

    async upsert(id: string, vector: number[], metadata: VectorMetadata): Promise<void> {
        const key = this.getKey(id)
        this.vectors.set(key, { id, vector, metadata })
    }

    async upsertBatch(items: Array<{ id: string; vector: number[]; metadata: VectorMetadata }>): Promise<void> {
        for (const item of items) {
            await this.upsert(item.id, item.vector, item.metadata)
        }
    }

    async search(queryVector: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
        const { limit = 10, minScore = 0, entities, fields, filter } = options

        const results: VectorSearchResult[] = []

        for (const stored of this.vectors.values()) {
            // Apply filters
            if (entities && !entities.includes(stored.metadata.entity)) continue
            if (fields && !fields.includes(stored.metadata.field)) continue

            // Apply custom filter
            if (filter) {
                let match = true
                for (const [key, value] of Object.entries(filter)) {
                    if (stored.metadata[key] !== value) {
                        match = false
                        break
                    }
                }
                if (!match) continue
            }

            // Calculate similarity
            const score = cosineSimilarity(queryVector, stored.vector)

            if (score >= minScore) {
                results.push({
                    id: stored.id,
                    score,
                    metadata: stored.metadata,
                })
            }
        }

        // Sort by score descending and limit
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
    }

    async delete(id: string): Promise<void> {
        const key = this.getKey(id)
        this.vectors.delete(key)
    }

    async deleteByFilter(filter: { entity?: string; recordId?: string }): Promise<number> {
        let deleted = 0

        for (const [key, stored] of this.vectors.entries()) {
            let shouldDelete = true

            if (filter.entity && stored.metadata.entity !== filter.entity) {
                shouldDelete = false
            }
            if (filter.recordId && stored.metadata.recordId !== filter.recordId) {
                shouldDelete = false
            }

            if (shouldDelete) {
                this.vectors.delete(key)
                deleted++
            }
        }

        return deleted
    }

    async get(id: string): Promise<{ vector: number[]; metadata: VectorMetadata } | null> {
        const key = this.getKey(id)
        const stored = this.vectors.get(key)
        if (!stored) return null
        return { vector: stored.vector, metadata: stored.metadata }
    }

    async count(filter?: { entity?: string }): Promise<number> {
        if (!filter) return this.vectors.size

        let count = 0
        for (const stored of this.vectors.values()) {
            if (!filter.entity || stored.metadata.entity === filter.entity) {
                count++
            }
        }
        return count
    }

    /**
     * Clear all vectors (useful for testing)
     */
    clear(): void {
        this.vectors.clear()
    }

    /**
     * Get all vectors (useful for debugging)
     */
    getAll(): StoredVector[] {
        return Array.from(this.vectors.values())
    }
}
