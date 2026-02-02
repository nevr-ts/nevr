// =============================================================================
// AI GATEWAY CLIENT
// Client-side API for AI Gateway plugin
// =============================================================================

import { atom, type WritableAtom } from "nanostores"
import type { NevrClientPlugin, NevrFetch, ClientStore, NevrClientOptions } from "../client/types.js"
import type {
    AIProviderType,
    ChatParams,
    ChatResponse,
    ChatChunk,
    UsageSummary,
    UsageRecord,
    ModelInfo,
    ToolDefinition,
    ToolCall,
    ToolChoice,
    TextContent,
    ImageContent,
    Conversation,
} from "./types.js"

// -----------------------------------------------------------------------------
// State Types
// -----------------------------------------------------------------------------

export interface UsageState {
    usage: UsageOutput | null
    isLoading: boolean
    error: Error | null
}

export interface ModelsState {
    models: ModelsOutput | null
    isLoading: boolean
    error: Error | null
}

// -----------------------------------------------------------------------------
// Client Plugin Type
// -----------------------------------------------------------------------------

/**
 * AI Gateway plugin client methods (namespaced under `ai`)
 */
export interface AIGatewayPluginMethods {
    ai: AIGatewayClientMethods
}

export type AIGatewayClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        endpoints: AIGatewayClientMethods
        $ERROR_CODES: typeof import("./error-codes.js").AI_GATEWAY_ERROR_CODES
        UsageRecord: UsageRecord
        ChatResponse: ChatResponse
    }
    readonly $InferActions: AIGatewayPluginMethods
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AIGatewayClientOptions {
    /** Base path for AI Gateway API (default: "/ai") */
    basePath?: string
    /** Custom fetch function */
    fetch?: typeof fetch
    /** Get auth token for requests */
    getToken?: () => string | Promise<string> | null
}

export interface AIGatewayClientMethods {
    /** Chat completion */
    chat(params: ChatInput, options?: ChatRequestOptions): Promise<ChatOutput>
    /** Streaming chat completion */
    chatStream(params: ChatInput, options?: ChatRequestOptions): AsyncGenerator<ChatChunk, void, unknown>
    /** Get usage summary */
    getUsage(options?: UsageQueryInput): Promise<UsageOutput>
    /** Get usage records */
    getUsageRecords(options?: UsageRecordsInput): Promise<UsageRecordsOutput>
    /** Get rate limit status */
    getRateLimitStatus(): Promise<RateLimitStatusOutput>
    /** List available models */
    getModels(): Promise<ModelsOutput>
    /** Get model info */
    getModelInfo(provider: AIProviderType, model: string): Promise<ModelInfo | null>
    /** Count tokens in text */
    countTokens(text: string, options?: CountTokensInput): Promise<CountTokensOutput>
    /** Create a new conversation */
    createConversation(input?: ConversationCreateInput): Promise<ConversationOutput>
    /** Get a conversation by ID */
    getConversation(id: string): Promise<ConversationOutput | null>
    /** List conversations */
    listConversations(options?: ConversationListInput): Promise<ConversationListOutput>
    /** Update a conversation */
    updateConversation(id: string, input: ConversationUpdateInput): Promise<ConversationOutput>
    /** Delete a conversation */
    deleteConversation(id: string): Promise<void>
    /** Add a message to a conversation and get AI response */
    sendMessage(conversationId: string, content: string, options?: SendMessageOptions): Promise<ChatOutput>
}

/** Options for chat requests */
export interface ChatRequestOptions {
    /** Abort signal for cancellation */
    signal?: AbortSignal
}

/** Options for sending a message to a conversation */
export interface SendMessageOptions {
    /** Override model for this message */
    model?: string
    /** Override provider for this message */
    provider?: AIProviderType
    /** Enable streaming */
    stream?: boolean
    /** Abort signal for cancellation */
    signal?: AbortSignal
}

/** Message content - text or multimodal */
export type ClientMessageContent = string | Array<TextContent | ImageContent>

