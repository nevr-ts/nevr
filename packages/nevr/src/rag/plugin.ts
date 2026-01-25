// =============================================================================
// RAG PLUGIN
// Automatic embedding generation and semantic search for Nevr entities
// =============================================================================

import { createPlugin } from "../plugins/unified/facade.js"
import { getLogger } from "../logger.js"
import type { Entity } from "../types.js"
import type { RAGConfig, RAGEngine, SemanticSearchOptions, SemanticSearchResult } from "./index.js"
import { createRAGEngine, hasEmbeddingFields, setRAGEngine } from "./index.js"
import type { TextSearchOptions } from "./search.js"
import { hasSearchableFields, getSearchableFields } from "./search.js"
import { createHybridSearch, type HybridSearchResult as HybridResult } from "./hybrid.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RAGPluginOptions extends RAGConfig {
    /**
     * Enable hybrid search (combine vector + full-text)
     * @default false
     */
    hybridSearch?: boolean

    /**
     * Weight for vector search in hybrid mode (0-1)
     * @default 0.7
     */
    vectorWeight?: number

    /**
     * Weight for text search in hybrid mode (0-1)
     * @default 0.3
     */
    textWeight?: number

    /**
     * Entities to exclude from auto-generation
     * Useful for excluding auth entities, etc.
     */
    excludeEntities?: string[]

    /**
     * Enable debug logging
     * @default false
     */
    debug?: boolean
}

export interface HybridSearchOptions extends SemanticSearchOptions, TextSearchOptions {
    /**
     * Override vector weight for this search
     */
    vectorWeight?: number

    /**
     * Override text weight for this search
     */
    textWeight?: number

    /**
     * Search mode
     * - "vector": Vector search only
     * - "text": Full-text search only
     * - "hybrid": Combine both (default if hybridSearch enabled)
     */
    mode?: "vector" | "text" | "hybrid"

    /**
     * Entity data for full-text search
     * Map of entity name to array of records with id field
     * Required for text and hybrid search modes
     *
     * @example
     * ```typescript
     * const entityData = new Map([
     *   ["post", await api.post.findMany()],
     *   ["comment", await api.comment.findMany()],
     * ])
     * ```
     */
    entityData?: Map<string, Array<{ id: string } & Record<string, unknown>>>
}

export interface HybridSearchResult extends SemanticSearchResult {
    /** Vector similarity score (0-1) */
    vectorScore?: number
    /** Text match score (0-1) */
    textScore?: number
    /** Combined hybrid score */
    hybridScore?: number
    /** Source of the result */
    source: "vector" | "text" | "both"
}

// -----------------------------------------------------------------------------
// RAG Plugin Factory
// -----------------------------------------------------------------------------

/**
 * RAG Plugin for automatic embedding generation and semantic search
 *
 * @example
 * ```typescript
 * import { rag } from "nevr/plugins/rag"
 *
 * const api = nevr({
 *   entities: [post, comment],
 *   plugins: [
 *     rag({
 *       embedding: { provider: "openai" },
 *       vectorStore: { type: "memory" },
 *       autoGenerate: true,
 *       hybridSearch: true,
 *     }),
 *   ],
 * })
 *
 * // Auto-generates embeddings on create/update
 * await api.post.create({ title: "...", content: "..." })
 *
 * // Semantic search
 * const results = await api.rag.search("customer issues", { entities: ["post"] })
 * ```
 */
