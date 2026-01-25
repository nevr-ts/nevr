// =============================================================================
// RAG CLIENT PLUGIN
// Client-side RAG API with semantic search
// =============================================================================

import { atom, type WritableAtom } from "nanostores"
import type {
    NevrClientPlugin,
    NevrFetch,
    NevrFetchResponse,
    ClientStore,
} from "../client/types.js"
import type { HybridSearchResult, HybridSearchOptions } from "./plugin.js"
import { RAG_ERROR_CODES } from "./error-codes.js"

// =============================================================================
// TYPES
// =============================================================================

export interface RAGClientOptions {
    /** Base path for RAG endpoints (default: /rag) */
    basePath?: string
}

export interface SearchParams {
    /** Search query */
    query: string
    /** Entity names to search */
    entities?: string[]
    /** Maximum results */
    limit?: number
    /** Minimum similarity score (0-1) */
    minScore?: number
    /** Search mode */
    mode?: "vector" | "text" | "hybrid"
    /** Vector search weight (0-1) */
    vectorWeight?: number
    /** Text search weight (0-1) */
    textWeight?: number
}

export interface SearchResult {
    id: string
    score: number
    metadata: {
        entity: string
        field: string
        recordId: string
        text?: string
    }
    vectorScore?: number
    textScore?: number
    hybridScore?: number
    source: "vector" | "text" | "both"
}

export interface IndexParams {
    /** Entity name to index */
    entity: string
    /** Records to index */
    records: Array<{ id: string } & Record<string, unknown>>
}

export interface IndexResult {
    indexed: number
    errors: number
}

export interface RAGStats {
    totalVectors: number
    byEntity: Record<string, { count: number; lastIndexed: string | null }>
    provider: string
    storeType: string
}

// =============================================================================
// STATE TYPES
// =============================================================================

export interface SearchState {
    query: string | null
    results: SearchResult[]
    isLoading: boolean
    error: Error | null
}

// =============================================================================
// CLIENT METHODS
// =============================================================================

export interface RAGClientMethods {
    /**
     * Semantic/hybrid search
     * 
     * @example
     * ```ts
     * const results = await client.rag.search({
     *   query: "how to reset password",
     *   entities: ["article", "faq"],
     *   limit: 10,
     * })
     * ```
     */
    search(params: SearchParams): Promise<NevrFetchResponse<{ results: SearchResult[] }>>

    /**
     * Bulk index entity records
     * 
     * @example
     * ```ts
     * const articles = await client.article.list()
     * await client.rag.index({ entity: "article", records: articles })
     * ```
     */
    index(params: IndexParams): Promise<NevrFetchResponse<IndexResult>>

    /**
     * Get RAG stats
     */
    stats(): Promise<NevrFetchResponse<RAGStats>>

    /**
     * Clear embeddings for an entity
     */
    clear(entity: string): Promise<NevrFetchResponse<{ success: boolean }>>
}

// =============================================================================
// CLIENT PLUGIN TYPE
// =============================================================================

export type RAGClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        endpoints: RAGClientMethods
        $ERROR_CODES: typeof RAG_ERROR_CODES
        SearchResult: SearchResult
    }
}

// =============================================================================
// CLIENT PLUGIN FACTORY
// =============================================================================

/**
 * Create RAG client plugin
 *
 * @example
 * ```ts
 * import { createTypedClient } from "nevr/client"
 * import { ragClient } from "nevr/rag"
 *
 * const client = createTypedClient<API>({
 *   plugins: [ragClient()]
 * })
 *
 * // Search in 1 line!
 * const { data } = await client.rag.search({
 *   query: "how to reset password",
 *   entities: ["article"],
 * })
 * ```
 */
export function ragClient(options?: RAGClientOptions): RAGClientPlugin {
    const basePath = options?.basePath || "/rag"

    // Reactive atoms
    let $search: WritableAtom<SearchState>

    return {
        id: "rag-client",

        pathMethods: {
            [`${basePath}/search`]: "POST",
            [`${basePath}/index`]: "POST",
            [`${basePath}/stats`]: "GET",
            [`${basePath}/clear`]: "DELETE",
        },

        getAtoms($fetch: NevrFetch) {
            $search = atom<SearchState>({
                query: null,
                results: [],
                isLoading: false,
                error: null,
            })

            return {
                search: $search,
            }
        },

        getActions($fetch: NevrFetch, $store: ClientStore) {
            return {
                rag: {
                    search: async (params: SearchParams) => {
                        // Update search state
                        if ($search) {
                            $search.set({
                                query: params.query,
                                results: [],
                                isLoading: true,
                                error: null,
                            })
                        }

                        try {
                            const result = await $fetch(`${basePath}/search`, {
                                method: "POST",
                                body: params,
                            })

                            if ($search) {
                                if (result.error) {
                                    $search.set({
                                        query: params.query,
                                        results: [],
                                        isLoading: false,
                                        error: result.error as unknown as Error,
                                    })
                                } else {
                                    const data = result.data as { results: SearchResult[] }
                                    $search.set({
                                        query: params.query,
                                        results: data?.results || [],
                                        isLoading: false,
                                        error: null,
                                    })
                                }
                            }

                            return result as NevrFetchResponse<{ results: SearchResult[] }>
                        } catch (error) {
                            if ($search) {
                                $search.set({
                                    query: params.query,
                                    results: [],
                                    isLoading: false,
                                    error: error as Error,
                                })
                            }
                            throw error
                        }
                    },

                    index: async (params: IndexParams) => {
                        return $fetch(`${basePath}/index`, {
                            method: "POST",
                            body: params,
                        }) as Promise<NevrFetchResponse<IndexResult>>
                    },

                    stats: async () => {
                        return $fetch(`${basePath}/stats`, {
                            method: "GET",
                        }) as Promise<NevrFetchResponse<RAGStats>>
                    },

                    clear: async (entity: string) => {
                        return $fetch(`${basePath}/clear`, {
                            method: "DELETE",
                            body: { entity },
                        }) as Promise<NevrFetchResponse<{ success: boolean }>>
                    },
                },
            }
        },

        // Type inference for SDK
        $InferTypes: {
            endpoints: {} as RAGClientMethods,
            $ERROR_CODES: RAG_ERROR_CODES,
            SearchResult: {} as SearchResult,
        },
    } as unknown as RAGClientPlugin
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ragClient
