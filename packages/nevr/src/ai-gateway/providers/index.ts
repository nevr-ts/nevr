// =============================================================================
// PROVIDER INDEX
// Provider registry and factory
// =============================================================================

import type { AIProviderType, AIProviderConfig, OpenAIConfig, AnthropicConfig, GoogleConfig } from "../types.js"
import type { AIProviderInterface } from "./types.js"
import { OpenAIProvider } from "./openai.js"
import { AnthropicProvider } from "./anthropic.js"
import { GoogleProvider } from "./google.js"

// Re-export types
export * from "./types.js"
export { OpenAIProvider } from "./openai.js"
export { AnthropicProvider } from "./anthropic.js"
export { GoogleProvider } from "./google.js"

// -----------------------------------------------------------------------------
// Provider Registry
// -----------------------------------------------------------------------------

type ProviderConstructor = new (config: AIProviderConfig) => AIProviderInterface

const providerRegistry = new Map<AIProviderType, ProviderConstructor>([
    ["openai", OpenAIProvider as ProviderConstructor],
    ["anthropic", AnthropicProvider as ProviderConstructor],
    ["google", GoogleProvider as ProviderConstructor],
])

/**
 * Register a custom provider
 */
export function registerProvider(name: AIProviderType, constructor: ProviderConstructor): void {
    providerRegistry.set(name, constructor)
}

/**
 * Get a provider constructor
 */
export function getProviderConstructor(name: AIProviderType): ProviderConstructor | undefined {
    return providerRegistry.get(name)
}

/**
 * Get all registered provider names
 */
export function getRegisteredProviders(): AIProviderType[] {
    return Array.from(providerRegistry.keys())
}

// -----------------------------------------------------------------------------
// Provider Factory
// -----------------------------------------------------------------------------

export interface ProviderConfigs {
    openai?: OpenAIConfig
    anthropic?: AnthropicConfig
    google?: GoogleConfig
}

/**
 * Create a provider instance
 */
export function createProvider(type: AIProviderType, config: AIProviderConfig): AIProviderInterface {
    const Constructor = providerRegistry.get(type)
    if (!Constructor) {
        throw new Error(`Unknown provider: ${type}`)
    }
    return new Constructor(config)
}

/**
 * Create providers from configuration
 */
export function createProviders(configs: ProviderConfigs): Map<AIProviderType, AIProviderInterface> {
    const providers = new Map<AIProviderType, AIProviderInterface>()

    if (configs.openai) {
        providers.set("openai", createProvider("openai", configs.openai))
    }

    if (configs.anthropic) {
        providers.set("anthropic", createProvider("anthropic", configs.anthropic))
    }

    if (configs.google) {
        providers.set("google", createProvider("google", configs.google))
    }

    return providers
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get environment variable for provider API key
 */
export function getProviderApiKeyEnv(provider: AIProviderType): string | undefined {
    switch (provider) {
        case "openai":
            return process.env.OPENAI_API_KEY
        case "anthropic":
            return process.env.ANTHROPIC_API_KEY
        case "google":
            return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
        default:
            return undefined
    }
}

/**
 * Auto-configure providers from environment variables
 */
export function autoConfigureProviders(): ProviderConfigs {
    const configs: ProviderConfigs = {}

    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey) {
        configs.openai = { apiKey: openaiKey }
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
        configs.anthropic = { apiKey: anthropicKey }
    }

    const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    if (googleKey) {
        configs.google = { apiKey: googleKey }
    }

    return configs
}
