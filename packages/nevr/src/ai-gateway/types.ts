// =============================================================================
// AI GATEWAY TYPES
// Type definitions for the AI Gateway plugin
// =============================================================================

import type { Driver } from "../types.js"

// -----------------------------------------------------------------------------
// Provider Types
// -----------------------------------------------------------------------------

export type AIProviderType = "openai" | "anthropic" | "google"

export interface AIProviderConfig {
    /** API key for the provider */
    apiKey?: string
    /** Default model to use */
    defaultModel?: string
    /** Base URL for API (custom endpoints) */
    baseUrl?: string
    /** Request timeout in milliseconds */
    timeout?: number
    /** Organization ID (OpenAI) */
    organization?: string
}

export interface OpenAIConfig extends AIProviderConfig {
    /** OpenAI organization ID */
    organization?: string
}

export interface AnthropicConfig extends AIProviderConfig {
    /** Anthropic API version */
    version?: string
}

export interface GoogleConfig extends AIProviderConfig {
    /** Google Cloud project ID */
    projectId?: string
    /** Google Cloud location */
    location?: string
}

// -----------------------------------------------------------------------------
// Chat Types
// -----------------------------------------------------------------------------

export type ChatRole = "system" | "user" | "assistant" | "function" | "tool"

/** Text content part */
export interface TextContent {
    type: "text"
    text: string
}

/** Image content part (for vision models) */
export interface ImageContent {
    type: "image"
    /** Base64 encoded image data or URL */
    image: string
    /** MIME type (e.g., "image/png", "image/jpeg") */
    mimeType?: string
    /** Image detail level for OpenAI (low, high, auto) */
    detail?: "low" | "high" | "auto"
}

/** Message content - can be string or array of content parts */
export type MessageContent = string | Array<TextContent | ImageContent>

export interface ChatMessage {
    role: ChatRole
    content: MessageContent
    name?: string
    /** Tool call ID (for tool response messages) */
    toolCallId?: string
    /** Tool calls made by assistant */
    toolCalls?: ToolCall[]
}

/** Tool/Function definition */
export interface ToolDefinition {
    type: "function"
    function: {
        /** Function name */
        name: string
        /** Function description */
        description?: string
        /** JSON Schema for parameters */
        parameters?: Record<string, unknown>
        /** Whether function execution is strict (OpenAI) */
        strict?: boolean
    }
}

/** Tool call made by the model */
export interface ToolCall {
    /** Tool call ID */
    id: string
    type: "function"
    function: {
        name: string
        arguments: string
    }
}

/** Tool choice option */
export type ToolChoice = "auto" | "none" | "required" | { type: "function"; function: { name: string } }

export interface ChatParams {
    /** Provider to use (overrides default) */
    provider?: AIProviderType
    /** Model to use (overrides default) */
    model?: string
    /** Messages for the conversation */
    messages: ChatMessage[]
    /** Temperature (0-2, default 1) */
    temperature?: number
    /** Maximum tokens to generate */
    maxTokens?: number
    /** Stop sequences */
    stop?: string[]
    /** Enable streaming */
    stream?: boolean
    /** Top-p nucleus sampling */
    topP?: number
    /** Frequency penalty (-2 to 2) */
    frequencyPenalty?: number
    /** Presence penalty (-2 to 2) */
    presencePenalty?: number
    /** Custom metadata for tracking */
    metadata?: Record<string, unknown>
    /** Tools available to the model */
    tools?: ToolDefinition[]
    /** How to choose tools */
    toolChoice?: ToolChoice
    /** Abort signal for cancellation */
    signal?: AbortSignal
    /** Conversation ID for persistence */
    conversationId?: string
}

export interface ChatResponse {
    /** Unique request ID */
    id: string
    /** Provider used */
    provider: AIProviderType
    /** Model used */
    model: string
    /** Generated content */
    content: string
    /** Reason for completion */
    finishReason: "stop" | "length" | "content_filter" | "tool_calls" | null
    /** Usage statistics */
    usage: TokenUsage
    /** Response metadata */
    metadata?: Record<string, unknown>
    /** Tool calls made by the model */
    toolCalls?: ToolCall[]
}

