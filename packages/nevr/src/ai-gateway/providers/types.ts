// =============================================================================
// PROVIDER TYPES
// Base types and abstract class for AI providers
// =============================================================================

import type {
    AIProviderType,
    AIProviderConfig,
    ChatParams,
    ChatResponse,
    ChatChunk,
    ModelInfo,
    ModelPricing,
} from "../types.js"

// -----------------------------------------------------------------------------
// Provider Interface
// -----------------------------------------------------------------------------

export interface AIProviderInterface {
    /** Provider name */
    readonly name: AIProviderType

    /** Available models */
    readonly models: string[]

    /** Default model */
    readonly defaultModel: string

    /** Chat completion */
    chat(params: ChatParams): Promise<ChatResponse>

    /** Streaming chat completion */
    chatStream(params: ChatParams): AsyncGenerator<ChatChunk, void, unknown>

    /** Count tokens for text */
    countTokens(text: string, model?: string): number

    /** Get model info */
    getModelInfo(model: string): ModelInfo | null
}

// -----------------------------------------------------------------------------
// Base Provider Class
// -----------------------------------------------------------------------------

export abstract class BaseAIProvider implements AIProviderInterface {
    abstract readonly name: AIProviderType
    abstract readonly models: string[]
    abstract readonly defaultModel: string

    protected config: AIProviderConfig
    protected modelInfoMap: Map<string, ModelInfo> = new Map()

    constructor(config: AIProviderConfig) {
        this.config = config
    }

    abstract chat(params: ChatParams): Promise<ChatResponse>
    abstract chatStream(params: ChatParams): AsyncGenerator<ChatChunk, void, unknown>

    /**
     * Count tokens for text (approximate)
     * Override in provider for more accurate counting
     */
    countTokens(text: string, _model?: string): number {
        // Rough approximation: ~4 characters per token
        return Math.ceil(text.length / 4)
    }

    /**
     * Get model info
     */
    getModelInfo(model: string): ModelInfo | null {
        return this.modelInfoMap.get(model) || null
    }

    /**
     * Register model info
     */
    protected registerModel(info: ModelInfo): void {
        this.modelInfoMap.set(info.id, info)
    }

    /**
     * Get resolved model (use default if not specified)
     */
    protected getResolvedModel(params: ChatParams): string {
        return params.model || this.config.defaultModel || this.defaultModel
    }

    /**
     * Get API key
     */
    protected getApiKey(): string {
        if (!this.config.apiKey) {
            throw new Error(`API key not configured for ${this.name}`)
        }
        return this.config.apiKey
    }

    /**
     * Get base URL
     */
    protected getBaseUrl(): string | undefined {
        return this.config.baseUrl
    }

    /**
     * Get timeout
     */
    protected getTimeout(): number {
        return this.config.timeout || 60000
    }

