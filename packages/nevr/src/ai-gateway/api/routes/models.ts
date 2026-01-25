// =============================================================================
// AI GATEWAY MODELS ROUTE
// List available models and provider info
// =============================================================================

import type { AIGatewayRouteConfig } from "../types.js"
import type { AIProviderType, ModelInfo } from "../../types.js"
import { getModelsForProvider } from "../../providers/types.js"
import { endpoint, EndpointError } from "../../../plugins/unified/endpoint.js"

// -----------------------------------------------------------------------------
// List Models Endpoint
// -----------------------------------------------------------------------------

export function listModels(config: AIGatewayRouteConfig) {
    const { options, getProvider } = config

    return endpoint("/models", {
        method: "GET",
        meta: {
            summary: "List available models",
            description: "Get all available AI models organized by provider",
            tags: ["AI Gateway"],
        },

        handler: async (ctx: any) => {
            const userId = ctx.user?.id
            let allowedModels: string[] | undefined
            let allowedProviders: AIProviderType[] | undefined

            // Get plan-based restrictions
            if (options.limits && options.getPlan && userId) {
                const plan = await options.getPlan(userId, ctx.driver)
                const planLimits = options.limits[plan]

                if (planLimits) {
                    allowedModels = planLimits.allowedModels
                    allowedProviders = planLimits.allowedProviders
                }
            }

            const providers: Record<string, ModelInfo[]> = {}
            const configuredProviders: AIProviderType[] = []

            // Check each provider
            const providerTypes: AIProviderType[] = ["openai", "anthropic", "google"]

            for (const type of providerTypes) {
                const provider = getProvider(type)
                if (!provider) continue

                // Check if provider is allowed
                if (allowedProviders?.length && !allowedProviders.includes(type)) {
                    continue
                }

                configuredProviders.push(type)

                // Get models for this provider
                let models = getModelsForProvider(type)

                // Filter by allowed models if restricted
                if (allowedModels?.length) {
                    models = models.filter((m) => allowedModels.includes(m.id))
                }

                providers[type] = models
            }

            // Get default provider and model
            const defaultProvider = options.defaultProvider || configuredProviders[0] || "openai"
            const defaultProviderInstance = getProvider(defaultProvider)
            const defaultModel = defaultProviderInstance?.defaultModel || "gpt-4o-mini"

            return {
                status: 200,
                body: {
                    providers,
                    configured: configuredProviders,
                    default: {
                        provider: defaultProvider,
                        model: defaultModel,
                    },
                },
            }
        },
    })
}

// -----------------------------------------------------------------------------
// Get Model Info Endpoint
// -----------------------------------------------------------------------------

export function getModelInfo(config: AIGatewayRouteConfig) {
    const { getProvider } = config

    return endpoint("/models/:provider/:model", {
        method: "GET",
        meta: {
            summary: "Get model info",
            description: "Get detailed information about a specific model",
            tags: ["AI Gateway"],
        },

        handler: async (ctx: any) => {
            const { provider: providerType, model: modelId } = ctx.params

            const provider = getProvider(providerType as AIProviderType)
            if (!provider) {
                throw new EndpointError("NOT_FOUND", { message: "Provider not found" })
            }

            const modelInfo = provider.getModelInfo(modelId)
            if (!modelInfo) {
                throw new EndpointError("NOT_FOUND", { message: "Model not found" })
            }

            return { status: 200, body: modelInfo }
        },
    })
}

// -----------------------------------------------------------------------------
// Count Tokens Endpoint
// -----------------------------------------------------------------------------

export function countTokens(config: AIGatewayRouteConfig) {
    const { options, getProvider } = config

    return endpoint("/tokens/count", {
        method: "POST",
        meta: {
            summary: "Count tokens",
            description: "Count the number of tokens in a text string",
            tags: ["AI Gateway"],
        },

        handler: async (ctx: any) => {
            const { text, provider: providerType, model } = ctx.body

            if (!text || typeof text !== "string") {
                throw new EndpointError("BAD_REQUEST", { message: "Text is required" })
            }

            const type = providerType || options.defaultProvider || "openai"
            const provider = getProvider(type)

            if (!provider) {
                throw new EndpointError("NOT_FOUND", { message: "Provider not found" })
            }

            const count = provider.countTokens(text, model)

            return {
                status: 200,
                body: {
                    text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
                    tokens: count,
                    provider: type,
                    model: model || provider.defaultModel,
                },
            }
        },
    })
}