export interface ChatChunk {
    /** Chunk ID */
    id: string
    /** Content delta */
    content: string
    /** Is this the final chunk? */
    done: boolean
    /** Finish reason (only on last chunk) */
    finishReason?: ChatResponse["finishReason"]
    /** Usage (only on last chunk) */
    usage?: TokenUsage
    /** Tool call deltas */
    toolCalls?: ToolCall[]
}

// -----------------------------------------------------------------------------
// Conversation Types (for persistence)
// -----------------------------------------------------------------------------

export interface Conversation {
    /** Unique conversation ID */
    id: string
    /** Reference ID (user or organization) */
    referenceId: string
    /** Conversation title */
    title?: string
    /** System prompt for this conversation */
    systemPrompt?: string
    /** Messages in the conversation */
    messages: ChatMessage[]
    /** Default model for this conversation */
    model?: string
    /** Default provider for this conversation */
    provider?: AIProviderType
    /** Custom metadata */
    metadata?: Record<string, unknown>
    /** Total tokens used in this conversation */
    totalTokens: number
    /** Total cost for this conversation */
    totalCost: number
    /** Creation timestamp */
    createdAt: Date
    /** Last update timestamp */
    updatedAt: Date
}

export interface ConversationCreateInput {
    title?: string
    systemPrompt?: string
    model?: string
    provider?: AIProviderType
    metadata?: Record<string, unknown>
}

export interface ConversationUpdateInput {
    title?: string
    systemPrompt?: string
    model?: string
    provider?: AIProviderType
    metadata?: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// Usage & Billing Types
// -----------------------------------------------------------------------------

export interface TokenUsage {
    /** Input/prompt tokens */
    inputTokens: number
    /** Output/completion tokens */
    outputTokens: number
    /** Total tokens */
    totalTokens: number
    /** Calculated cost in USD */
    cost: number
}

export interface UsageRecord {
    id: string
    referenceId: string
    provider: AIProviderType
    model: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cost: number
    requestId?: string
    metadata?: Record<string, unknown>
    createdAt: Date
}

export interface UsageSummary {
    /** Time period */
    period: {
        start: Date
        end: Date
    }
    /** Total tokens used */
    totalTokens: number
    /** Total cost in USD */
    totalCost: number
    /** Plan token limit (-1 = unlimited) */
    limit: number
    /** Remaining tokens */
    remaining: number
    /** Usage breakdown by model */
    breakdown: Array<{
        provider: AIProviderType
        model: string
        tokens: number
        cost: number
        requests: number
    }>
}

export interface UsageQueryOptions {
    /** Time period: "day" | "week" | "month" | "year" */
    period?: "day" | "week" | "month" | "year"
    /** Custom start date */
    startDate?: Date
    /** Custom end date */
    endDate?: Date
    /** Group by: "model" | "provider" | "day" */
    groupBy?: "model" | "provider" | "day"
}

// -----------------------------------------------------------------------------
// Plan & Limits Types
// -----------------------------------------------------------------------------

export interface PlanLimits {
    /** Token limit per month (-1 = unlimited) */
    tokens: number
    /** Requests per minute */
    requestsPerMinute: number
    /** Requests per day (optional) */
    requestsPerDay?: number
    /** Allowed models (empty = all) */
    allowedModels?: string[]
    /** Allowed providers (empty = all) */
    allowedProviders?: AIProviderType[]
}

export interface RateLimitState {
    /** Current minute request count */
    minuteCount: number
    /** Minute window start */
    minuteStart: number
    /** Current day request count */
    dayCount: number
    /** Day window start */
    dayStart: number
    /** Month token count */
    monthTokens: number
    /** Month window start */
    monthStart: number
}

export interface RateLimitResult {
    allowed: boolean
    reason?: "minute_limit" | "day_limit" | "token_limit" | "model_not_allowed" | "provider_not_allowed"
    limit?: number
    current?: number
    resetAt?: Date
}

// -----------------------------------------------------------------------------
// Pricing Types
// -----------------------------------------------------------------------------

export interface ModelPricing {
    /** Cost per 1K input tokens in USD */
    input: number
    /** Cost per 1K output tokens in USD */
    output: number
}

export interface ProviderPricing {
    [model: string]: ModelPricing
}

export interface PricingConfig {
    openai: ProviderPricing
    anthropic: ProviderPricing
    google: ProviderPricing
}

// -----------------------------------------------------------------------------
// Model Info Types
// -----------------------------------------------------------------------------

export interface ModelInfo {
    /** Model identifier */
    id: string
    /** Display name */
    name: string
    /** Provider */
    provider: AIProviderType
    /** Context window size */
    contextWindow: number
    /** Max output tokens */
    maxOutput: number
    /** Supports vision/images */
    vision?: boolean
    /** Supports function calling */
    functionCalling?: boolean
    /** Supports streaming */
    streaming?: boolean
    /** Pricing info */
    pricing: ModelPricing
}

// -----------------------------------------------------------------------------
// Hook Types
// -----------------------------------------------------------------------------

export interface AIGatewayHooks {
    /** Called before making an AI request */
    beforeRequest?: (
        params: ChatParams,
        userId?: string,
        referenceId?: string
    ) => Promise<ChatParams | null>

