// =============================================================================
// RAG PROVIDER TYPES
// Abstraction layer for embedding providers (OpenAI, Cohere, Huggingface, etc.)
// =============================================================================

/**
 * Configuration for embedding providers
 */
export interface EmbeddingProviderConfig {
    /** Provider name: openai, cohere, huggingface, or custom */
    provider: "openai" | "cohere" | "huggingface" | string
    /** API key (defaults to environment variable) */
    apiKey?: string
    /** Model name (provider-specific) */
    model?: string
    /** Embedding dimensions (auto-detected if not specified) */
    dimensions?: number
    /** Base URL for custom providers */
    baseUrl?: string
}

/**
 * Embedding provider interface
 * Implement this to add support for new embedding APIs
 */
export interface EmbeddingProvider {
    /** Provider name */
    readonly name: string
    /** Embedding dimensions */
    readonly dimensions: number

    /**
     * Generate embedding for a single text
     */
    generateEmbedding(text: string): Promise<number[]>

    /**
     * Generate embeddings for multiple texts (batch API if available)
     */
    generateEmbeddings(texts: string[]): Promise<number[][]>
}

/**
 * Base class for embedding providers with common functionality
 */
export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
    abstract readonly name: string
    abstract readonly dimensions: number

    protected apiKey: string
    protected model: string
    protected baseUrl: string

    constructor(config: EmbeddingProviderConfig) {
        this.apiKey = config.apiKey || ""
        this.model = config.model || ""
        this.baseUrl = config.baseUrl || ""
    }

    abstract generateEmbedding(text: string): Promise<number[]>

    /**
     * Default batch implementation - override for providers with native batch API
     */
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map(text => this.generateEmbedding(text)))
    }
}

/**
 * Error thrown when embedding generation fails
 */
export class EmbeddingError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly cause?: Error
    ) {
        super(`[${provider}] ${message}`)
        this.name = "EmbeddingError"
    }
}