/** Chat message for client */
export interface ClientChatMessage {
    role: "system" | "user" | "assistant" | "tool"
    content: ClientMessageContent
    /** Tool call ID (for tool response messages) */
    toolCallId?: string
    /** Tool calls made by assistant */
    toolCalls?: ToolCall[]
    /** Name for tool responses */
    name?: string
}

export interface ChatInput {
    /** Provider to use */
    provider?: AIProviderType
    /** Model to use */
    model?: string
    /** Messages for the conversation */
    messages: ClientChatMessage[]
    /** Temperature (0-2) */
    temperature?: number
    /** Max tokens to generate */
    maxTokens?: number
    /** Stop sequences */
    stop?: string[]
    /** Enable streaming */
    stream?: boolean
    /** Top-p nucleus sampling */
    topP?: number
    /** Frequency penalty */
    frequencyPenalty?: number
    /** Presence penalty */
    presencePenalty?: number
    /** Custom metadata */
    metadata?: Record<string, unknown>
    /** Tools available to the model */
    tools?: ToolDefinition[]
    /** How to choose tools */
    toolChoice?: ToolChoice
    /** Conversation ID for persistence */
    conversationId?: string
}

export interface ChatOutput {
    id: string
    provider: AIProviderType
    model: string
    content: string
    finishReason: "stop" | "length" | "content_filter" | "tool_calls" | null
    usage: {
        inputTokens: number
        outputTokens: number
        totalTokens: number
        cost: number
    }
    /** Tool calls made by the model */
    toolCalls?: ToolCall[]
}

export interface UsageQueryInput {
    period?: "day" | "week" | "month" | "year"
    startDate?: string
    endDate?: string
    groupBy?: "model" | "provider" | "day"
}

export interface UsageOutput {
    period: { start: string; end: string }
    totalTokens: number
    totalCost: number
    limit: number
    remaining: number
    breakdown: Array<{
        provider: AIProviderType
        model: string
        tokens: number
        cost: number
        requests: number
    }>
}

export interface UsageRecordsInput {
    startDate?: string
    endDate?: string
    provider?: AIProviderType
    model?: string
    limit?: number
    offset?: number
}

export interface UsageRecordsOutput {
    records: UsageRecord[]
    pagination: {
        limit: number
        offset: number
        hasMore: boolean
    }
}

export interface RateLimitStatusOutput {
    plan: string
    limits: {
        requestsPerMinute: number
        requestsPerDay: number | null
        tokensPerMonth: number
        allowedModels: string[] | null
        allowedProviders: AIProviderType[] | null
    } | null
    current: {
        minuteRequests: number
        dayRequests: number
        monthTokens: number
    }
    remaining: {
        minuteRequests: number | null
        dayRequests: number | null
        monthTokens: number | null
    }
    resets: {
        minute: string | null
        day: string | null
        month: string | null
    }
}

export interface ModelsOutput {
    providers: Record<AIProviderType, ModelInfo[]>
    configured: AIProviderType[]
    default: {
        provider: AIProviderType
        model: string
    }
}

export interface CountTokensInput {
    provider?: AIProviderType
    model?: string
}

export interface CountTokensOutput {
    text: string
    tokens: number
    provider: AIProviderType
    model: string
}

// -----------------------------------------------------------------------------
// Conversation Types
// -----------------------------------------------------------------------------

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

export interface ConversationListInput {
    limit?: number
    offset?: number
}

export interface ConversationOutput {
    id: string
    title?: string
    systemPrompt?: string
    messages: ClientChatMessage[]
    model?: string
    provider?: AIProviderType
    metadata?: Record<string, unknown>
    totalTokens: number
    totalCost: number
    createdAt: string
    updatedAt: string
}

export interface ConversationListOutput {
    conversations: Array<Omit<ConversationOutput, "messages">>
    pagination: {
        limit: number
        offset: number
        total: number
        hasMore: boolean
    }
}

// -----------------------------------------------------------------------------
// Internal Client Factory (used by plugin internally)
// -----------------------------------------------------------------------------

/**
 * Internal client factory - creates AI Gateway client methods
 * @internal Not exported - use aiGatewayClient() plugin with createClient instead
 */
