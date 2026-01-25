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
     * Chat completion
     */
    async chat(params: ChatParams): Promise<ChatResponse> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://generativelanguage.googleapis.com/v1beta"

        const body = this.buildRequestBody(params)

        try {
            const response = await fetch(
                `${baseUrl}/models/${model}:generateContent?key=${this.getApiKey()}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(this.getTimeout()),
                }
            )

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
            }
        } catch (error) {
            if (error instanceof AIGatewayError) throw error
            throw new AIGatewayError(
                AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR,
                `Google AI error: ${(error as Error).message}`
            )
        }
    }

    /**
     * Streaming chat completion
     */
    async *chatStream(params: ChatParams): AsyncGenerator<ChatChunk, void, unknown> {
        const model = this.getResolvedModel(params)
        const requestId = this.generateRequestId()
        const baseUrl = this.getBaseUrl() || "https://generativelanguage.googleapis.com/v1beta"

        const body = this.buildRequestBody(params)

        try {
            const response = await fetch(
                `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.getApiKey()}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(this.getTimeout()),
                }
            )

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
            }
        } catch (error) {
            if (error instanceof AIGatewayError) throw error
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

        return body
    }

    private buildContents(messages: ChatMessage[]): GoogleContent[] {
        const contents: GoogleContent[] = []
        let systemInstruction: string | undefined

        for (const message of messages) {
            if (message.role === "system") {
                // Accumulate system messages
                systemInstruction = systemInstruction
                    ? `${systemInstruction}\n\n${message.content}`
                    : message.content
                continue
            }

            // Map role
            const role = message.role === "assistant" ? "model" : "user"

            contents.push({
                role,
                parts: [{ text: message.content }],
            })
        }

        // Prepend system instruction as first user message if present
        if (systemInstruction && contents.length > 0) {
            // For Gemini, we prepend system instruction to first user message
            if (contents[0].role === "user") {
                contents[0].parts.unshift({
                    text: `System Instructions:\n${systemInstruction}\n\n`,
                })
            }
        }

        return contents
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

interface GoogleContent {
    role: "user" | "model"
    parts: Array<{ text: string }>
}

interface GoogleGenerationConfig {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    stopSequences?: string[]
}

interface GoogleRequestBody {
    contents: GoogleContent[]
    generationConfig?: GoogleGenerationConfig
    safetySettings?: Array<{
        category: string
        threshold: string
    }>
}

interface GoogleChatResponse {
    candidates?: Array<{
        content: {
            parts: Array<{ text?: string }>
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
            parts: Array<{ text?: string }>
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
