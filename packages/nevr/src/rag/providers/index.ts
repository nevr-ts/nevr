// =============================================================================
// EMBEDDING PROVIDERS
// Registry and factory for embedding providers
// =============================================================================

export * from "./types.js"
export { OpenAIEmbeddingProvider } from "./openai.js"
export { CohereEmbeddingProvider } from "./cohere.js"

import type { EmbeddingProvider, EmbeddingProviderConfig } from "./types.js"
import { EmbeddingError } from "./types.js"
import { OpenAIEmbeddingProvider } from "./openai.js"
import { CohereEmbeddingProvider } from "./cohere.js"

/**
 * Custom provider registry for user-defined providers
 */
const customProviders = new Map<string, new (config: EmbeddingProviderConfig) => EmbeddingProvider>()

/**
 * Register a custom embedding provider
 * 
 * @example
 * ```typescript
 * registerProvider("custom", MyCustomProvider)
 * 
 * const provider = getEmbeddingProvider({ provider: "custom", apiKey: "..." })
 * ```
 */
export function registerProvider(
    name: string,
    ProviderClass: new (config: EmbeddingProviderConfig) => EmbeddingProvider
): void {
    customProviders.set(name, ProviderClass)
}

/**
 * Get an embedding provider by configuration
 * 
 * @example
 * ```typescript
 * // OpenAI (default)
 * const openai = getEmbeddingProvider({ provider: "openai" })
 * 
 * // Cohere
 * const cohere = getEmbeddingProvider({ provider: "cohere", model: "embed-english-v3.0" })
 * 
 * // Custom
 * const custom = getEmbeddingProvider({ provider: "my-provider", baseUrl: "..." })
 * ```
 */
export function getEmbeddingProvider(config: EmbeddingProviderConfig): EmbeddingProvider {
    const { provider } = config

    // Check built-in providers
    switch (provider) {
        case "openai":
            return new OpenAIEmbeddingProvider(config)
        case "cohere":
            return new CohereEmbeddingProvider(config)
    }

    // Check custom providers
    const CustomProvider = customProviders.get(provider)
    if (CustomProvider) {
        return new CustomProvider(config)
    }

    throw new EmbeddingError(
        `Unknown provider: "${provider}". Available: openai, cohere${customProviders.size > 0 ? ", " + Array.from(customProviders.keys()).join(", ") : ""}`,
        provider
    )
}

/**
 * Check if a provider is available
 */
export function hasProvider(name: string): boolean {
    return name === "openai" || name === "cohere" || customProviders.has(name)
}

/**
 * List available providers
 */
export function listProviders(): string[] {
    return ["openai", "cohere", ...customProviders.keys()]
}
