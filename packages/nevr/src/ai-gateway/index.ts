// =============================================================================
// AI GATEWAY
// Unified AI provider abstraction with usage tracking and limits
// =============================================================================

// Plugin
export { aiGateway } from "./plugin.js"
export { aiGateway as default } from "./plugin.js"

// Types
export type {
    AIProviderType,
    AIProviderConfig,
    OpenAIConfig,
    AnthropicConfig,
    GoogleConfig,
    ChatRole,
    ChatMessage,
    ChatParams,
    ChatResponse,
    ChatChunk,
    TokenUsage,
    UsageRecord,
    UsageSummary,
    UsageQueryOptions,
    PlanLimits,
    RateLimitState,
    RateLimitResult,
    ModelPricing,
    ProviderPricing,
    PricingConfig,
    ModelInfo,
    AIGatewayHooks,
    AIGatewayPluginOptions,
    AIGateway,
    AIProvider,
} from "./types.js"

// Error codes
export {
    AI_GATEWAY_ERROR_CODES,
    AIGatewayError,
    isRateLimitError,
    isProviderError,
    isRetryableError,
} from "./error-codes.js"
export type { AIGatewayErrorCode } from "./error-codes.js"

// Schema
export { aiGatewaySchema, getAIGatewaySchema } from "./schema.js"

// Providers
export {
    OpenAIProvider,
    AnthropicProvider,
    GoogleProvider,
    createProvider,
    createProviders,
    registerProvider,
    getProviderConstructor,
    getRegisteredProviders,
    autoConfigureProviders,
    getProviderApiKeyEnv,
    BaseAIProvider,
    DEFAULT_MODELS,
    DEFAULT_PRICING,
    calculateCost,
    getModelsForProvider,
    getModelInfoFromRegistry,
} from "./providers/index.js"
export type { AIProviderInterface, ModelRegistry } from "./providers/types.js"
export type { ProviderConfigs } from "./providers/index.js"

// API (Internal adapter and routes)
export { createAIGatewayAdapter, incrementRateLimits } from "./api/internal-adapter.js"
export type { AIGatewayAdapter, RecordUsageInput, GetUsageRecordsOptions } from "./api/internal-adapter.js"
export type { AIGatewayRouteConfig } from "./api/types.js"

// =============================================================================
// CLIENT EXPORTS - Import from "nevr/ai-gateway/client" instead
// =============================================================================
// IMPORTANT: Client plugins are NOT re-exported here to prevent server-side
// code from leaking into browser bundles.
//
// For frontend/client usage:
//   import { aiGatewayClient, createUseAIChat } from "nevr/ai-gateway/client"
//
// Example:
//   const client = createClient({ plugins: [aiGatewayClient()] })
//   const useAIChat = createUseAIChat(React, client.ai)
// =============================================================================

// Re-export type-only client types for convenience
export type {
    AIGatewayClientPlugin,
    AIGatewayClientOptions,
    AIGatewayClientMethods,
    UsageState,
    ModelsState,
    ChatInput,
    ChatOutput,
    UsageOutput,
    RateLimitStatusOutput,
    ModelsOutput,
} from "./client.js"
