// =============================================================================
// AI GATEWAY PLUGIN
// Unified AI provider abstraction with usage tracking and limits
// =============================================================================

import { createPlugin } from "../plugins/unified/facade.js"
import { getLogger } from "../logger.js"
import type { AIProviderType, AIGatewayPluginOptions } from "./types.js"
import type { AIProviderInterface } from "./providers/types.js"
import { createProviders, autoConfigureProviders } from "./providers/index.js"
import { getAIGatewaySchema } from "./schema.js"
import type { AIGatewayRouteConfig } from "./api/types.js"
import {
    chat,
    getUsage,
    getUsageRecords,
    getRateLimitStatus,
    listModels,
    getModelInfo,
    countTokens,
} from "./api/routes/index.js"

// -----------------------------------------------------------------------------
// Provider Cache with Cleanup
// -----------------------------------------------------------------------------

interface CacheEntry {
    providers: Map<AIProviderType, AIProviderInterface>
    lastAccessed: number
    refCount: number
}

const providerCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
let cleanupInterval: NodeJS.Timeout | null = null

function getCacheKey(options: AIGatewayPluginOptions): string {
    const providers = options.providers || {}
    return JSON.stringify({
        openai: !!providers.openai?.apiKey,
        anthropic: !!providers.anthropic?.apiKey,
        google: !!providers.google?.apiKey,
    })
}

function startCacheCleanup(): void {
    if (cleanupInterval) return

    cleanupInterval = setInterval(() => {
        const now = Date.now()
        for (const [key, entry] of providerCache) {
            // Remove entries that haven't been accessed in TTL and have no references
            if (entry.refCount <= 0 && now - entry.lastAccessed > CACHE_TTL_MS) {
                providerCache.delete(key)
            }
        }

        // Stop cleanup if cache is empty
        if (providerCache.size === 0 && cleanupInterval) {
            clearInterval(cleanupInterval)
            cleanupInterval = null
        }
    }, CACHE_TTL_MS)

    // Don't prevent Node from exiting
    if (cleanupInterval.unref) {
        cleanupInterval.unref()
    }
}

async function getOrCreateProviders(
    options: AIGatewayPluginOptions
): Promise<Map<AIProviderType, AIProviderInterface>> {
    const cacheKey = getCacheKey(options)

    const existing = providerCache.get(cacheKey)
    if (existing) {
        existing.lastAccessed = Date.now()
        existing.refCount++
        return existing.providers
    }

    // Merge with auto-configured providers from environment
    const autoConfig = autoConfigureProviders()
    const mergedProviders = {
        openai: { ...autoConfig.openai, ...options.providers?.openai },
        anthropic: { ...autoConfig.anthropic, ...options.providers?.anthropic },
        google: { ...autoConfig.google, ...options.providers?.google },
    }

    // Filter out providers without API keys
    const providersToCreate: typeof mergedProviders = {} as typeof mergedProviders
    if (mergedProviders.openai?.apiKey) providersToCreate.openai = mergedProviders.openai
    if (mergedProviders.anthropic?.apiKey) providersToCreate.anthropic = mergedProviders.anthropic
    if (mergedProviders.google?.apiKey) providersToCreate.google = mergedProviders.google

    const providers = createProviders(providersToCreate)

    providerCache.set(cacheKey, {
        providers,
        lastAccessed: Date.now(),
        refCount: 1,
    })

    // Start cleanup timer
    startCacheCleanup()

    return providers
}

function releaseProviders(options: AIGatewayPluginOptions): void {
    const cacheKey = getCacheKey(options)
    const entry = providerCache.get(cacheKey)
    if (entry) {
        entry.refCount = Math.max(0, entry.refCount - 1)
    }
}

/**
 * Clear all cached providers (useful for testing)
 */
export function clearProviderCache(): void {
    providerCache.clear()
    if (cleanupInterval) {
        clearInterval(cleanupInterval)
        cleanupInterval = null
    }
}

// -----------------------------------------------------------------------------
// AI Gateway Plugin Factory
// -----------------------------------------------------------------------------

/**
 * AI Gateway Plugin for unified AI provider access
 *
 * @example
 * ```typescript
 * import { aiGateway } from "nevr/plugins"
 *
 * const api = nevr({
 *   entities: [...],
 *   plugins: [
 *     aiGateway({
 *       providers: {
 *         openai: { apiKey: process.env.OPENAI_API_KEY },
 *         anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
 *       },
 *       defaultProvider: "openai",
 *       trackUsage: true,
 *       limits: {
 *         free: { tokens: 10_000, requestsPerMinute: 10 },
 *         pro: { tokens: 1_000_000, requestsPerMinute: 60 },
 *       },
 *       getPlan: async (userId, driver) => {
 *         const sub = await driver.subscription.findFirst({ ... })
 *         return sub?.plan || "free"
 *       },
 *     }),
 *   ],
 * })
 *
 * // Chat completion
 * const response = await api.ai.chat({
 *   messages: [{ role: "user", content: "Hello" }],
 * })
 *
 * // Get usage
 * const usage = await api.ai.getUsage()
 * ```
 */
