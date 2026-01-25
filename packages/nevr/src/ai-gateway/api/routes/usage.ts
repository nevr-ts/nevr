// =============================================================================
// AI GATEWAY USAGE ROUTE
// Usage tracking and analytics endpoints
// =============================================================================

import { z } from "zod"
import type { AIGatewayRouteConfig } from "../types.js"
import { createAIGatewayAdapter } from "../internal-adapter.js"
import { AIGatewayError, AI_GATEWAY_ERROR_CODES } from "../../error-codes.js"
import { endpoint, EndpointError } from "../../../plugins/unified/endpoint.js"

// -----------------------------------------------------------------------------
// Query Schemas
// -----------------------------------------------------------------------------

const usageQuerySchema = z.object({
    period: z.enum(["day", "week", "month", "year"]).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    groupBy: z.enum(["model", "provider", "day"]).optional(),
})

const usageRecordsQuerySchema = z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    provider: z.enum(["openai", "anthropic", "google"]).optional(),
    model: z.string().optional(),
    limit: z.coerce.number().positive().max(100).optional(),
    offset: z.coerce.number().nonnegative().optional(),
})

// -----------------------------------------------------------------------------
// Get Usage Summary Endpoint
// -----------------------------------------------------------------------------

export function getUsage(config: AIGatewayRouteConfig) {
    const { options } = config

    return endpoint("/usage", {
        method: "GET",
        query: usageQuerySchema,
        meta: {
            summary: "Get usage summary",
            description: "Get token usage and cost summary for the current period",
            tags: ["AI Gateway"],
        },

        handler: async (ctx: any) => {
            const userId = ctx.user?.id
            if (!userId) {
                throw new AIGatewayError(
                    AI_GATEWAY_ERROR_CODES.INVALID_REQUEST,
                    "Authentication required"
                )
            }

            const query = ctx.query as z.infer<typeof usageQuerySchema>

            // Get reference ID
            const referenceId = options.getReference
                ? await options.getReference(userId, ctx.driver)
                : userId

            const adapter = createAIGatewayAdapter(ctx.driver)

            const usage = await adapter.getUsage(referenceId, {
                period: query.period,
                startDate: query.startDate ? new Date(query.startDate) : undefined,
                endDate: query.endDate ? new Date(query.endDate) : undefined,
                groupBy: query.groupBy,
            })

            // Add limit info based on plan
            if (options.limits && options.getPlan) {
                const plan = await options.getPlan(userId, ctx.driver)
                const planLimits = options.limits[plan]

                if (planLimits) {
                    usage.limit = planLimits.tokens
                    usage.remaining = planLimits.tokens === -1
                        ? -1
                        : Math.max(0, planLimits.tokens - usage.totalTokens)
                }
            }

            return { status: 200, body: usage }
        },
    })
}

// -----------------------------------------------------------------------------
// Get Usage Records Endpoint
// -----------------------------------------------------------------------------

export function getUsageRecords(config: AIGatewayRouteConfig) {
    const { options } = config

    return endpoint("/usage/records", {
        method: "GET",
        query: usageRecordsQuerySchema,
        meta: {
            summary: "Get usage records",
            description: "Get detailed usage records with pagination",
            tags: ["AI Gateway"],
        },

        handler: async (ctx: any) => {
            const userId = ctx.user?.id
            if (!userId) {
                throw new AIGatewayError(
                    AI_GATEWAY_ERROR_CODES.INVALID_REQUEST,
                    "Authentication required"
                )
            }

            const query = ctx.query as z.infer<typeof usageRecordsQuerySchema>

            // Get reference ID
            const referenceId = options.getReference
                ? await options.getReference(userId, ctx.driver)
                : userId

            const adapter = createAIGatewayAdapter(ctx.driver)

            const records = await adapter.getUsageRecords(referenceId, {
                startDate: query.startDate ? new Date(query.startDate) : undefined,
                endDate: query.endDate ? new Date(query.endDate) : undefined,
                provider: query.provider,
                model: query.model,
                limit: query.limit || 50,
                offset: query.offset || 0,
            })

            return {
                status: 200,
                body: {
                    records,
                    pagination: {
                        limit: query.limit || 50,
                        offset: query.offset || 0,
                        hasMore: records.length === (query.limit || 50),
                    },
                },
            }
        },
    })
}

// -----------------------------------------------------------------------------
// Get Rate Limit Status Endpoint
// -----------------------------------------------------------------------------

export function getRateLimitStatus(config: AIGatewayRouteConfig) {
    const { options } = config

    return endpoint("/usage/limits", {
        method: "GET",
        meta: {
            summary: "Get rate limit status",
            description: "Get current rate limit status and remaining quotas",
            tags: ["AI Gateway"],
        },

        handler: async (ctx: any) => {
            const userId = ctx.user?.id
            if (!userId) {
                throw new AIGatewayError(
                    AI_GATEWAY_ERROR_CODES.INVALID_REQUEST,
                    "Authentication required"
                )
            }

            // Get reference ID
            const referenceId = options.getReference
                ? await options.getReference(userId, ctx.driver)
                : userId

            const adapter = createAIGatewayAdapter(ctx.driver)

            // Get current state
            const state = await adapter.getRateLimitState(referenceId)

            // Get plan limits
            let limits = null
            let plan = "free"

            if (options.limits && options.getPlan) {
                plan = await options.getPlan(userId, ctx.driver)
                limits = options.limits[plan] || null
            }

            const now = Date.now()
            const oneMinute = 60 * 1000
            const oneDay = 24 * 60 * 60 * 1000
            const oneMonth = 30 * 24 * 60 * 60 * 1000

            // Calculate remaining based on window resets
            const minuteRemaining = limits?.requestsPerMinute
                ? state && now - state.minuteStart < oneMinute
                    ? limits.requestsPerMinute - state.minuteCount
                    : limits.requestsPerMinute
                : null

            const dayRemaining = limits?.requestsPerDay
                ? state && now - state.dayStart < oneDay
                    ? limits.requestsPerDay - state.dayCount
                    : limits.requestsPerDay
                : null

            const monthTokensRemaining = limits?.tokens !== undefined && limits.tokens !== -1
                ? state && now - state.monthStart < oneMonth
                    ? limits.tokens - state.monthTokens
                    : limits.tokens
                : null

            return {
                status: 200,
                body: {
                    plan,
                    limits: limits ? {
                        requestsPerMinute: limits.requestsPerMinute,
                        requestsPerDay: limits.requestsPerDay || null,
                        tokensPerMonth: limits.tokens,
                        allowedModels: limits.allowedModels || null,
                        allowedProviders: limits.allowedProviders || null,
                    } : null,
                    current: {
                        minuteRequests: state?.minuteCount || 0,
                        dayRequests: state?.dayCount || 0,
                        monthTokens: state?.monthTokens || 0,
                    },
                    remaining: {
                        minuteRequests: minuteRemaining !== null ? Math.max(0, minuteRemaining) : null,
                        dayRequests: dayRemaining !== null ? Math.max(0, dayRemaining) : null,
                        monthTokens: monthTokensRemaining !== null ? Math.max(0, monthTokensRemaining) : null,
                    },
                    resets: {
                        minute: state ? new Date(state.minuteStart + oneMinute).toISOString() : null,
                        day: state ? new Date(state.dayStart + oneDay).toISOString() : null,
                        month: state ? new Date(state.monthStart + oneMonth).toISOString() : null,
                    },
                },
            }
        },
    })
}
