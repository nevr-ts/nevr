// =============================================================================
// OPENAI EMBEDDING PROVIDER
// Uses OpenAI's text-embedding-3-small/large models
// =============================================================================

import { BaseEmbeddingProvider, EmbeddingError, type EmbeddingProviderConfig } from "./types.js"

/**
 * OpenAI embedding models and their dimensions
 */
const OPENAI_MODELS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536, // Legacy
} as const

type OpenAIModel = keyof typeof OPENAI_MODELS

/**
 * OpenAI Embedding Provider
 * 
 * @example
 * ```typescript
 * const provider = new OpenAIEmbeddingProvider({
 *   provider: "openai",
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: "text-embedding-3-small", // default
 * })
 * 
 * const embedding = await provider.generateEmbedding("Hello world")
 * ```
 */
export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
    readonly name = "openai"
    readonly dimensions: number

    constructor(config: EmbeddingProviderConfig) {
        super(config)

        // Get API key from config or environment
        this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || ""
        if (!this.apiKey) {
            throw new EmbeddingError(
                "API key required. Set OPENAI_API_KEY environment variable or pass apiKey in config.",
                "openai"
            )
        }

        // Set model and dimensions
        this.model = config.model || "text-embedding-3-small"
        this.dimensions = config.dimensions || OPENAI_MODELS[this.model as OpenAIModel] || 1536
        this.baseUrl = config.baseUrl || "https://api.openai.com/v1"
    }

    /**
     * Generate embedding for a single text
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const embeddings = await this.generateEmbeddings([text])
        return embeddings[0]
    }

    /**
     * Generate embeddings for multiple texts (uses OpenAI batch API)
     */
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return []

        try {
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: this.model,
                    input: texts,
                    encoding_format: "float",
                }),
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
                throw new EmbeddingError(
                    error.error?.message || `HTTP ${response.status}`,
                    "openai"
                )
            }

            const data = await response.json() as {
                data: Array<{ embedding: number[]; index: number }>
            }

            // Sort by index to preserve order
            return data.data
                .sort((a, b) => a.index - b.index)
                .map(item => item.embedding)
        } catch (error) {
            if (error instanceof EmbeddingError) throw error
            throw new EmbeddingError(
                error instanceof Error ? error.message : "Unknown error",
                "openai",
                error instanceof Error ? error : undefined
            )
        }
    }
}
