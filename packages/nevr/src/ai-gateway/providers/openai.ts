// =============================================================================
// OPENAI PROVIDER
// OpenAI API implementation
// =============================================================================

import type {
    AIProviderType,
    OpenAIConfig,
    ChatParams,
    ChatResponse,
    ChatChunk,
    ChatMessage,
    ModelInfo,
    ToolDefinition,
    ToolCall,
    MessageContent,
    TextContent,
    ImageContent,
} from "../types.js"
import { BaseAIProvider, DEFAULT_MODELS, calculateCost } from "./types.js"
import { AIGatewayError, AI_GATEWAY_ERROR_CODES } from "../error-codes.js"

// -----------------------------------------------------------------------------
// OpenAI Provider
// -----------------------------------------------------------------------------

export class OpenAIProvider extends BaseAIProvider {
    readonly name: AIProviderType = "openai"
    readonly defaultModel = "gpt-5-mini"

    private organization?: string

    constructor(config: OpenAIConfig) {
        super(config)
        this.organization = config.organization

        // Register available models
        Object.values(DEFAULT_MODELS.openai || {}).forEach((model) => {
            this.registerModel(model)
        })
    }

    get models(): string[] {
        return Object.keys(DEFAULT_MODELS.openai || {})
    }

    /**
     * Chat completion with abort signal, tools, and vision support
     */
    async chat(params: ChatParams, signal?: AbortSignal): Promise<ChatResponse> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://api.openai.com/v1"

        const body = this.buildRequestBody(params, model)

