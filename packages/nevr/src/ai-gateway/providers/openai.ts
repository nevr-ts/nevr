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
     * Chat completion
     */
    async chat(params: ChatParams): Promise<ChatResponse> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://api.openai.com/v1"

        const body = this.buildRequestBody(params, model)

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(this.getTimeout()),
            })

            if (!response.ok) {
                await this.handleErrorResponse(response)
            }

            const data = await response.json() as OpenAIChatResponse

            const inputTokens = data.usage?.prompt_tokens || 0
            const outputTokens = data.usage?.completion_tokens || 0
            const totalTokens = inputTokens + outputTokens
            const cost = calculateCost("openai", model, inputTokens, outputTokens)

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
            }
        } catch (error) {
            if (error instanceof AIGatewayError) throw error
            throw new AIGatewayError(
                AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR,
                `OpenAI error: ${(error as Error).message}`
            )
        }
    }

    /**
     * Streaming chat completion
     */
    async *chatStream(params: ChatParams): AsyncGenerator<ChatChunk, void, unknown> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://api.openai.com/v1"

        const body = this.buildRequestBody(params, model)
        body.stream = true
        body.stream_options = { include_usage: true }

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(this.getTimeout()),
            })

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

                        if (delta?.content) {
                            yield {
                                id: requestId,
                                content: delta.content,
                                done: false,
                            }
                        }

                        if (finishReason) {
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
                            }
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        } catch (error) {
            if (error instanceof AIGatewayError) throw error
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
            messages: params.messages.map(this.mapMessage),
        }

        if (params.temperature !== undefined) body.temperature = params.temperature
        if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens
        if (params.topP !== undefined) body.top_p = params.topP
        if (params.frequencyPenalty !== undefined) body.frequency_penalty = params.frequencyPenalty
        if (params.presencePenalty !== undefined) body.presence_penalty = params.presencePenalty
        if (params.stop) body.stop = params.stop

        return body
    }

    private mapMessage(message: ChatMessage): OpenAIMessage {
        return {
            role: message.role as "system" | "user" | "assistant",
            content: message.content,
            ...(message.name && { name: message.name }),
        }
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

interface OpenAIMessage {
    role: "system" | "user" | "assistant" | "function" | "tool"
    content: string
    name?: string
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
}

interface OpenAIChatResponse {
    id: string
    choices: Array<{
        index: number
        message: {
            role: string
            content: string
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
        }
        finish_reason?: string
    }>
    usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}
