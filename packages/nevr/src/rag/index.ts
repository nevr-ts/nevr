// =============================================================================
// RAG ENGINE
// Main module for Retrieval-Augmented Generation support
// Integrates embedding providers and vector stores with Nevr entities
// =============================================================================

// Re-export providers
export {
    type EmbeddingProvider,
    type EmbeddingProviderConfig,
    BaseEmbeddingProvider,
    EmbeddingError,
    OpenAIEmbeddingProvider,
    CohereEmbeddingProvider,
    getEmbeddingProvider,
    registerProvider,
    hasProvider,
    listProviders,
} from "./providers/index.js"

// Re-export stores
export {
    type VectorStore,
    type VectorStoreConfig,
    type VectorMetadata,
    type VectorSearchResult,
    type VectorSearchOptions,
    VectorStoreError,
    InMemoryVectorStore,
    getVectorStore,
    registerStore,
    hasStore,
    listStores,
} from "./stores/index.js"

// Re-export full-text search
export {
    type TextSearchResult,
    type TextSearchOptions,
    getSearchableFields,
    hasSearchableFields,
    buildPostgresSearchQuery,
    buildSqliteSearchQuery,
    inMemoryTextSearch,
    highlightMatches,
    extractSnippets,
} from "./search.js"

// Re-export hybrid search
export {
    type HybridSearchConfig,
    type HybridSearchOptions,
    type HybridSearchResult,
    createHybridSearch,
    mergeResultsWeighted,
} from "./hybrid.js"

// Re-export plugin
export { rag, type RAGPluginOptions } from "./plugin.js"

// Re-export error codes
export {
    RAG_ERROR_CODES,
    RAGError,
    isRAGError,
    isRAGErrorCode,
    type RAGErrorCode,
} from "./error-codes.js"

// Re-export client
export {
    ragClient,
    type RAGClientPlugin,
    type RAGClientOptions,
    type RAGClientMethods,
    type SearchParams,
    type SearchResult,
    type IndexParams,
    type IndexResult,
    type RAGStats,
    type SearchState,
} from "./client.js"

import type { Entity, FieldDef } from "../types.js"
import type { EmbeddingProvider, EmbeddingProviderConfig } from "./providers/index.js"
import type { VectorStore, VectorStoreConfig, VectorMetadata, VectorSearchResult, VectorSearchOptions } from "./stores/index.js"
import { getEmbeddingProvider } from "./providers/index.js"
import { getVectorStore } from "./stores/index.js"

// -----------------------------------------------------------------------------
// RAG Configuration
// -----------------------------------------------------------------------------

/**
 * RAG engine configuration
 */
export interface RAGConfig {
    /** Embedding provider configuration */
    embedding: EmbeddingProviderConfig
    /** Vector store configuration */
    vectorStore?: VectorStoreConfig
    /** Automatically generate embeddings on create/update */
    autoGenerate?: boolean
    /** Maximum text length to embed (will truncate) */
    maxTextLength?: number
}

/**
 * RAG engine instance
 */
export interface RAGEngine {
    /** Embedding provider */
    provider: EmbeddingProvider
    /** Vector store */
    store: VectorStore
    /** Configuration */
    config: RAGConfig

    /**
     * Generate and store embeddings for entity data
     */
    generateEmbeddings(
        entity: Entity,
        recordId: string,
        data: Record<string, unknown>
    ): Promise<void>

    /**
     * Delete embeddings for a record
     */
    deleteEmbeddings(entityName: string, recordId: string): Promise<void>

    /**
     * Semantic search across entities
     */
    search(query: string, options?: SemanticSearchOptions): Promise<SemanticSearchResult[]>
}

/**
 * Semantic search options
 */
export interface SemanticSearchOptions extends VectorSearchOptions {
    /** Include the original record data (requires DB lookup) */
    includeRecords?: boolean
}

/**
 * Semantic search result
 */
