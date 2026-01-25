// =============================================================================
// HYBRID SEARCH
// Combines vector similarity search with full-text search
// Implements RRF (Reciprocal Rank Fusion) for score combination
// =============================================================================

import type { Entity } from "../types.js"
import type { VectorSearchResult } from "./stores/types.js"
import type { TextSearchResult, TextSearchOptions } from "./search.js"
import type { RAGEngine, SemanticSearchResult } from "./index.js"
import { inMemoryTextSearch, getSearchableFields, hasSearchableFields } from "./search.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface HybridSearchConfig {
    /** Weight for vector search results (0-1) */
    vectorWeight: number
    /** Weight for text search results (0-1) */
    textWeight: number
    /** RRF constant k (default: 60) */
    rrfK?: number
    /** Normalize scores before combining (default: true) */
    normalizeScores?: boolean
}

export interface HybridSearchOptions extends TextSearchOptions {
    /** Search mode */
    mode: "vector" | "text" | "hybrid"
    /** Entity data for text search (map of entity name to records) */
    entityData?: Map<string, Array<{ id: string } & Record<string, unknown>>>
    /** Vector search options */
    vectorOptions?: {
        minScore?: number
    }
    /** Config overrides */
    config?: Partial<HybridSearchConfig>
}

export interface HybridSearchResult extends SemanticSearchResult {
    /** Vector similarity score (0-1) */
    vectorScore?: number
    /** Text match score (0-1, normalized) */
    textScore?: number
    /** Combined hybrid score using RRF */
    hybridScore?: number
    /** Vector rank (1-based) */
    vectorRank?: number
    /** Text rank (1-based) */
    textRank?: number
    /** Source of the result */
    source: "vector" | "text" | "both"
}

// -----------------------------------------------------------------------------
// Reciprocal Rank Fusion (RRF)
// -----------------------------------------------------------------------------

/**
 * Calculate RRF score from rank
 * RRF(d) = 1 / (k + rank(d))
 * where k is a constant (typically 60)
 */
function rrfScore(rank: number, k: number = 60): number {
    return 1 / (k + rank)
}

/**
 * Normalize scores to 0-1 range
 */
function normalizeScores(results: Array<{ id: string; score: number }>): Array<{ id: string; score: number }> {
    if (results.length === 0) return []

    const maxScore = Math.max(...results.map(r => r.score))
    const minScore = Math.min(...results.map(r => r.score))
    const range = maxScore - minScore

    if (range === 0) {
        return results.map(r => ({ ...r, score: 1 }))
    }

    return results.map(r => ({
        ...r,
        score: (r.score - minScore) / range,
    }))
}

// -----------------------------------------------------------------------------
// Hybrid Search Engine
// -----------------------------------------------------------------------------

/**
 * Hybrid search combining vector and full-text search
 *
 * @example
 * ```typescript
 * const hybrid = createHybridSearch(ragEngine, entities, {
 *   vectorWeight: 0.7,
 *   textWeight: 0.3,
 * })
 *
 * const results = await hybrid.search("customer support issues", {
 *   mode: "hybrid",
 *   entityData: new Map([["ticket", ticketRecords]]),
 *   limit: 10,
 * })
 * ```
 */
export function createHybridSearch(
    engine: RAGEngine,
    entities: Map<string, Entity>,
    config: HybridSearchConfig
) {
    const { vectorWeight, textWeight, rrfK = 60, normalizeScores: shouldNormalize = true } = config

    return {
        /**
         * Perform hybrid search
         */
        async search(
            query: string,
            options: HybridSearchOptions
        ): Promise<HybridSearchResult[]> {
            const {
                mode,
                entityData,
                entities: targetEntities,
                limit = 10,
                vectorOptions = {},
                config: configOverrides = {},
            } = options

            const vWeight = configOverrides.vectorWeight ?? vectorWeight
            const tWeight = configOverrides.textWeight ?? textWeight
            const k = configOverrides.rrfK ?? rrfK

            // Vector-only search
            if (mode === "vector") {
                const vectorResults = await engine.search(query, {
                    entities: targetEntities,
                    limit,
                    minScore: vectorOptions.minScore,
                })

                return vectorResults.map((r, i) => ({
                    ...r,
                    vectorScore: r.score,
                    vectorRank: i + 1,
                    source: "vector" as const,
                }))
            }

            // Text-only search
            if (mode === "text") {
                return performTextSearch(query, entities, entityData, targetEntities, limit)
            }

            // Hybrid search - combine vector and text results
            const [vectorResults, textResults] = await Promise.all([
                engine.search(query, {
                    entities: targetEntities,
                    limit: limit * 2, // Get more for fusion
                    minScore: vectorOptions.minScore,
                }),
                Promise.resolve(
                    performTextSearch(query, entities, entityData, targetEntities, limit * 2)
                ),
            ])

            // Build result map keyed by entity:recordId
            const resultMap = new Map<string, HybridSearchResult>()

            // Add vector results with ranks
            for (let i = 0; i < vectorResults.length; i++) {
                const r = vectorResults[i]
                const key = `${r.metadata?.entity}:${r.metadata?.recordId}`
                resultMap.set(key, {
                    ...r,
                    vectorScore: r.score,
                    vectorRank: i + 1,
                    source: "vector",
                })
            }

            // Merge text results
            for (let i = 0; i < textResults.length; i++) {
                const t = textResults[i]
                const key = `${t.metadata?.entity}:${t.metadata?.recordId}`
                const existing = resultMap.get(key)

                if (existing) {
                    // Found in both - update
                    existing.textScore = t.textScore
                    existing.textRank = i + 1
                    existing.source = "both"
                } else {
                    // Text-only result
                    resultMap.set(key, {
                        ...t,
                        textScore: t.textScore,
                        textRank: i + 1,
                        source: "text",
                    })
                }
            }

            // Calculate hybrid scores using RRF
            for (const result of resultMap.values()) {
                let hybridScore = 0

                if (result.vectorRank !== undefined) {
                    hybridScore += vWeight * rrfScore(result.vectorRank, k)
                }

                if (result.textRank !== undefined) {
                    hybridScore += tWeight * rrfScore(result.textRank, k)
                }

                result.hybridScore = hybridScore
            }

            // Sort by hybrid score and limit
            return Array.from(resultMap.values())
                .sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0))
                .slice(0, limit)
        },

        /**
         * Get search mode based on data availability
         */
        determineMode(options: {
            hasVectorStore: boolean
            hasEntityData: boolean
            preferredMode?: "vector" | "text" | "hybrid"
        }): "vector" | "text" | "hybrid" {
            const { hasVectorStore, hasEntityData, preferredMode } = options

            if (preferredMode) {
                // Validate preferred mode is possible
                if (preferredMode === "vector" && hasVectorStore) return "vector"
                if (preferredMode === "text" && hasEntityData) return "text"
                if (preferredMode === "hybrid" && hasVectorStore && hasEntityData) return "hybrid"
            }

            // Auto-determine best mode
            if (hasVectorStore && hasEntityData) return "hybrid"
            if (hasVectorStore) return "vector"
            if (hasEntityData) return "text"

            return "vector" // Default
        },
    }
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Perform text search across entities
 */
