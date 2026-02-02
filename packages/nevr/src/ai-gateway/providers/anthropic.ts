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
    ToolDefinition,
    ToolCall,
    MessageContent,
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
     * Chat completion with abort signal, tools, and vision support
     */
    async chat(params: ChatParams, signal?: AbortSignal): Promise<ChatResponse> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://api.anthropic.com/v1"

        const body = this.buildRequestBody(params, model)

        // Create combined abort signal (user signal + timeout)
        const timeoutController = new AbortController()
        const timeout = setTimeout(() => timeoutController.abort(), this.getTimeout())

        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutController.signal])
            : timeoutController.signal

        try {
            const response = await fetch(`${baseUrl}/messages`, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
                signal: combinedSignal,
            })

            clearTimeout(timeout)

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

            // Extract tool calls
            const toolCalls = data.content
                .filter((block): block is AnthropicToolUseBlock => block.type === "tool_use")
                .map((block): ToolCall => ({
                    id: block.id,
                    type: "function",
                    function: {
                        name: block.name,
                        arguments: JSON.stringify(block.input),
                    },
                }))

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
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
                `Anthropic error: ${(error as Error).message}`
            )
        }
    }

    /**
     * Streaming chat completion with abort signal and tools support
     */
    async *chatStream(params: ChatParams, signal?: AbortSignal): AsyncGenerator<ChatChunk, void, unknown> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://api.anthropic.com/v1"

        const body = this.buildRequestBody(params, model)
        body.stream = true

        // Create combined abort signal (user signal + timeout)
        const timeoutController = new AbortController()
        const timeout = setTimeout(() => timeoutController.abort(), this.getTimeout())

        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutController.signal])
            : timeoutController.signal

        try {
            const response = await fetch(`${baseUrl}/messages`, {
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
            let inputTokens = 0
            let outputTokens = 0
            // Track tool calls
            const toolCallsMap = new Map<number, { id: string; name: string; input: string }>()
            let currentToolIndex = -1

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

                            case "content_block_start":
                                if (event.content_block?.type === "tool_use") {
                                    currentToolIndex++
                                    toolCallsMap.set(currentToolIndex, {
                                        id: event.content_block.id || "",
                                        name: event.content_block.name || "",
                                        input: "",
                                    })
                                }
                                break

                            case "content_block_delta":
                                if (event.delta?.type === "text_delta" && event.delta.text) {
                                    yield {
                                        id: requestId,
                                        content: event.delta.text,
                                        done: false,
                                    }
                                } else if (event.delta?.type === "input_json_delta" && event.delta.partial_json) {
                                    const tool = toolCallsMap.get(currentToolIndex)
                                    if (tool) {
                                        tool.input += event.delta.partial_json
                                    }
                                }
                                break

                            case "message_delta":
                                outputTokens = event.usage?.output_tokens || 0
                                if (event.delta?.stop_reason) {
                                    const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map(tc => ({
                                        id: tc.id,
                                        type: "function" as const,
                                        function: { name: tc.name, arguments: tc.input },
                                    }))

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
                                        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                                    }
                                }
                                break

                            case "message_stop":
                                const finalToolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map(tc => ({
                                    id: tc.id,
                                    type: "function" as const,
                                    function: { name: tc.name, arguments: tc.input },
                                }))

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
                                    toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
                                }
                                return
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
            messages: conversationMessages.map((m) => this.mapMessage(m)),
            max_tokens: params.maxTokens || 4096,
        }

        // Add system prompt if present
        if (systemMessages.length > 0) {
            body.system = systemMessages.map((m) =>
                typeof m.content === "string" ? m.content : this.extractTextContent(m.content)
            ).join("\n\n")
        }

        if (params.temperature !== undefined) body.temperature = params.temperature
        if (params.topP !== undefined) body.top_p = params.topP
        if (params.stop) body.stop_sequences = params.stop

        // Add tools if provided
        if (params.tools && params.tools.length > 0) {
            body.tools = params.tools.map((t) => ({
                name: t.function.name,
                description: t.function.description,
                input_schema: t.function.parameters || { type: "object", properties: {} },
            }))
        }

        // Add tool choice if provided
        if (params.toolChoice) {
            if (params.toolChoice === "auto") {
                body.tool_choice = { type: "auto" }
            } else if (params.toolChoice === "none") {
                // Anthropic doesn't have "none", just don't include tools
            } else if (params.toolChoice === "required") {
                body.tool_choice = { type: "any" }
            } else if (typeof params.toolChoice === "object") {
                body.tool_choice = { type: "tool", name: params.toolChoice.function.name }
            }
        }

        return body
    }

    private extractTextContent(content: MessageContent): string {
        if (typeof content === "string") return content
        return content
            .filter((part) => part.type === "text")
            .map((part) => (part as { type: "text"; text: string }).text)
            .join("")
    }

    private mapMessage(message: ChatMessage): AnthropicMessage {
        // Map roles (Anthropic only supports user/assistant)
        const role = message.role === "user" || message.role === "tool" ? "user" : "assistant"

        // Handle tool response messages
        if (message.role === "tool" && message.toolCallId) {
            return {
                role: "user",
                content: [{
                    type: "tool_result",
                    tool_use_id: message.toolCallId,
                    content: typeof message.content === "string" ? message.content : this.extractTextContent(message.content),
                }],
            }
        }

        // Handle assistant messages with tool calls
        if (message.role === "assistant" && message.toolCalls) {
            const content: AnthropicContentBlock[] = []

            // Add text if present
            if (message.content) {
                const text = typeof message.content === "string" ? message.content : this.extractTextContent(message.content)
                if (text) {
                    content.push({ type: "text", text })
                }
            }

            // Add tool calls
            for (const tc of message.toolCalls) {
                content.push({
                    type: "tool_use",
                    id: tc.id,
                    name: tc.function.name,
                    input: JSON.parse(tc.function.arguments || "{}"),
                })
            }

            return { role: "assistant", content }
        }

        // Handle multimodal content
        if (typeof message.content !== "string") {
            const content: AnthropicContentBlock[] = message.content.map((part) => {
                if (part.type === "text") {
                    return { type: "text" as const, text: part.text }
                } else if (part.type === "image") {
                    // Anthropic expects base64 directly or URL
                    const isUrl = part.image.startsWith("http://") || part.image.startsWith("https://")
                    if (isUrl) {
                        return {
                            type: "image" as const,
                            source: {
                                type: "url" as const,
                                url: part.image,
                            },
                        }
                    }
                    return {
                        type: "image" as const,
                        source: {
                            type: "base64" as const,
                            media_type: (part.mimeType || "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
                            data: part.image,
                        },
                    }
                }
                return { type: "text" as const, text: "" }
            })
            return { role, content }
        }

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

type AnthropicContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } | { type: "url"; url: string } }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    | { type: "tool_result"; tool_use_id: string; content: string }

interface AnthropicMessage {
    role: "user" | "assistant"
    content: string | AnthropicContentBlock[]
}

interface AnthropicTool {
    name: string
    description?: string
    input_schema: Record<string, unknown>
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
    tools?: AnthropicTool[]
    tool_choice?: { type: "auto" } | { type: "any" } | { type: "tool"; name: string }
}

interface AnthropicToolUseBlock {
    type: "tool_use"
    id: string
    name: string
    input: Record<string, unknown>
}

interface AnthropicChatResponse {
    id: string
    type: "message"
    role: "assistant"
    content: Array<{
        type: "text" | "tool_use"
        text?: string
        id?: string
        name?: string
        input?: Record<string, unknown>
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
    content_block?: {
        type?: "text" | "tool_use"
        id?: string
        name?: string
    }
    delta?: {
        type?: "text_delta" | "input_json_delta"
        text?: string
        partial_json?: string
        stop_reason?: string
    }
    usage?: {
        output_tokens: number
    }
}