        // Create combined abort signal (user signal + timeout)
        const timeoutController = new AbortController()
        const timeout = setTimeout(() => timeoutController.abort(), this.getTimeout())

        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutController.signal])
            : timeoutController.signal

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
                signal: combinedSignal,
            })

            clearTimeout(timeout)

            if (!response.ok) {
                await this.handleErrorResponse(response)
            }

            const data = await response.json() as OpenAIChatResponse

            const inputTokens = data.usage?.prompt_tokens || 0
            const outputTokens = data.usage?.completion_tokens || 0
            const totalTokens = inputTokens + outputTokens
            const cost = calculateCost("openai", model, inputTokens, outputTokens)

            // Extract tool calls if present
            const toolCalls = data.choices[0]?.message?.tool_calls?.map((tc): ToolCall => ({
                id: tc.id,
                type: "function",
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                },
            }))

            return {
                id: requestId,
                provider: "openai",
                model,
                content: data.choices[0]?.message?.content || "",
                finishReason: this.mapFinishReason(data.choices[0]?.finish_reason),
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    cost,
                },
                toolCalls,
            }
        } catch (error) {
            clearTimeout(timeout)
            if (error instanceof AIGatewayError) throw error
            if ((error as Error).name === "AbortError") {
                throw new AIGatewayError(
                    AI_GATEWAY_ERROR_CODES.REQUEST_CANCELLED,
                    "Request was cancelled"
                )
            }
            throw new AIGatewayError(
                AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR,
                `OpenAI error: ${(error as Error).message}`
            )
        }
    }

    /**
     * Streaming chat completion with abort signal and tools support
     */
    async *chatStream(params: ChatParams, signal?: AbortSignal): AsyncGenerator<ChatChunk, void, unknown> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://api.openai.com/v1"

        const body = this.buildRequestBody(params, model)
        body.stream = true
        body.stream_options = { include_usage: true }

        // Create combined abort signal (user signal + timeout)
        const timeoutController = new AbortController()
        const timeout = setTimeout(() => timeoutController.abort(), this.getTimeout())

        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutController.signal])
            : timeoutController.signal

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
                signal: combinedSignal,
            })

            clearTimeout(timeout)

            if (!response.ok) {
                await this.handleErrorResponse(response)
            }

            if (!response.body) {
                throw new AIGatewayError(AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR, "No response body")
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""
            let totalInputTokens = 0
            let totalOutputTokens = 0
            // Accumulate tool calls across chunks
            const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

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
                    if (data === "[DONE]") {
                        // Build final tool calls
                        const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map(tc => ({
                            id: tc.id,
                            type: "function" as const,
                            function: { name: tc.name, arguments: tc.arguments },
                        }))

                        yield {
                            id: requestId,
                            content: "",
                            done: true,
                            usage: {
                                inputTokens: totalInputTokens,
                                outputTokens: totalOutputTokens,
                                totalTokens: totalInputTokens + totalOutputTokens,
                                cost: calculateCost("openai", model, totalInputTokens, totalOutputTokens),
                            },
                            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                        }
                        return
                    }

                    try {
                        const parsed = JSON.parse(data) as OpenAIStreamChunk

                        // Track usage from final chunk
                        if (parsed.usage) {
                            totalInputTokens = parsed.usage.prompt_tokens || 0
                            totalOutputTokens = parsed.usage.completion_tokens || 0
                        }

                        const delta = parsed.choices?.[0]?.delta
                        const finishReason = parsed.choices?.[0]?.finish_reason

                        // Accumulate tool calls
                        if (delta?.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                const existing = toolCallsMap.get(tc.index)
                                if (existing) {
                                    if (tc.function?.arguments) {
                                        existing.arguments += tc.function.arguments
                                    }
                                } else {
                                    toolCallsMap.set(tc.index, {
                                        id: tc.id || "",
                                        name: tc.function?.name || "",
                                        arguments: tc.function?.arguments || "",
                                    })
                                }
                            }
                        }

                        if (delta?.content) {
                            yield {
                                id: requestId,
                                content: delta.content,
                                done: false,
                            }
                        }

                        if (finishReason) {
                            const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map(tc => ({
                                id: tc.id,
                                type: "function" as const,
                                function: { name: tc.name, arguments: tc.arguments },
                            }))

                            yield {
                                id: requestId,
                                content: "",
                                done: true,
                                finishReason: this.mapFinishReason(finishReason),
                                usage: {
                                    inputTokens: totalInputTokens,
                                    outputTokens: totalOutputTokens,
                                    totalTokens: totalInputTokens + totalOutputTokens,
                                    cost: calculateCost("openai", model, totalInputTokens, totalOutputTokens),
                                },
                                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                            }
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        } catch (error) {
            clearTimeout(timeout)
            if (error instanceof AIGatewayError) throw error
            if ((error as Error).name === "AbortError") {
                throw new AIGatewayError(
                    AI_GATEWAY_ERROR_CODES.REQUEST_CANCELLED,
                    "Request was cancelled"
                )
            }
            throw new AIGatewayError(
                AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR,
                `OpenAI streaming error: ${(error as Error).message}`
            )
        }
    }

    /**
     * Count tokens (rough approximation for OpenAI)
     */
    countTokens(text: string, _model?: string): number {
        // OpenAI uses ~4 characters per token on average
        // For more accurate counting, use tiktoken
        return Math.ceil(text.length / 4)
    }

    // -------------------------------------------------------------------------
    // Private Methods
    // -------------------------------------------------------------------------

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.getApiKey()}`,
        }

        if (this.organization) {
            headers["OpenAI-Organization"] = this.organization
        }

        return headers
    }

    private buildRequestBody(params: ChatParams, model: string): OpenAIRequestBody {
        const body: OpenAIRequestBody = {
            model,
            messages: params.messages.map((m) => this.mapMessage(m)),
        }

        if (params.temperature !== undefined) body.temperature = params.temperature
        if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens
        if (params.topP !== undefined) body.top_p = params.topP
        if (params.frequencyPenalty !== undefined) body.frequency_penalty = params.frequencyPenalty
        if (params.presencePenalty !== undefined) body.presence_penalty = params.presencePenalty
        if (params.stop) body.stop = params.stop

        // Add tools if provided
        if (params.tools && params.tools.length > 0) {
            body.tools = params.tools.map((t) => ({
                type: "function" as const,
                function: {
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters,
                    strict: t.function.strict,
                },
            }))
        }

        // Add tool choice if provided
        if (params.toolChoice) {
            body.tool_choice = params.toolChoice
        }

        return body
    }

    private mapMessage(message: ChatMessage): OpenAIMessage {
        const mapped: OpenAIMessage = {
            role: message.role as "system" | "user" | "assistant" | "tool",
        }

        // Handle content (string or multimodal)
        if (typeof message.content === "string") {
            mapped.content = message.content
        } else if (Array.isArray(message.content)) {
            // Multimodal content
            mapped.content = message.content.map((part) => {
                if (part.type === "text") {
                    return { type: "text" as const, text: part.text }
                } else if (part.type === "image") {
                    // Determine if it's a URL or base64
                    const isUrl = part.image.startsWith("http://") || part.image.startsWith("https://")
                    return {
                        type: "image_url" as const,
                        image_url: {
                            url: isUrl ? part.image : `data:${part.mimeType || "image/png"};base64,${part.image}`,
                            detail: part.detail || "auto",
                        },
                    }
                }
                return { type: "text" as const, text: "" }
            })
        }

        if (message.name) mapped.name = message.name

        // For tool response messages
        if (message.role === "tool" && message.toolCallId) {
            mapped.tool_call_id = message.toolCallId
        }

        // For assistant messages with tool calls
        if (message.role === "assistant" && message.toolCalls) {
            mapped.tool_calls = message.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                },
            }))
        }

        return mapped
    }

    private mapFinishReason(reason?: string): ChatResponse["finishReason"] {
        switch (reason) {
            case "stop":
                return "stop"
            case "length":
                return "length"
            case "content_filter":
                return "content_filter"
            case "tool_calls":
            case "function_call":
                return "tool_calls"
            default:
                return null
        }
    }

    private async handleErrorResponse(response: Response): Promise<never> {
        let errorMessage = `HTTP ${response.status}`
        try {
            const error = await response.json() as { error?: { message?: string } }
            errorMessage = error.error?.message || errorMessage
        } catch {
            // Use status code message
        }

        if (response.status === 401) {
            throw new AIGatewayError(AI_GATEWAY_ERROR_CODES.INVALID_API_KEY, errorMessage)
        }
        if (response.status === 429) {
            throw new AIGatewayError(AI_GATEWAY_ERROR_CODES.PROVIDER_RATE_LIMITED, errorMessage)
        }
        if (response.status === 503) {
            throw new AIGatewayError(AI_GATEWAY_ERROR_CODES.PROVIDER_UNAVAILABLE, errorMessage)
        }

        throw new AIGatewayError(AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR, errorMessage)
    }
}

// -----------------------------------------------------------------------------
// OpenAI API Types
// -----------------------------------------------------------------------------

type OpenAIContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }

interface OpenAIMessage {
    role: "system" | "user" | "assistant" | "function" | "tool"
    content?: string | OpenAIContentPart[]
    name?: string
    tool_call_id?: string
    tool_calls?: Array<{
        id: string
        type: "function"
        function: {
            name: string
            arguments: string
        }
    }>
}

interface OpenAITool {
    type: "function"
    function: {
        name: string
        description?: string
        parameters?: Record<string, unknown>
        strict?: boolean
    }
}

interface OpenAIRequestBody {
    model: string
    messages: OpenAIMessage[]
    temperature?: number
    max_tokens?: number
    top_p?: number
    frequency_penalty?: number
    presence_penalty?: number
    stop?: string[]
    stream?: boolean
    stream_options?: { include_usage: boolean }
    tools?: OpenAITool[]
    tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } }
}

interface OpenAIChatResponse {
    id: string
    choices: Array<{
        index: number
        message: {
            role: string
            content: string | null
            tool_calls?: Array<{
                id: string
                type: "function"
                function: {
                    name: string
                    arguments: string
                }
            }>
        }
        finish_reason: string
    }>
    usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

interface OpenAIStreamChunk {
    id: string
    choices?: Array<{
        index: number
        delta: {
            role?: string
            content?: string
            tool_calls?: Array<{
                index: number
                id?: string
                type?: "function"
                function?: {
                    name?: string
                    arguments?: string
                }
            }>
        }
        finish_reason?: string
    }>
    usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}
