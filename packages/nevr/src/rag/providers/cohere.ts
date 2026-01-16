// =============================================================================
// COHERE EMBEDDING PROVIDER
// Uses Cohere's embed-english-v3.0 and multilingual models
// =============================================================================

import { BaseEmbeddingProvider, EmbeddingError, type EmbeddingProviderConfig } from "./types.js"

/**
 * Cohere embedding models and their dimensions
 */
const COHERE_MODELS = {
    "embed-english-v3.0": 1024,
    "embed-multilingual-v3.0": 1024,
    "embed-english-light-v3.0": 384,
    "embed-multilingual-light-v3.0": 384,
    "embed-english-v2.0": 4096, // Legacy
} as const

type CohereModel = keyof typeof COHERE_MODELS

/**
 * Cohere Embedding Provider
 * 
 * @example
 * ```typescript
 * const provider = new CohereEmbeddingProvider({
 *   provider: "cohere",
 *   apiKey: process.env.COHERE_API_KEY,
 *   model: "embed-english-v3.0", // default
 * })
 * 
 * const embedding = await provider.generateEmbedding("Hello world")
 * ```
 */
export class CohereEmbeddingProvider extends BaseEmbeddingProvider {
    readonly name = "cohere"
    readonly dimensions: number

    constructor(config: EmbeddingProviderConfig) {
        super(config)

        // Get API key from config or environment
        this.apiKey = config.apiKey || process.env.COHERE_API_KEY || ""
        if (!this.apiKey) {
            throw new EmbeddingError(
                "API key required. Set COHERE_API_KEY environment variable or pass apiKey in config.",
                "cohere"
            )
        }

        // Set model and dimensions
        this.model = config.model || "embed-english-v3.0"
        this.dimensions = config.dimensions || COHERE_MODELS[this.model as CohereModel] || 1024
        this.baseUrl = config.baseUrl || "https://api.cohere.ai/v1"
    }

    /**
     * Generate embedding for a single text
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const embeddings = await this.generateEmbeddings([text])
        return embeddings[0]
    }

    /**
     * Generate embeddings for multiple texts (uses Cohere batch API)
     */
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return []

        try {
            const response = await fetch(`${this.baseUrl}/embed`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: this.model,
                    texts: texts,
                    input_type: "search_document", // For indexing
                    truncate: "END",
                }),
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: response.statusText }))
                throw new EmbeddingError(
                    error.message || `HTTP ${response.status}`,
                    "cohere"
                )
            }

            const data = await response.json() as {
                embeddings: number[][]
            }

            return data.embeddings
        } catch (error) {
            if (error instanceof EmbeddingError) throw error
            throw new EmbeddingError(
                error instanceof Error ? error.message : "Unknown error",
                "cohere",
                error instanceof Error ? error : undefined
            )
        }
    }

    /**
     * Generate embeddings optimized for search queries (different input_type)
     */
    async generateQueryEmbedding(text: string): Promise<number[]> {
        try {
            const response = await fetch(`${this.baseUrl}/embed`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: this.model,
                    texts: [text],
                    input_type: "search_query", // For queries
                    truncate: "END",
                }),
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: response.statusText }))
                throw new EmbeddingError(error.message || `HTTP ${response.status}`, "cohere")
            }

            const data = await response.json() as { embeddings: number[][] }
            return data.embeddings[0]
        } catch (error) {
            if (error instanceof EmbeddingError) throw error
            throw new EmbeddingError(
                error instanceof Error ? error.message : "Unknown error",
                "cohere",
                error instanceof Error ? error : undefined
            )
        }
    }
}