export const rag = createPlugin<RAGPluginOptions>({
    id: "rag",
    name: "RAG (Retrieval-Augmented Generation)",
    version: "1.0.0",
    description: "Automatic embedding generation and semantic search",

    defaults: {
        hybridSearch: false,
        vectorWeight: 0.7,
        textWeight: 0.3,
        excludeEntities: [],
        debug: false,
        autoGenerate: true,
    },

    validate: (options) => {
        const errors: string[] = []

        if (!options.embedding) {
            errors.push("Embedding configuration is required")
        }

        if (options.vectorWeight !== undefined && (options.vectorWeight < 0 || options.vectorWeight > 1)) {
            errors.push("vectorWeight must be between 0 and 1")
        }

        if (options.textWeight !== undefined && (options.textWeight < 0 || options.textWeight > 1)) {
            errors.push("textWeight must be between 0 and 1")
        }

        return errors
    },

    factory: (options) => {
        const {
            hybridSearch = false,
            vectorWeight = 0.7,
            textWeight = 0.3,
            excludeEntities = [],
            debug = false,
            ...ragConfig
        } = options

        const logger = getLogger()
        let engine: RAGEngine | null = null
        let entities: Map<string, Entity> = new Map()
        let hybridEngine: ReturnType<typeof createHybridSearch> | null = null

        const log = (message: string, ...args: any[]) => {
            if (debug) {
                logger.debug(`[rag] ${message}`, ...args)
            }
        }

        return {
            // Lifecycle hooks
            lifecycle: {
                onInit: async (nevr) => {
                    log("Initializing RAG engine...")

                    // Create RAG engine
                    engine = createRAGEngine(ragConfig)
                    setRAGEngine(engine)

                    // Collect entities for reference
                    if (nevr.entities) {
                        for (const entity of nevr.entities.values()) {
                            entities.set(entity.name, entity)
                            if (hasEmbeddingFields(entity)) {
                                log(`Entity "${entity.name}" has embedding fields`)
                            }
                        }
                    }

                    log("RAG engine initialized")

                    // Create hybrid search engine
                    hybridEngine = createHybridSearch(engine, entities, {
                        vectorWeight,
                        textWeight,
                        rrfK: 60,
                        normalizeScores: true,
                    })
                },
            },

            // Entity hooks for auto-generation
            entityHooks: ragConfig.autoGenerate ? {
                "*": {
                    create: {
                        after: async (ctx) => {
                            if (!engine) return

                            const entityName = (ctx as any).entityName || (ctx as any).entity?.name
                            if (!entityName || excludeEntities.includes(entityName)) return

                            const entity = entities.get(entityName)
                            if (!entity || !hasEmbeddingFields(entity)) return

                            const recordId = ctx.data.id as string
                            if (!recordId) return

                            try {
                                log(`Generating embeddings for ${entityName}:${recordId}`)
                                await engine.generateEmbeddings(entity, recordId, ctx.data as Record<string, unknown>)
                                log(`Embeddings generated for ${entityName}:${recordId}`)
                            } catch (error) {
                                logger.error(`[rag] Failed to generate embeddings for ${entityName}:${recordId}`, error)
                            }
                        },
                    },
                    update: {
                        after: async (ctx) => {
                            if (!engine) return

                            const entityName = (ctx as any).entityName || (ctx as any).entity?.name
                            if (!entityName || excludeEntities.includes(entityName)) return

                            const entity = entities.get(entityName)
                            if (!entity || !hasEmbeddingFields(entity)) return

                            const recordId = ctx.data.id as string
                            if (!recordId) return

                            try {
                                log(`Updating embeddings for ${entityName}:${recordId}`)
                                // Delete old embeddings and regenerate
                                await engine.deleteEmbeddings(entityName, recordId)
                                await engine.generateEmbeddings(entity, recordId, ctx.data as Record<string, unknown>)
                                log(`Embeddings updated for ${entityName}:${recordId}`)
                            } catch (error) {
                                logger.error(`[rag] Failed to update embeddings for ${entityName}:${recordId}`, error)
                            }
                        },
                    },
                    delete: {
                        after: async (ctx) => {
                            if (!engine) return

                            const entityName = (ctx as any).entityName || (ctx as any).entity?.name
                            if (!entityName || excludeEntities.includes(entityName)) return

                            const entity = entities.get(entityName)
                            if (!entity || !hasEmbeddingFields(entity)) return

                            const recordId = ctx.data.id as string
                            if (!recordId) return

                            try {
                                log(`Deleting embeddings for ${entityName}:${recordId}`)
                                await engine.deleteEmbeddings(entityName, recordId)
                                log(`Embeddings deleted for ${entityName}:${recordId}`)
                            } catch (error) {
                                logger.error(`[rag] Failed to delete embeddings for ${entityName}:${recordId}`, error)
                            }
                        },
                    },
                },
            } : undefined,

            // Expose methods on nevr.rag via getActions
            getActions: () => {
                return {
                    rag: {
                        /**
                         * Semantic/hybrid search
                         *
                         * @param query - Search query string
                         * @param searchOptions - Search options including mode, weights, and entity data
                         * @returns Array of search results with scores
                         *
                         * @example
                         * ```typescript
                         * // Vector search only
                         * const results = await api.rag.search("customer issues", { mode: "vector" })
                         *
                         * // Hybrid search with entity data for full-text
                         * const entityData = new Map([["ticket", await api.ticket.findMany()]])
                         * const results = await api.rag.search("urgent support", {
                         *   mode: "hybrid",
                         *   entityData,
                         * })
                         * ```
                         */
                        search: async (query: string, searchOptions: HybridSearchOptions = {}): Promise<HybridSearchResult[]> => {
                            if (!engine || !hybridEngine) {
                                throw new Error("RAG engine not initialized")
                            }

                            const mode = searchOptions.mode || (hybridSearch ? "hybrid" : "vector")
                            log(`Searching: "${query}" (mode: ${mode})`)

                            const results = await hybridEngine.search(query, {
                                mode,
                                entities: searchOptions.entities,
                                limit: searchOptions.limit || 10,
                                entityData: searchOptions.entityData,
                                vectorOptions: {
                                    minScore: searchOptions.minScore,
                                },
                                config: {
                                    vectorWeight: searchOptions.vectorWeight,
                                    textWeight: searchOptions.textWeight,
                                },
                            })

                            log(`Found ${results.length} results`)
                            return results as HybridSearchResult[]
                        },

                        /**
                         * Generate embeddings for a specific record
                         */
                        generateEmbeddings: async (entityName: string, recordId: string, data: Record<string, unknown>): Promise<void> => {
                            if (!engine) {
                                throw new Error("RAG engine not initialized")
                            }

                            const entity = entities.get(entityName)
                            if (!entity) {
                                throw new Error(`Entity "${entityName}" not found`)
                            }

                            await engine.generateEmbeddings(entity, recordId, data)
                        },

                        /**
                         * Delete embeddings for a specific record
                         */
                        deleteEmbeddings: async (entityName: string, recordId: string): Promise<void> => {
                            if (!engine) {
                                throw new Error("RAG engine not initialized")
                            }

                            await engine.deleteEmbeddings(entityName, recordId)
                        },

                        /**
                         * Bulk index all records for an entity
                         */
                        indexEntity: async (entityName: string, records: Array<{ id: string } & Record<string, unknown>>): Promise<{ indexed: number; errors: number }> => {
                            if (!engine) {
                                throw new Error("RAG engine not initialized")
                            }

                            const entity = entities.get(entityName)
                            if (!entity) {
                                throw new Error(`Entity "${entityName}" not found`)
                            }

                            if (!hasEmbeddingFields(entity)) {
                                return { indexed: 0, errors: 0 }
                            }

                            let indexed = 0
                            let errors = 0

                            for (const record of records) {
                                try {
                                    await engine.generateEmbeddings(entity, record.id, record)
                                    indexed++
                                } catch (error) {
                                    errors++
                                    logger.error(`[rag] Failed to index ${entityName}:${record.id}`, error)
                                }
                            }

                            log(`Indexed ${indexed} records for "${entityName}" (${errors} errors)`)
                            return { indexed, errors }
                        },

                        /**
                         * Clear all embeddings for an entity
                         */
                        clearEntity: async (entityName: string): Promise<void> => {
                            if (!engine) {
                                throw new Error("RAG engine not initialized")
                            }

                            await engine.store.deleteByFilter({ entity: entityName })
                            log(`Cleared embeddings for "${entityName}"`)
                        },

                        /**
                         * Get RAG engine for advanced operations
                         */
                        getEngine: () => engine,

                        /**
                         * Get hybrid search engine for advanced operations
                         */
                        getHybridEngine: () => hybridEngine,
                    },
                }
            },

            // HTTP Endpoints for client access
            endpoints: {
                // POST /rag/search - Semantic/hybrid search
                search: {
                    method: "POST",
                    path: "/search",
                    handler: async (ctx: any) => {
                        if (!engine || !hybridEngine) {
                            return { error: { code: "ENGINE_NOT_INITIALIZED", message: "RAG engine not initialized" } }
                        }

                        const { query, entities: searchEntities, limit, minScore, mode, vectorWeight: vw, textWeight: tw } = ctx.body || {}

                        if (!query || typeof query !== "string") {
                            return { error: { code: "INVALID_SEARCH_OPTIONS", message: "Query is required" } }
                        }

                        try {
                            const searchMode = mode || (hybridSearch ? "hybrid" : "vector")
                            const results = await hybridEngine.search(query as string, {
                                mode: searchMode,
                                entities: searchEntities,
                                limit: limit || 10,
                                vectorOptions: { minScore },
                                config: { vectorWeight: vw, textWeight: tw },
                            })

                            return { results }
                        } catch (error) {
                            logger.error("[rag] Search failed:", error)
                            return { error: { code: "SEARCH_FAILED", message: (error as Error).message } }
                        }
                    },
                },

                // POST /rag/index - Bulk index records
                index: {
                    method: "POST",
                    path: "/index",
                    handler: async (ctx: any) => {
                        if (!engine) {
                            return { error: { code: "ENGINE_NOT_INITIALIZED", message: "RAG engine not initialized" } }
                        }

                        const { entity: entityName, records } = ctx.body || {}

                        if (!entityName || !records || !Array.isArray(records)) {
                            return { error: { code: "INVALID_SEARCH_OPTIONS", message: "Entity name and records array required" } }
                        }

                        const entity = entities.get(entityName as string)
                        if (!entity) {
                            return { error: { code: "ENTITY_NOT_FOUND", message: `Entity "${entityName}" not found` } }
                        }

                        if (!hasEmbeddingFields(entity)) {
                            return { indexed: 0, errors: 0, message: "No embedding fields" }
                        }

                        let indexed = 0
                        let errors = 0

                        for (const record of records as Array<{ id: string } & Record<string, unknown>>) {
                            try {
                                await engine.generateEmbeddings(entity, record.id, record)
                                indexed++
                            } catch (error) {
                                errors++
                                logger.error(`[rag] Failed to index ${entityName}:${record.id}`, error)
                            }
                        }

                        return { indexed, errors }
                    },
                },

                // GET /rag/stats - Get indexing stats
                stats: {
                    method: "GET",
                    path: "/stats",
                    handler: async () => {
                        if (!engine) {
                            return { error: { code: "ENGINE_NOT_INITIALIZED", message: "RAG engine not initialized" } }
                        }

                        const totalVectors = await engine.store.count()
                        const byEntity: Record<string, { count: number; lastIndexed: string | null }> = {}

                        for (const entityName of entities.keys()) {
                            const count = await engine.store.count({ entity: entityName })
                            byEntity[entityName] = { count, lastIndexed: null }
                        }

                        return {
                            totalVectors,
                            byEntity,
                            provider: engine.provider.constructor.name,
                            storeType: engine.store.constructor.name,
                        }
                    },
                },

                // DELETE /rag/clear - Clear entity embeddings
                clear: {
                    method: "DELETE",
                    path: "/clear",
                    handler: async (ctx: any) => {
                        if (!engine) {
                            return { error: { code: "ENGINE_NOT_INITIALIZED", message: "RAG engine not initialized" } }
                        }

                        const { entity: entityName } = ctx.body || {}

                        if (!entityName || typeof entityName !== "string") {
                            return { error: { code: "INVALID_SEARCH_OPTIONS", message: "Entity name required" } }
                        }

                        await engine.store.deleteByFilter({ entity: entityName })
                        log(`Cleared embeddings for "${entityName}"`)

                        return { success: true }
                    },
                },
            } as any,

            // Type inference for SDK
            $Infer: {
                SearchResult: {} as HybridSearchResult,
            },
            $ERROR_CODES: {} as typeof import("./error-codes.js").RAG_ERROR_CODES,
        }
    },
})

export default rag