function createAIClientMethods(options: AIGatewayClientOptions = {}): AIGatewayClientMethods {
    const basePath = options.basePath || "/ai"
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const fetchFn = options.fetch || fetch

    async function request<T>(
        method: string,
        path: string,
        body?: Record<string, unknown>,
        query?: Record<string, unknown>
    ): Promise<T> {
        let url = `${baseUrl}${basePath}${path}`

        // Add query params
        if (query && Object.keys(query).length > 0) {
            const params = new URLSearchParams()
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined && value !== null) {
                    params.set(key, String(value))
                }
            }
            url += `?${params.toString()}`
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }

        // Add auth token if available
        if (options.getToken) {
            const token = await options.getToken()
            if (token) {
                headers["Authorization"] = `Bearer ${token}`
            }
        }

        const response = await fetchFn(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            credentials: "include",
        })

        const data = await response.json()

        if (!response.ok) {
            const error = new Error(data.message || "Request failed") as any
            error.code = data.error || data.code
            error.status = response.status
            error.data = data
            throw error
        }

        return data
    }

    return {
        async chat(params) {
            return request<ChatOutput>("POST", "/chat", params as unknown as Record<string, unknown>)
        },

        async *chatStream(params) {
            let url = `${baseUrl}${basePath}/chat`

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            }

            // Add auth token if available
            if (options.getToken) {
                const token = await options.getToken()
                if (token) {
                    headers["Authorization"] = `Bearer ${token}`
                }
            }

            const response = await fetchFn(url, {
                method: "POST",
                headers,
                body: JSON.stringify({ ...params, stream: true }),
                credentials: "include",
            })

            if (!response.ok) {
                const data = await response.json()
                const error = new Error(data.message || "Request failed") as any
                error.code = data.error || data.code
                error.status = response.status
                throw error
            }

            if (!response.body) {
                throw new Error("No response body")
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop() || ""

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed || !trimmed.startsWith("data: ")) continue

                    const data = trimmed.slice(6)
                    if (data === "[DONE]") return

                    try {
                        const chunk = JSON.parse(data) as ChatChunk
                        yield chunk
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        },

        async getUsage(queryOptions = {}) {
            return request<UsageOutput>("GET", "/usage", undefined, queryOptions as Record<string, unknown>)
        },

        async getUsageRecords(queryOptions = {}) {
            return request<UsageRecordsOutput>("GET", "/usage/records", undefined, queryOptions as Record<string, unknown>)
        },

        async getRateLimitStatus() {
            return request<RateLimitStatusOutput>("GET", "/usage/limits")
        },

        async getModels() {
            return request<ModelsOutput>("GET", "/models")
        },

        async getModelInfo(provider, model) {
            try {
                return await request<ModelInfo>("GET", `/models/${provider}/${model}`)
            } catch {
                return null
            }
        },

        async countTokens(text, tokenOptions = {}) {
            return request<CountTokensOutput>("POST", "/tokens/count", {
                text,
                ...tokenOptions,
            })
        },

        // Conversation methods
        async createConversation(input = {}) {
            return request<ConversationOutput>("POST", "/conversations", input as unknown as Record<string, unknown>)
        },

        async getConversation(id) {
            try {
                return await request<ConversationOutput>("GET", `/conversations/${id}`)
            } catch {
                return null
            }
        },

        async listConversations(listOptions = {}) {
            return request<ConversationListOutput>("GET", "/conversations", undefined, listOptions as Record<string, unknown>)
        },

        async updateConversation(id, input) {
            return request<ConversationOutput>("PATCH", `/conversations/${id}`, input as unknown as Record<string, unknown>)
        },

        async deleteConversation(id) {
            await request<void>("DELETE", `/conversations/${id}`)
        },

        async sendMessage(conversationId, content, sendOptions = {}) {
            return request<ChatOutput>("POST", `/conversations/${conversationId}/messages`, {
                content,
                ...sendOptions,
            } as Record<string, unknown>)
        },
    }
}

// -----------------------------------------------------------------------------
// Plugin for createClient
// -----------------------------------------------------------------------------