function performTextSearch(
    query: string,
    entities: Map<string, Entity>,
    entityData: Map<string, Array<{ id: string } & Record<string, unknown>>> | undefined,
    targetEntities: string[] | undefined,
    limit: number
): HybridSearchResult[] {
    if (!entityData) return []

    const results: HybridSearchResult[] = []

    for (const [entityName, entity] of entities) {
        // Filter by target entities
        if (targetEntities && !targetEntities.includes(entityName)) continue

        // Check if entity has searchable fields
        if (!hasSearchableFields(entity)) continue

        // Get records for this entity
        const records = entityData.get(entityName)
        if (!records || records.length === 0) continue

        // Get searchable field names
        const searchableFields = getSearchableFields(entity)
        const fieldNames = Array.from(searchableFields.keys())

        // Perform in-memory text search
        const textResults = inMemoryTextSearch(records, query, fieldNames, { limit })

        // Convert to hybrid results
        for (const r of textResults) {
            results.push({
                id: `${entityName}:${r.id}:text`,
                score: r._searchScore / 100, // Normalize to 0-1 range
                metadata: {
                    entity: entityName,
                    field: fieldNames[0], // Primary searchable field
                    recordId: r.id,
                },
                textScore: r._searchScore / 100,
                source: "text",
            })
        }
    }

    // Sort by text score and limit
    return results
        .sort((a, b) => (b.textScore || 0) - (a.textScore || 0))
        .slice(0, limit)
}

/**
 * Merge vector and text results using weighted combination
 * Alternative to RRF for simple use cases
 */
export function mergeResultsWeighted(
    vectorResults: VectorSearchResult[],
    textResults: TextSearchResult[],
    options: {
        vectorWeight: number
        textWeight: number
        limit: number
    }
): HybridSearchResult[] {
    const { vectorWeight, textWeight, limit } = options
    const resultMap = new Map<string, HybridSearchResult>()

    // Normalize vector scores
    const normalizedVector = normalizeScores(
        vectorResults.map(r => ({
            id: `${r.metadata.entity}:${r.metadata.recordId}`,
            score: r.score,
        }))
    )

    // Normalize text scores
    const normalizedText = normalizeScores(
        textResults.map(r => ({
            id: `${r.entity}:${r.recordId}`,
            score: r.score,
        }))
    )

    // Add vector results
    for (let i = 0; i < vectorResults.length; i++) {
        const r = vectorResults[i]
        const key = `${r.metadata.entity}:${r.metadata.recordId}`
        const normalizedScore = normalizedVector[i].score

        resultMap.set(key, {
            id: r.id,
            score: r.score,
            metadata: r.metadata,
            vectorScore: r.score,
            hybridScore: normalizedScore * vectorWeight,
            source: "vector",
        })
    }

    // Merge text results
    for (let i = 0; i < textResults.length; i++) {
        const t = textResults[i]
        const key = `${t.entity}:${t.recordId}`
        const normalizedScore = normalizedText[i].score
        const existing = resultMap.get(key)

        if (existing) {
            existing.textScore = t.score
            existing.hybridScore = (existing.hybridScore || 0) + normalizedScore * textWeight
            existing.source = "both"
        } else {
            resultMap.set(key, {
                id: key,
                score: t.score,
                metadata: {
                    entity: t.entity,
                    recordId: t.recordId,
                    field: t.matches[0]?.field || "",
                },
                textScore: t.score,
                hybridScore: normalizedScore * textWeight,
                source: "text",
            })
        }
    }

    return Array.from(resultMap.values())
        .sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0))
        .slice(0, limit)
}

export default createHybridSearch