export const aiGateway = createPlugin<AIGatewayPluginOptions>({
    id: "ai-gateway",
    name: "AI Gateway",
    version: "1.0.0",
    basePath: "/ai",

    defaults: {
        providers: {},
        defaultProvider: "openai",
        trackUsage: true,
        referenceMode: "user",
        debug: false,
        timeout: 60000,
        retry: {
            attempts: 3,
            delay: 1000,
            multiplier: 2,
        },
    },

    validate: (options) => {
        const errors: string[] = []

        // Check at least one provider is configured or available from env
        const hasOpenAI = options.providers?.openai?.apiKey || process.env.OPENAI_API_KEY
        const hasAnthropic = options.providers?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY
        const hasGoogle = options.providers?.google?.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY

        if (!hasOpenAI && !hasAnthropic && !hasGoogle) {
            errors.push(
                "At least one AI provider must be configured. " +
                "Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY environment variable, " +
                "or pass provider config in options."
            )
        }

        // Validate limits if provided
        if (options.limits) {
            for (const [planName, limits] of Object.entries(options.limits)) {
                if (limits.requestsPerMinute !== undefined && limits.requestsPerMinute < 0) {
                    errors.push(`Invalid requestsPerMinute for plan "${planName}"`)
                }
                if (limits.tokens !== undefined && limits.tokens < -1) {
                    errors.push(`Invalid tokens limit for plan "${planName}" (use -1 for unlimited)`)
                }
            }
        }

        return errors
    },

    factory: (options) => {
        const logger = getLogger()
        let providers: Map<AIProviderType, AIProviderInterface> = new Map()

        const log = (message: string, ...args: unknown[]) => {
            if (options.debug) {
                logger.debug(`[ai-gateway] ${message}`, ...args)
            }
        }

        const getProvider = (type: AIProviderType): AIProviderInterface | null => {
            return providers.get(type) || null
        }

        const getProviders = (): Map<AIProviderType, AIProviderInterface> => {
            return providers
        }

        const routeConfig: AIGatewayRouteConfig = {
            options,
            getProvider,
            getProviders,
        }

        return {
            // Schema for usage tracking entities
            schema: options.trackUsage ? getAIGatewaySchema() : undefined,

            // API Endpoints
            endpoints: {
                // Chat completion
                chat: chat(routeConfig),

                // Usage tracking
                getUsage: getUsage(routeConfig),
                getUsageRecords: getUsageRecords(routeConfig),
                getRateLimitStatus: getRateLimitStatus(routeConfig),

                // Model info
                listModels: listModels(routeConfig),
                getModelInfo: getModelInfo(routeConfig),
                countTokens: countTokens(routeConfig),
            } as any,

            // Lifecycle hooks
            lifecycle: {
                onInit: async () => {
                    log("Initializing AI Gateway...")

                    try {
                        providers = await getOrCreateProviders(options)
                        log(`Initialized ${providers.size} provider(s): ${Array.from(providers.keys()).join(", ")}`)
                    } catch (error) {
                        logger.error("[ai-gateway] Failed to initialize providers:", error)
                        throw error
                    }
                },
                onDestroy: async () => {
                    log("Destroying AI Gateway, releasing providers...")
                    releaseProviders(options)
                },
            },

            // Expose AI methods via getActions (like RAG plugin)
            getActions: () => ({
                ai: {
                    /**
                     * Get a provider instance
                     */
                    getProvider,

                    /**
                     * Get all configured providers
                     */
                    getProviders,

                    /**
                     * Count tokens for text
                     */
                    countTokens: (text: string, model?: string) => {
                        const defaultProvider = options.defaultProvider || "openai"
                        const provider = getProvider(defaultProvider)
                        return provider?.countTokens(text, model) || Math.ceil(text.length / 4)
                    },

                    /**
                     * Get model info
                     */
                    getModelInfo: (provider: AIProviderType, model: string) => {
                        const p = getProvider(provider)
                        return p?.getModelInfo(model) || null
                    },

                    /**
                     * Get all available models
                     */
                    getModels: () => {
                        const models: Record<AIProviderType, string[]> = {
                            openai: [],
                            anthropic: [],
                            google: [],
                        }

                        for (const [type, provider] of providers) {
                            models[type] = provider.models
                        }

                        return models
                    },
                },
            }),

            // Type inference for SDK
            $Infer: {
                UsageRecord: {} as import("./types.js").UsageRecord,
                ChatResponse: {} as import("./types.js").ChatResponse,
                ModelInfo: {} as import("./types.js").ModelInfo,
            },
            $ERROR_CODES: {} as typeof import("./error-codes.js").AI_GATEWAY_ERROR_CODES,
        }
    },
})

export default aiGateway