/**
 * AI Gateway client plugin for use with createClient
 *
 * @example
 * ```typescript
 * import { createClient } from "nevr/client"
 * import { aiGatewayClient } from "nevr/ai-gateway/client"
 *
 * const client = createClient({
 *   plugins: [aiGatewayClient()],
 * })
 *
 * // Now you can use client.ai.*
 * const response = await client.ai.chat({
 *   messages: [{ role: "user", content: "Hello" }],
 * })
 * ```
 */
export function aiGatewayClient(options: AIGatewayClientOptions = {}): AIGatewayClientPlugin {
    const basePath = options.basePath || "/ai"

    // Reactive atoms
    let $usage: WritableAtom<UsageState>
    let $models: WritableAtom<ModelsState>

    return {
        id: "ai-gateway",

        pathMethods: {
            [`${basePath}/chat`]: "POST",
            [`${basePath}/usage`]: "GET",
            [`${basePath}/usage/records`]: "GET",
            [`${basePath}/usage/limits`]: "GET",
            [`${basePath}/models`]: "GET",
            [`${basePath}/tokens/count`]: "POST",
            [`${basePath}/conversations`]: "POST",
            [`${basePath}/conversations/:id`]: "GET",
            [`${basePath}/conversations/:id/messages`]: "POST",
        },

        getAtoms: ($fetch: NevrFetch) => {
            $usage = atom<UsageState>({
                usage: null,
                isLoading: true,
                error: null,
            })

            $models = atom<ModelsState>({
                models: null,
                isLoading: true,
                error: null,
            })

            // Initial fetch
            refreshUsage($fetch)
            refreshModels($fetch)

            return {
                usage: $usage,
                models: $models,
            }

            async function refreshUsage(fetch: NevrFetch) {
                $usage.set({ ...$usage.get(), isLoading: true })
                try {
                    const result = await fetch(`${basePath}/usage`, { method: "GET" })
                    if (result.error) {
                        $usage.set({ usage: null, error: result.error as any, isLoading: false })
                    } else {
                        $usage.set({ usage: result.data as UsageOutput, error: null, isLoading: false })
                    }
                } catch (error) {
                    $usage.set({ usage: null, error: error as Error, isLoading: false })
                }
            }

            async function refreshModels(fetch: NevrFetch) {
                $models.set({ ...$models.get(), isLoading: true })
                try {
                    const result = await fetch(`${basePath}/models`, { method: "GET" })
                    if (result.error) {
                        $models.set({ models: null, error: result.error as any, isLoading: false })
                    } else {
                        $models.set({ models: result.data as ModelsOutput, error: null, isLoading: false })
                    }
                } catch (error) {
                    $models.set({ models: null, error: error as Error, isLoading: false })
                }
            }
        },

        atomListeners: ["chat", "countTokens"],

        getActions: ($fetch: NevrFetch, _$store: ClientStore, clientOptions?: NevrClientOptions) => {
            // Merge options
            const mergedOptions: AIGatewayClientOptions = {
                ...options,
                basePath,
            }

            // Use client's fetch if available
            const fetchFn = async (url: string, init: RequestInit) => {
                const response = await $fetch(url, {
                    method: init.method as "GET" | "POST",
                    body: init.body ? JSON.parse(init.body as string) : undefined,
                    headers: init.headers as Record<string, string>,
                })
                return {
                    ok: !response.error,
                    status: response.error?.status || 200,
                    json: async () => response.error || response.data,
                    body: null as any,
                } as Response
            }

            const client = createAIClientMethods({
                ...mergedOptions,
                fetch: fetchFn as typeof fetch,
            })

            return {
                ai: client,
            }
        },

        // Type inference for SDK
        $InferTypes: {
            endpoints: {} as AIGatewayClientMethods,
            $ERROR_CODES: {} as typeof import("./error-codes.js").AI_GATEWAY_ERROR_CODES,
            UsageRecord: {} as import("./types.js").UsageRecord,
            ChatResponse: {} as import("./types.js").ChatResponse,
        },

        $InferActions: {} as AIGatewayPluginMethods,
    } as unknown as AIGatewayClientPlugin
}

// -----------------------------------------------------------------------------
// React Hooks (if React is available)
// -----------------------------------------------------------------------------

export interface UseAIChatOptions {
    /** System prompt to prepend to all conversations */
    systemPrompt?: string
    /** Default model to use */
    model?: string
    /** Default provider to use */
    provider?: AIProviderType
}