export interface SemanticSearchResult extends VectorSearchResult {
    /** Original record data (if includeRecords was true) */
    record?: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get fields marked for embedding from an entity
 */
export function getEmbeddingFields(entity: Entity): Map<string, NonNullable<FieldDef["semantic"]>["embedding"]> {
    const fields = new Map<string, NonNullable<FieldDef["semantic"]>["embedding"]>()

    for (const [fieldName, fieldDef] of Object.entries(entity.config.fields)) {
        if (fieldDef.semantic?.embedding) {
            fields.set(fieldName, fieldDef.semantic.embedding)
        }
    }

    return fields
}

/**
 * Check if entity has any embedding fields
 */
export function hasEmbeddingFields(entity: Entity): boolean {
    return Object.values(entity.config.fields).some(f => f.semantic?.embedding)
}

// -----------------------------------------------------------------------------
// RAG Engine Factory
// -----------------------------------------------------------------------------

/**
 * Create a RAG engine
 * 
 * @example
 * ```typescript
 * const rag = createRAGEngine({
 *   embedding: { provider: "openai" },
 *   vectorStore: { type: "memory" },
 *   autoGenerate: true,
 * })
 * 
 * // Generate embeddings for a record
 * await rag.generateEmbeddings(postEntity, "123", { title: "...", content: "..." })
 * 
 * // Semantic search
 * const results = await rag.search("customer support issues", { entities: ["ticket"] })
 * ```
 */
export function createRAGEngine(config: RAGConfig): RAGEngine {
    const provider = getEmbeddingProvider(config.embedding)
    const store = getVectorStore(config.vectorStore || { type: "memory" })
    const maxTextLength = config.maxTextLength || 8000 // OpenAI limit

    return {
        provider,
        store,
        config,

        async generateEmbeddings(
            entity: Entity,
            recordId: string,
            data: Record<string, unknown>
        ): Promise<void> {
            const embeddingFields = getEmbeddingFields(entity)
            if (embeddingFields.size === 0) return

            const textsToEmbed: Array<{ field: string; text: string }> = []

            for (const [fieldName, _config] of embeddingFields) {
                const value = data[fieldName]
                if (typeof value !== "string" || !value.trim()) continue

                // Truncate if too long
                const text = value.length > maxTextLength
                    ? value.slice(0, maxTextLength)
                    : value

                textsToEmbed.push({ field: fieldName, text })
            }

            if (textsToEmbed.length === 0) return

            // Batch generate embeddings
            const embeddings = await provider.generateEmbeddings(
                textsToEmbed.map(t => t.text)
            )

            // Store embeddings
            const items = textsToEmbed.map((t, i) => ({
                id: `${entity.name}:${recordId}:${t.field}`,
                vector: embeddings[i],
                metadata: {
                    entity: entity.name,
                    field: t.field,
                    recordId,
                    text: t.text.slice(0, 500), // Store truncated text for reference
                } as VectorMetadata,
            }))

            await store.upsertBatch(items)
        },

        async deleteEmbeddings(entityName: string, recordId: string): Promise<void> {
            await store.deleteByFilter({ entity: entityName, recordId })
        },

        async search(query: string, options: SemanticSearchOptions = {}): Promise<SemanticSearchResult[]> {
            // Generate query embedding
            const queryVector = await provider.generateEmbedding(query)

            // Search vector store
            const results = await store.search(queryVector, options)

            // TODO: If includeRecords is true, fetch records from DB
            // This would require access to the driver

            return results
        },
    }
}

// -----------------------------------------------------------------------------
// Global RAG Engine (Optional)
// -----------------------------------------------------------------------------

let globalRAGEngine: RAGEngine | null = null

/**
 * Set the global RAG engine
 */
export function setRAGEngine(engine: RAGEngine): void {
    globalRAGEngine = engine
}

/**
 * Get the global RAG engine
 */
export function getRAGEngine(): RAGEngine | null {
    return globalRAGEngine
}

/**
 * Clear the global RAG engine
 */
export function clearRAGEngine(): void {
    globalRAGEngine = null
}
