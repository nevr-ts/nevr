// =============================================================================
// AI GATEWAY CHAT ROUTE
// Chat completion endpoint with streaming support
// =============================================================================

import { z } from "zod"
import type { AIGatewayRouteConfig } from "../types.js"
import type { ChatParams, ChatResponse, ChatChunk } from "../../types.js"
import { createAIGatewayAdapter, incrementRateLimits } from "../internal-adapter.js"
import { AIGatewayError, AI_GATEWAY_ERROR_CODES } from "../../error-codes.js"
import { endpoint, EndpointError } from "../../../plugins/unified/endpoint.js"

// -----------------------------------------------------------------------------
// Request Schema
// -----------------------------------------------------------------------------

const chatMessageSchema = z.object({
    role: z.enum(["system", "user", "assistant", "function", "tool"]),
    content: z.string(),
    name: z.string().optional(),
})

const chatRequestSchema = z.object({
    provider: z.enum(["openai", "anthropic", "google"]).optional(),
    model: z.string().optional(),
    messages: z.array(chatMessageSchema).min(1),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
    stop: z.array(z.string()).optional(),
    stream: z.boolean().optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

// -----------------------------------------------------------------------------
// Chat Endpoint
// -----------------------------------------------------------------------------

export function chat(config: AIGatewayRouteConfig) {
    const { options, getProvider } = config

    return endpoint("/chat", {
        method: "POST",
        body: chatRequestSchema,
        meta: {
            summary: "Chat completion",
            description: "Send a chat completion request to an AI provider",
            tags: ["AI Gateway"],
        },

        handler: async (ctx: any) => {
            const body = ctx.body as z.infer<typeof chatRequestSchema>
            const userId = ctx.user?.id

            // Get reference ID for tracking
            const referenceId = options.getReference
                ? await options.getReference(userId, ctx.driver)
                : userId

            if (!referenceId && options.trackUsage) {
                throw new AIGatewayError(
                    AI_GATEWAY_ERROR_CODES.INVALID_REQUEST,
                    "User must be authenticated for usage tracking"
                )
            }

            // Determine provider and model
            const providerType = body.provider || options.defaultProvider || "openai"
            const provider = getProvider(providerType)

            if (!provider) {
                throw new AIGatewayError(
                    AI_GATEWAY_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
                    `Provider "${providerType}" is not configured`
                )
            }

            // Check rate limits if tracking enabled
            if (options.trackUsage && referenceId && options.limits) {
                const plan = options.getPlan
                    ? await options.getPlan(userId, ctx.driver)
                    : "free"

                const planLimits = options.limits[plan]
                if (planLimits) {
                    // Check model/provider allowance
                    if (planLimits.allowedProviders?.length && !planLimits.allowedProviders.includes(providerType)) {
                        throw new AIGatewayError(
                            AI_GATEWAY_ERROR_CODES.PROVIDER_NOT_ALLOWED,
                            `Provider "${providerType}" is not allowed for your plan`
                        )
                    }

                    const model = body.model || provider.defaultModel
                    if (planLimits.allowedModels?.length && !planLimits.allowedModels.includes(model)) {
                        throw new AIGatewayError(
                            AI_GATEWAY_ERROR_CODES.MODEL_NOT_ALLOWED,
                            `Model "${model}" is not allowed for your plan`
                        )
                    }

                    const adapter = createAIGatewayAdapter(ctx.driver)
                    const rateLimitResult = await adapter.checkRateLimit(referenceId, planLimits)

                    if (!rateLimitResult.allowed) {
                        throw new AIGatewayError(
                            rateLimitResult.reason === "minute_limit"
                                ? AI_GATEWAY_ERROR_CODES.RATE_LIMIT_MINUTE
                                : rateLimitResult.reason === "day_limit"
                                    ? AI_GATEWAY_ERROR_CODES.RATE_LIMIT_DAY
                                    : AI_GATEWAY_ERROR_CODES.RATE_LIMIT_TOKENS,
                            `Rate limit exceeded: ${rateLimitResult.reason}`,
                            429,
                            {
                                limit: rateLimitResult.limit,
                                current: rateLimitResult.current,
                                resetAt: rateLimitResult.resetAt?.toISOString(),
                            }
                        )
                    }
                }
            }

            // Build chat params
            const chatParams: ChatParams = {
                provider: providerType,
                model: body.model,
                messages: body.messages,
                temperature: body.temperature,
                maxTokens: body.maxTokens,
                stop: body.stop,
                stream: body.stream,
                topP: body.topP,
                frequencyPenalty: body.frequencyPenalty,
                presencePenalty: body.presencePenalty,
                metadata: body.metadata,
            }

            // Apply before hook
            if (options.hooks?.beforeRequest) {
                const modified = await options.hooks.beforeRequest(chatParams, userId, referenceId)
                if (modified === null) {
                    throw new AIGatewayError(
                        AI_GATEWAY_ERROR_CODES.INVALID_REQUEST,
                        "Request blocked by beforeRequest hook"
                    )
                }
                Object.assign(chatParams, modified)
            }

            // Handle streaming
            if (body.stream) {
                return handleStreamingChat(ctx, config, provider, chatParams, referenceId, userId)
            }

            // Non-streaming request
            const response = await provider.chat(chatParams)

            // Track usage
            if (options.trackUsage && referenceId) {
                const adapter = createAIGatewayAdapter(ctx.driver)

                await adapter.recordUsage({
                    referenceId,
                    provider: response.provider,
                    model: response.model,
                    inputTokens: response.usage.inputTokens,
                    outputTokens: response.usage.outputTokens,
                    totalTokens: response.usage.totalTokens,
                    cost: response.usage.cost,
                    requestId: response.id,
                    metadata: body.metadata,
                })

                await incrementRateLimits(adapter, referenceId, response.usage.totalTokens)
            }

            // Apply after hook
            if (options.hooks?.afterRequest) {
                await options.hooks.afterRequest(response, chatParams, userId)
            }

            return { status: 200, body: response }
        },
    })
}

// -----------------------------------------------------------------------------
// Streaming Handler
// -----------------------------------------------------------------------------

async function handleStreamingChat(
    ctx: any,
    config: AIGatewayRouteConfig,
    provider: any,
    chatParams: ChatParams,
    referenceId: string | undefined,
    userId: string | undefined
) {
    const { options } = config

    // Set SSE headers
    ctx.setHeader("Content-Type", "text/event-stream")
    ctx.setHeader("Cache-Control", "no-cache")
    ctx.setHeader("Connection", "keep-alive")

    const stream = provider.chatStream(chatParams)
    let totalInputTokens = 0
    let totalOutputTokens = 0

    try {
        for await (const chunk of stream) {
            // Send chunk as SSE
            ctx.write(`data: ${JSON.stringify(chunk)}\n\n`)

            // Track final usage
            if (chunk.done && chunk.usage) {
                totalInputTokens = chunk.usage.inputTokens
                totalOutputTokens = chunk.usage.outputTokens

                // Record usage
                if (options.trackUsage && referenceId) {
                    const adapter = createAIGatewayAdapter(ctx.driver)

                    await adapter.recordUsage({
                        referenceId,
                        provider: chatParams.provider!,
                        model: chatParams.model || provider.defaultModel,
                        inputTokens: totalInputTokens,
                        outputTokens: totalOutputTokens,
                        totalTokens: chunk.usage.totalTokens,
                        cost: chunk.usage.cost,
                        requestId: chunk.id,
                        metadata: chatParams.metadata,
                    })

                    await incrementRateLimits(adapter, referenceId, chunk.usage.totalTokens)
                }
            }
        }

        // Send done event
        ctx.write("data: [DONE]\n\n")
        ctx.end()

    } catch (error) {
        // Send error event
        ctx.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
        ctx.end()
        throw error
    }

    return { status: 200, body: { streaming: true } as any }
}
