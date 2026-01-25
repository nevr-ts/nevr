// =============================================================================
// ANTHROPIC PROVIDER
// Anthropic Claude API implementation
// =============================================================================

import type {
    AIProviderType,
    AnthropicConfig,
    ChatParams,
    ChatResponse,
    ChatChunk,
    ChatMessage,
} from "../types.js"
import { BaseAIProvider, DEFAULT_MODELS, calculateCost } from "./types.js"
import { AIGatewayError, AI_GATEWAY_ERROR_CODES } from "../error-codes.js"

// -----------------------------------------------------------------------------
// Anthropic Provider
// -----------------------------------------------------------------------------

export class AnthropicProvider extends BaseAIProvider {
    readonly name: AIProviderType = "anthropic"
    readonly defaultModel = "claude-sonnet-4-5-20250929"

    private version: string

    constructor(config: AnthropicConfig) {
        super(config)
        this.version = config.version || "2024-10-22"

        // Register available models
        Object.values(DEFAULT_MODELS.anthropic || {}).forEach((model) => {
            this.registerModel(model)
        })
    }

    get models(): string[] {
        return Object.keys(DEFAULT_MODELS.anthropic || {})
    }

    /**
     * Chat completion
     */
    async chat(params: ChatParams): Promise<ChatResponse> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://api.anthropic.com/v1"

        const body = this.buildRequestBody(params, model)

        try {
            const response = await fetch(`${baseUrl}/messages`, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(this.getTimeout()),
            })

            if (!response.ok) {
                await this.handleErrorResponse(response)
            }

            const data = await response.json() as AnthropicChatResponse

            const inputTokens = data.usage?.input_tokens || 0
            const outputTokens = data.usage?.output_tokens || 0
            const totalTokens = inputTokens + outputTokens
            const cost = calculateCost("anthropic", model, inputTokens, outputTokens)

            // Extract text content
            const content = data.content
                .filter((block): block is { type: "text"; text: string } => block.type === "text")
                .map((block) => block.text)
                .join("")

            return {
                id: requestId,
                provider: "anthropic",
                model,
                content,
                finishReason: this.mapStopReason(data.stop_reason),
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
                `Anthropic error: ${(error as Error).message}`
            )
        }
    }

    /**
     * Streaming chat completion
     */
    async *chatStream(params: ChatParams): AsyncGenerator<ChatChunk, void, unknown> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://api.anthropic.com/v1"

        const body = this.buildRequestBody(params, model)
        body.stream = true

        try {
            const response = await fetch(`${baseUrl}/messages`, {
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
            let inputTokens = 0
            let outputTokens = 0

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
                    if (!data || data === "[DONE]") continue

                    try {
                        const event = JSON.parse(data) as AnthropicStreamEvent

                        switch (event.type) {
                            case "message_start":
                                inputTokens = event.message?.usage?.input_tokens || 0
                                break

                            case "content_block_delta":
                                if (event.delta?.type === "text_delta" && event.delta.text) {
                                    yield {
                                        id: requestId,
                                        content: event.delta.text,
                                        done: false,
                                    }
                                }
                                break

                            case "message_delta":
                                outputTokens = event.usage?.output_tokens || 0
                                if (event.delta?.stop_reason) {
                                    yield {
                                        id: requestId,
                                        content: "",
                                        done: true,
                                        finishReason: this.mapStopReason(event.delta.stop_reason),
                                        usage: {
                                            inputTokens,
                                            outputTokens,
                                            totalTokens: inputTokens + outputTokens,
                                            cost: calculateCost("anthropic", model, inputTokens, outputTokens),
                                        },
                                    }
                                }
                                break

                            case "message_stop":
                                yield {
                                    id: requestId,
                                    content: "",
                                    done: true,
                                    usage: {
                                        inputTokens,
                                        outputTokens,
                                        totalTokens: inputTokens + outputTokens,
                                        cost: calculateCost("anthropic", model, inputTokens, outputTokens),
                                    },
                                }
                                return
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
                `Anthropic streaming error: ${(error as Error).message}`
            )
        }
    }

    /**
     * Count tokens (rough approximation for Claude)
     */
    countTokens(text: string, _model?: string): number {
        // Claude uses ~3.5 characters per token on average
        return Math.ceil(text.length / 3.5)
    }

    // -------------------------------------------------------------------------
    // Private Methods
    // -------------------------------------------------------------------------

    private buildHeaders(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            "x-api-key": this.getApiKey(),
            "anthropic-version": this.version,
        }
    }

    private buildRequestBody(params: ChatParams, model: string): AnthropicRequestBody {
        // Separate system message from conversation
        const systemMessages = params.messages.filter((m) => m.role === "system")
        const conversationMessages = params.messages.filter((m) => m.role !== "system")

        const body: AnthropicRequestBody = {
            model,
            messages: conversationMessages.map(this.mapMessage),
            max_tokens: params.maxTokens || 4096,
        }

        // Add system prompt if present
        if (systemMessages.length > 0) {
            body.system = systemMessages.map((m) => m.content).join("\n\n")
        }

        if (params.temperature !== undefined) body.temperature = params.temperature
        if (params.topP !== undefined) body.top_p = params.topP
        if (params.stop) body.stop_sequences = params.stop

        return body
    }

    private mapMessage(message: ChatMessage): AnthropicMessage {
        // Map roles (Anthropic only supports user/assistant)
        const role = message.role === "user" ? "user" : "assistant"

        return {
            role,
            content: message.content,
        }
    }

    private mapStopReason(reason?: string): ChatResponse["finishReason"] {
        switch (reason) {
            case "end_turn":
            case "stop_sequence":
                return "stop"
            case "max_tokens":
                return "length"
            case "tool_use":
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
        if (response.status === 529) {
            throw new AIGatewayError(AI_GATEWAY_ERROR_CODES.PROVIDER_UNAVAILABLE, errorMessage)
        }

        throw new AIGatewayError(AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR, errorMessage)
    }
}

// -----------------------------------------------------------------------------
// Anthropic API Types
// -----------------------------------------------------------------------------

interface AnthropicMessage {
    role: "user" | "assistant"
    content: string
}

interface AnthropicRequestBody {
    model: string
    messages: AnthropicMessage[]
    max_tokens: number
    system?: string
    temperature?: number
    top_p?: number
    stop_sequences?: string[]
    stream?: boolean
}

interface AnthropicChatResponse {
    id: string
    type: "message"
    role: "assistant"
    content: Array<{
        type: "text" | "tool_use"
        text?: string
    }>
    stop_reason: string
    usage: {
        input_tokens: number
        output_tokens: number
    }
}

interface AnthropicStreamEvent {
    type: "message_start" | "content_block_start" | "content_block_delta" | "content_block_stop" | "message_delta" | "message_stop"
    message?: {
        usage?: {
            input_tokens: number
        }
    }
    delta?: {
        type?: "text_delta"
        text?: string
        stop_reason?: string
    }
    usage?: {
        output_tokens: number
    }
}