export interface UseAIChatResult {
    messages: Array<{ role: "user" | "system" | "assistant"; content: string }>
    isLoading: boolean
    error: Error | null
    send: (content: string) => Promise<void>
    sendStream: (content: string) => AsyncGenerator<string, void, unknown>
    clear: () => void
}

/**
 * Factory for creating useAIChat React hook
 *
 * @example
 * ```tsx
 * import { createClient } from "nevr/client"
 * import { aiGatewayClient, createUseAIChat } from "nevr/ai-gateway/client"
 * import React from "react"
 *
 * // Create the nevr client with AI Gateway plugin
 * const client = createClient({
 *   plugins: [aiGatewayClient()],
 * })
 *
 * // Create the hook bound to your client
 * const useAIChat = createUseAIChat(React, client.ai)
 *
 * function ChatComponent() {
 *   const { messages, isLoading, send } = useAIChat({
 *     systemPrompt: "You are a helpful assistant.",
 *   })
 *
 *   const handleSend = async () => {
 *     await send("Hello, how are you?")
 *   }
 *
 *   return (
 *     <div>
 *       {messages.map((m, i) => (
 *         <div key={i}>{m.role}: {m.content}</div>
 *       ))}
 *       {isLoading && <div>Thinking...</div>}
 *       <button onClick={handleSend}>Send</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function createUseAIChat(
    React: {
        useState: <T>(initial: T) => [T, (value: T | ((prev: T) => T)) => void]
        useCallback: <T extends (...args: any[]) => any>(callback: T, deps: any[]) => T
    },
    aiClient: AIGatewayClientMethods
) {
    return function useAIChat(options: UseAIChatOptions = {}): UseAIChatResult {
        const { useState, useCallback } = React

        const [messages, setMessages] = useState<Array<{ role: "user" | "system" | "assistant"; content: string }>>([])
        const [isLoading, setIsLoading] = useState(false)
        const [error, setError] = useState<Error | null>(null)

        const send = useCallback(async (content: string) => {
            setIsLoading(true)
            setError(null)

            const userMessage = { role: "user" as const, content }
            setMessages((prev) => [...prev, userMessage])

            try {
                const allMessages = [
                    ...(options.systemPrompt
                        ? [{ role: "system" as const, content: options.systemPrompt }]
                        : []),
                    ...messages,
                    userMessage,
                ]

                const response = await aiClient.chat({
                    messages: allMessages,
                    model: options.model,
                    provider: options.provider,
                })

                setMessages((prev) => [
                    ...prev,
                    { role: "assistant" as const, content: response.content },
                ])
            } catch (err) {
                setError(err as Error)
            } finally {
                setIsLoading(false)
            }
        }, [messages, options.systemPrompt, options.model, options.provider])

        const sendStream = useCallback(async function* (content: string) {
            setIsLoading(true)
            setError(null)

            const userMessage = { role: "user" as const, content }
            setMessages((prev) => [...prev, userMessage])

            let assistantContent = ""

            try {
                const allMessages = [
                    ...(options.systemPrompt
                        ? [{ role: "system" as const, content: options.systemPrompt }]
                        : []),
                    ...messages,
                    userMessage,
                ]

                for await (const chunk of aiClient.chatStream({
                    messages: allMessages,
                    model: options.model,
                    provider: options.provider,
                    stream: true,
                })) {
                    if (chunk.content) {
                        assistantContent += chunk.content
                        yield chunk.content
                    }
                }

                setMessages((prev) => [
                    ...prev,
                    { role: "assistant" as const, content: assistantContent },
                ])
            } catch (err) {
                setError(err as Error)
            } finally {
                setIsLoading(false)
            }
        }, [messages, options.systemPrompt, options.model, options.provider])

        const clear = useCallback(() => {
            setMessages([])
            setError(null)
        }, [])

        return {
            messages,
            isLoading,
            error,
            send,
            sendStream,
            clear,
        }
    }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export default aiGatewayClient

// Legacy alias for backwards compatibility (deprecated)
export { aiGatewayClient as aiClient }
