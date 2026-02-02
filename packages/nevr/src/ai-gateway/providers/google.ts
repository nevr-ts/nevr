// =============================================================================
// GOOGLE AI PROVIDER
// Google Generative AI (Gemini) API implementation
// =============================================================================

import type {
    AIProviderType,
    GoogleConfig,
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
// Google AI Provider
// -----------------------------------------------------------------------------

export class GoogleProvider extends BaseAIProvider {
    readonly name: AIProviderType = "google"
    readonly defaultModel = "gemini-2.5-flash"

    constructor(config: GoogleConfig) {
        super(config)

        // Register available models
        Object.values(DEFAULT_MODELS.google || {}).forEach((model) => {
            this.registerModel(model)
        })
    }

    get models(): string[] {
        return Object.keys(DEFAULT_MODELS.google || {})
    }

    /**
     * Chat completion with abort signal, tools, and vision support
     */
    async chat(params: ChatParams, signal?: AbortSignal): Promise<ChatResponse> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://generativelanguage.googleapis.com/v1beta"

        const body = this.buildRequestBody(params)

        // Create combined abort signal (user signal + timeout)
        const timeoutController = new AbortController()
        const timeout = setTimeout(() => timeoutController.abort(), this.getTimeout())

        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutController.signal])
            : timeoutController.signal

        try {
            const response = await fetch(
                `${baseUrl}/models/${model}:generateContent?key=${this.getApiKey()}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: combinedSignal,
                }
            )

            clearTimeout(timeout)

            if (!response.ok) {
                await this.handleErrorResponse(response)
            }

            const data = await response.json() as GoogleChatResponse

            const inputTokens = data.usageMetadata?.promptTokenCount || 0
            const outputTokens = data.usageMetadata?.candidatesTokenCount || 0
            const totalTokens = inputTokens + outputTokens
            const cost = calculateCost("google", model, inputTokens, outputTokens)

            // Extract text content
            const content = data.candidates?.[0]?.content?.parts
                ?.filter((part): part is { text: string } => "text" in part)
                ?.map((part) => part.text)
                ?.join("") || ""

            // Extract tool calls
            const toolCalls = data.candidates?.[0]?.content?.parts
                ?.filter((part): part is GoogleFunctionCallPart => "functionCall" in part)
                ?.map((part, index): ToolCall => ({
                    id: `call_${requestId}_${index}`,
                    type: "function",
                    function: {
                        name: part.functionCall.name,
                        arguments: JSON.stringify(part.functionCall.args || {}),
                    },
                }))

            return {
                id: requestId,
                provider: "google",
                model,
                content,
                finishReason: this.mapFinishReason(data.candidates?.[0]?.finishReason),
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    cost,
                },
                toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
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
                `Google AI error: ${(error as Error).message}`
            )
        }
    }

    /**
     * Streaming chat completion with abort signal and tools support
     */
    async *chatStream(params: ChatParams, signal?: AbortSignal): AsyncGenerator<ChatChunk, void, unknown> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://generativelanguage.googleapis.com/v1beta"

        const body = this.buildRequestBody(params)

        // Create combined abort signal (user signal + timeout)
        const timeoutController = new AbortController()
        const timeout = setTimeout(() => timeoutController.abort(), this.getTimeout())

        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutController.signal])
            : timeoutController.signal

        try {
            const response = await fetch(
                `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.getApiKey()}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: combinedSignal,
                }
            )

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
            let lastFinishReason: ChatResponse["finishReason"] = null
            const accumulatedToolCalls: ToolCall[] = []

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
                        const chunk = JSON.parse(data) as GoogleStreamChunk

                        // Update usage
                        if (chunk.usageMetadata) {
                            totalInputTokens = chunk.usageMetadata.promptTokenCount || 0
                            totalOutputTokens = chunk.usageMetadata.candidatesTokenCount || 0
                        }

                        // Extract content
                        const content = chunk.candidates?.[0]?.content?.parts
                            ?.filter((part): part is { text: string } => "text" in part)
                            ?.map((part) => part.text)
                            ?.join("") || ""

                        // Extract tool calls
                        const toolCalls = chunk.candidates?.[0]?.content?.parts
                            ?.filter((part): part is GoogleFunctionCallPart => "functionCall" in part)
                            ?.map((part, index): ToolCall => ({
                                id: `call_${requestId}_${accumulatedToolCalls.length + index}`,
                                type: "function",
                                function: {
                                    name: part.functionCall.name,
                                    arguments: JSON.stringify(part.functionCall.args || {}),
                                },
                            }))

                        if (toolCalls && toolCalls.length > 0) {
                            accumulatedToolCalls.push(...toolCalls)
                        }

                        if (content) {
                            yield {
                                id: requestId,
                                content,
                                done: false,
                            }
                        }

                        // Check for finish reason
                        const finishReason = chunk.candidates?.[0]?.finishReason
                        if (finishReason) {
                            lastFinishReason = this.mapFinishReason(finishReason)
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }

            // Final chunk with usage
            yield {
                id: requestId,
                content: "",
                done: true,
                finishReason: lastFinishReason,
                usage: {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens,
                    cost: calculateCost("google", model, totalInputTokens, totalOutputTokens),
                },
                toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
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
                `Google AI streaming error: ${(error as Error).message}`
            )
        }
    }

    /**
     * Count tokens (rough approximation for Gemini)
     */
    countTokens(text: string, _model?: string): number {
        // Gemini uses ~4 characters per token on average
        return Math.ceil(text.length / 4)
    }

    // -------------------------------------------------------------------------
    // Private Methods
    // -------------------------------------------------------------------------

    private buildRequestBody(params: ChatParams): GoogleRequestBody {
        const contents = this.buildContents(params.messages)

        const body: GoogleRequestBody = {
            contents,
        }

        // Add generation config
        const generationConfig: GoogleGenerationConfig = {}

        if (params.temperature !== undefined) generationConfig.temperature = params.temperature
        if (params.maxTokens !== undefined) generationConfig.maxOutputTokens = params.maxTokens
        if (params.topP !== undefined) generationConfig.topP = params.topP
        if (params.stop) generationConfig.stopSequences = params.stop

        if (Object.keys(generationConfig).length > 0) {
            body.generationConfig = generationConfig
        }

        // Add tools if provided
        if (params.tools && params.tools.length > 0) {
            body.tools = [{
                functionDeclarations: params.tools.map((t) => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters,
                })),
            }]
        }

        // Add tool config if needed
        if (params.toolChoice) {
            if (params.toolChoice === "auto") {
                body.toolConfig = { functionCallingConfig: { mode: "AUTO" } }
            } else if (params.toolChoice === "none") {
                body.toolConfig = { functionCallingConfig: { mode: "NONE" } }
            } else if (params.toolChoice === "required") {
                body.toolConfig = { functionCallingConfig: { mode: "ANY" } }
            } else if (typeof params.toolChoice === "object") {
                body.toolConfig = {
                    functionCallingConfig: {
                        mode: "ANY",
                        allowedFunctionNames: [params.toolChoice.function.name],
                    },
                }
            }
        }

        return body
    }

    private buildContents(messages: ChatMessage[]): GoogleContent[] {
        const contents: GoogleContent[] = []
        let systemInstruction: string | undefined

        for (const message of messages) {
            if (message.role === "system") {
                // Accumulate system messages
                const text = typeof message.content === "string"
                    ? message.content
                    : this.extractTextContent(message.content)
                systemInstruction = systemInstruction
                    ? `${systemInstruction}\n\n${text}`
                    : text
                continue
            }

            // Handle tool response messages
            if (message.role === "tool" && message.toolCallId) {
                contents.push({
                    role: "user",
                    parts: [{
                        functionResponse: {
                            name: message.name || "function",
                            response: {
                                result: typeof message.content === "string"
                                    ? message.content
                                    : this.extractTextContent(message.content),
                            },
                        },
                    }],
                })
                continue
            }

            // Map role
            const role = message.role === "assistant" ? "model" : "user"

            // Build parts
            const parts: GooglePart[] = []

            // Handle multimodal content
            if (typeof message.content === "string") {
                parts.push({ text: message.content })
            } else {
                for (const part of message.content) {
                    if (part.type === "text") {
                        parts.push({ text: part.text })
                    } else if (part.type === "image") {
                        const isUrl = part.image.startsWith("http://") || part.image.startsWith("https://")
                        if (isUrl) {
                            // Google prefers file URI or inline data
                            parts.push({
                                fileData: {
                                    mimeType: part.mimeType || "image/png",
                                    fileUri: part.image,
                                },
                            })
                        } else {
                            parts.push({
                                inlineData: {
                                    mimeType: part.mimeType || "image/png",
                                    data: part.image,
                                },
                            })
                        }
                    }
                }
            }

            // Add tool calls if present (for assistant messages)
            if (message.role === "assistant" && message.toolCalls) {
                for (const tc of message.toolCalls) {
                    parts.push({
                        functionCall: {
                            name: tc.function.name,
                            args: JSON.parse(tc.function.arguments || "{}"),
                        },
                    })
                }
            }

            contents.push({ role, parts })
        }

        // Prepend system instruction as first user message if present
        if (systemInstruction && contents.length > 0) {
            // For Gemini, we prepend system instruction to first user message
            if (contents[0].role === "user" && contents[0].parts[0] && "text" in contents[0].parts[0]) {
                contents[0].parts.unshift({
                    text: `System Instructions:\n${systemInstruction}\n\n`,
                })
            }
        }

        return contents
    }

    private extractTextContent(content: MessageContent): string {
        if (typeof content === "string") return content
        return content
            .filter((part) => part.type === "text")
            .map((part) => (part as { type: "text"; text: string }).text)
            .join("")
    }

    private mapFinishReason(reason?: string): ChatResponse["finishReason"] {
        switch (reason) {
            case "STOP":
                return "stop"
            case "MAX_TOKENS":
                return "length"
            case "SAFETY":
            case "RECITATION":
            case "OTHER":
                return "content_filter"
            case "TOOL_CODE":
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

        if (response.status === 400 && errorMessage.includes("API key")) {
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
// Google AI API Types
// -----------------------------------------------------------------------------

type GooglePart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
    | { fileData: { mimeType: string; fileUri: string } }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: { result: string } } }

interface GoogleFunctionCallPart {
    functionCall: {
        name: string
        args?: Record<string, unknown>
    }
}

interface GoogleContent {
    role: "user" | "model"
    parts: GooglePart[]
}

interface GoogleGenerationConfig {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    stopSequences?: string[]
}

interface GoogleFunctionDeclaration {
    name: string
    description?: string
    parameters?: Record<string, unknown>
}

interface GoogleRequestBody {
    contents: GoogleContent[]
    generationConfig?: GoogleGenerationConfig
    safetySettings?: Array<{
        category: string
        threshold: string
    }>
    tools?: Array<{
        functionDeclarations: GoogleFunctionDeclaration[]
    }>
    toolConfig?: {
        functionCallingConfig: {
            mode: "AUTO" | "NONE" | "ANY"
            allowedFunctionNames?: string[]
        }
    }
}

interface GoogleChatResponse {
    candidates?: Array<{
        content: {
            parts: Array<{ text?: string } | GoogleFunctionCallPart>
            role: string
        }
        finishReason?: string
    }>
    usageMetadata?: {
        promptTokenCount: number
        candidatesTokenCount: number
        totalTokenCount: number
    }
}

interface GoogleStreamChunk {
    candidates?: Array<{
        content: {
            parts: Array<{ text?: string } | GoogleFunctionCallPart>
            role: string
        }
        finishReason?: string
    }>
    usageMetadata?: {
        promptTokenCount: number
        candidatesTokenCount: number
        totalTokenCount: number
    }
}