    /**
     * Generate unique request ID
     */
    protected generateRequestId(): string {
        return `${this.name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    }
}

// -----------------------------------------------------------------------------
// Model Registry
// -----------------------------------------------------------------------------

export interface ModelRegistry {
    [provider: string]: {
        [model: string]: ModelInfo
    }
}

// Default model info registry (Updated January 2026)
export const DEFAULT_MODELS: ModelRegistry = {
    openai: {
        // GPT-5 Series (Latest)
        "gpt-5": {
            id: "gpt-5",
            name: "GPT-5",
            provider: "openai",
            contextWindow: 400000,
            maxOutput: 32768,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.00125, output: 0.01 },
        },
        "gpt-5-mini": {
            id: "gpt-5-mini",
            name: "GPT-5 Mini",
            provider: "openai",
            contextWindow: 400000,
            maxOutput: 16384,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.0003, output: 0.0012 },
        },
        // o-Series Reasoning Models
        "o3": {
            id: "o3",
            name: "o3",
            provider: "openai",
            contextWindow: 200000,
            maxOutput: 100000,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.002, output: 0.008 },
        },
        "o3-mini": {
            id: "o3-mini",
            name: "o3 Mini",
            provider: "openai",
            contextWindow: 200000,
            maxOutput: 65536,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.00055, output: 0.0022 },
        },
        "o4-mini": {
            id: "o4-mini",
            name: "o4 Mini",
            provider: "openai",
            contextWindow: 200000,
            maxOutput: 100000,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.0011, output: 0.0044 },
        },
        // GPT-4o (Still widely used)
        "gpt-4o": {
            id: "gpt-4o",
            name: "GPT-4o",
            provider: "openai",
            contextWindow: 128000,
            maxOutput: 16384,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.0025, output: 0.01 },
        },
        "gpt-4o-mini": {
            id: "gpt-4o-mini",
            name: "GPT-4o Mini",
            provider: "openai",
            contextWindow: 128000,
            maxOutput: 16384,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.00015, output: 0.0006 },
        },
    },
    anthropic: {
        // Claude 4.5 Series (Latest - November 2025)
        "claude-opus-4-5-20251124": {
            id: "claude-opus-4-5-20251124",
            name: "Claude Opus 4.5",
            provider: "anthropic",
            contextWindow: 200000,
            maxOutput: 32768,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.005, output: 0.025 },
        },
        "claude-sonnet-4-5-20250929": {
            id: "claude-sonnet-4-5-20250929",
            name: "Claude Sonnet 4.5",
            provider: "anthropic",
            contextWindow: 200000,
            maxOutput: 16384,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.003, output: 0.015 },
        },
        "claude-haiku-4-5-20250929": {
            id: "claude-haiku-4-5-20250929",
            name: "Claude Haiku 4.5",
            provider: "anthropic",
            contextWindow: 200000,
            maxOutput: 8192,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.001, output: 0.005 },
        },
        // Claude 4 Series
        "claude-opus-4-20250522": {
            id: "claude-opus-4-20250522",
            name: "Claude Opus 4",
            provider: "anthropic",
            contextWindow: 200000,
            maxOutput: 16384,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.015, output: 0.075 },
        },
        "claude-sonnet-4-20250522": {
            id: "claude-sonnet-4-20250522",
            name: "Claude Sonnet 4",
            provider: "anthropic",
            contextWindow: 200000,
            maxOutput: 16384,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.003, output: 0.015 },
        },
        // Legacy Claude 3.5 (still supported)
        "claude-3-5-sonnet-20241022": {
            id: "claude-3-5-sonnet-20241022",
            name: "Claude 3.5 Sonnet",
            provider: "anthropic",
            contextWindow: 200000,
            maxOutput: 8192,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.003, output: 0.015 },
        },
    },
    google: {
        // Gemini 3 Series (Latest - January 2026)
        "gemini-3-pro": {
            id: "gemini-3-pro",
            name: "Gemini 3 Pro",
            provider: "google",
            contextWindow: 1000000,
            maxOutput: 65536,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.002, output: 0.012 },
        },
        "gemini-3-flash": {
            id: "gemini-3-flash",
            name: "Gemini 3 Flash",
            provider: "google",
            contextWindow: 1000000,
            maxOutput: 32768,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.0005, output: 0.003 },
        },
        // Gemini 2.5 Series (Production ready)
        "gemini-2.5-pro": {
            id: "gemini-2.5-pro",
            name: "Gemini 2.5 Pro",
            provider: "google",
            contextWindow: 2097152,
            maxOutput: 65536,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.00125, output: 0.01 },
        },
        "gemini-2.5-flash": {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            provider: "google",
            contextWindow: 1048576,
            maxOutput: 32768,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.00015, output: 0.0006 },
        },
        // Gemini 2.0 (Still available)
        "gemini-2.0-flash": {
            id: "gemini-2.0-flash",
            name: "Gemini 2.0 Flash",
            provider: "google",
            contextWindow: 1000000,
            maxOutput: 8192,
            vision: true,
            functionCalling: true,
            streaming: true,
            pricing: { input: 0.0001, output: 0.0004 },
        },
    },
}

// -----------------------------------------------------------------------------
// Default Pricing
// -----------------------------------------------------------------------------

// Default pricing (Updated January 2026) - per 1K tokens in USD
export const DEFAULT_PRICING: Record<AIProviderType, Record<string, ModelPricing>> = {
    openai: {
        // GPT-5 Series
        "gpt-5": { input: 0.00125, output: 0.01 },
        "gpt-5-mini": { input: 0.0003, output: 0.0012 },
        // o-Series Reasoning
        "o3": { input: 0.002, output: 0.008 },
        "o3-mini": { input: 0.00055, output: 0.0022 },
        "o4-mini": { input: 0.0011, output: 0.0044 },
        // GPT-4o
        "gpt-4o": { input: 0.0025, output: 0.01 },
        "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
    },
    anthropic: {
        // Claude 4.5 Series
        "claude-opus-4-5-20251124": { input: 0.005, output: 0.025 },
        "claude-sonnet-4-5-20250929": { input: 0.003, output: 0.015 },
        "claude-haiku-4-5-20250929": { input: 0.001, output: 0.005 },
        // Claude 4 Series
        "claude-opus-4-20250522": { input: 0.015, output: 0.075 },
        "claude-sonnet-4-20250522": { input: 0.003, output: 0.015 },
        // Legacy Claude 3.5
        "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
    },
    google: {
        // Gemini 3 Series
        "gemini-3-pro": { input: 0.002, output: 0.012 },
        "gemini-3-flash": { input: 0.0005, output: 0.003 },
        // Gemini 2.5 Series
        "gemini-2.5-pro": { input: 0.00125, output: 0.01 },
        "gemini-2.5-flash": { input: 0.00015, output: 0.0006 },
        // Gemini 2.0
        "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
    },
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Calculate cost for usage
 */
export function calculateCost(
    provider: AIProviderType,
    model: string,
    inputTokens: number,
    outputTokens: number,
    customPricing?: Record<AIProviderType, Record<string, ModelPricing>>
): number {
    const pricing = customPricing?.[provider]?.[model] || DEFAULT_PRICING[provider]?.[model]

    if (!pricing) {
        // Fallback to rough estimate
        return (inputTokens + outputTokens) * 0.00001
    }

    // Pricing is per 1K tokens
    const inputCost = (inputTokens / 1000) * pricing.input
    const outputCost = (outputTokens / 1000) * pricing.output

    return Math.round((inputCost + outputCost) * 1000000) / 1000000 // 6 decimal places
}

/**
 * Get all models for a provider
 */
export function getModelsForProvider(provider: AIProviderType): ModelInfo[] {
    const providerModels = DEFAULT_MODELS[provider]
    return providerModels ? Object.values(providerModels) : []
}

/**
 * Get model info from registry
 */
export function getModelInfoFromRegistry(provider: AIProviderType, model: string): ModelInfo | null {
    return DEFAULT_MODELS[provider]?.[model] || null
}