    /** Called after receiving a response */
    afterRequest?: (
        response: ChatResponse,
        params: ChatParams,
        userId?: string
    ) => Promise<void>

    /** Called when rate limit is hit */
    onRateLimitExceeded?: (
        result: RateLimitResult,
        userId?: string,
        referenceId?: string
    ) => Promise<void>

    /** Called when usage is recorded */
    onUsageRecorded?: (
        usage: UsageRecord,
        driver: Driver
    ) => Promise<void>
}

// -----------------------------------------------------------------------------
// Plugin Options
// -----------------------------------------------------------------------------

export interface AIGatewayPluginOptions {
    /** Provider configurations */
    providers: {
        openai?: OpenAIConfig
        anthropic?: AnthropicConfig
        google?: GoogleConfig
    }

    /** Default provider when not specified in request */
    defaultProvider?: AIProviderType

    /** Enable usage tracking (default: true) */
    trackUsage?: boolean

    /** Plan-based limits */
    limits?: {
        [planName: string]: PlanLimits
    }

    /** Function to get user's current plan */
    getPlan?: (userId: string, driver: Driver) => Promise<string>

    /** Custom pricing configuration (default: built-in) */
    pricing?: PricingConfig | "default"

    /** Reference ID mode for multi-tenant */
    referenceMode?: "user" | "organization" | "custom"

    /** Custom reference ID resolver */
    getReference?: (userId: string, driver: Driver) => Promise<string>

    /** Lifecycle hooks */
    hooks?: AIGatewayHooks

    /** Enable debug logging */
    debug?: boolean

    /** Request timeout in milliseconds (default: 60000) */
    timeout?: number

    /** Retry configuration */
    retry?: {
        /** Max retry attempts (default: 3) */
        attempts?: number
        /** Base delay in ms (default: 1000) */
        delay?: number
        /** Exponential backoff multiplier (default: 2) */
        multiplier?: number
    }
}

// -----------------------------------------------------------------------------
// AI Gateway Instance
// -----------------------------------------------------------------------------

export interface AIGateway {
    /** Chat completion */
    chat(params: ChatParams): Promise<ChatResponse>

    /** Streaming chat completion */
    chatStream(params: ChatParams): AsyncGenerator<ChatChunk, void, unknown>

    /** Get usage summary */
    getUsage(referenceId: string, options?: UsageQueryOptions): Promise<UsageSummary>

    /** Get available models */
    getModels(): ModelInfo[]

    /** Check rate limit */
    checkRateLimit(referenceId: string, plan: string): Promise<RateLimitResult>

    /** Get provider instance */
    getProvider(type: AIProviderType): AIProvider | null

    /** Count tokens for text */
    countTokens(text: string, model?: string): number

    /** Calculate cost for usage */
    calculateCost(provider: AIProviderType, model: string, usage: Omit<TokenUsage, "cost">): number
}

// -----------------------------------------------------------------------------
// Provider Interface
// -----------------------------------------------------------------------------

export interface AIProvider {
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
// Route Config
// -----------------------------------------------------------------------------

export interface AIGatewayRouteConfig {
    options: AIGatewayPluginOptions
    getGateway: () => AIGateway
    getProvider: (type: AIProviderType) => AIProvider | null
}
