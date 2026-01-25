// =============================================================================
// AI GATEWAY INTERNAL ADAPTER
// Database abstraction layer for AI Gateway operations
// =============================================================================

import type { Driver } from "../../types.js"
import type {
    AIProviderType,
    UsageRecord,
    UsageSummary,
    UsageQueryOptions,
    RateLimitState,
    RateLimitResult,
    PlanLimits,
    TokenUsage,
} from "../types.js"
import { generateId } from "../../plugins/auth/crypto/index.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AIGatewayAdapter {
    // Usage operations
    recordUsage(data: RecordUsageInput): Promise<UsageRecord>
    getUsage(referenceId: string, options?: UsageQueryOptions): Promise<UsageSummary>
    getUsageRecords(referenceId: string, options?: GetUsageRecordsOptions): Promise<UsageRecord[]>

    // Rate limit operations
    getRateLimitState(referenceId: string): Promise<RateLimitState | null>
    updateRateLimitState(referenceId: string, state: Partial<RateLimitState>): Promise<RateLimitState>
    checkRateLimit(referenceId: string, limits: PlanLimits): Promise<RateLimitResult>

    // Cleanup
    deleteUsageRecords(referenceId: string): Promise<void>
    deleteRateLimitState(referenceId: string): Promise<void>
}

export interface RecordUsageInput {
    referenceId: string
    provider: AIProviderType
    model: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cost: number
    requestId?: string
    metadata?: Record<string, unknown>
}

export interface GetUsageRecordsOptions {
    startDate?: Date
    endDate?: Date
    provider?: AIProviderType
    model?: string
    limit?: number
    offset?: number
}

// -----------------------------------------------------------------------------
// Adapter Factory
// -----------------------------------------------------------------------------

export function createAIGatewayAdapter(driver: Driver): AIGatewayAdapter {
    return {
        /**
         * Record usage for an AI request
         */
        async recordUsage(data: RecordUsageInput): Promise<UsageRecord> {
            const record = await driver.create<UsageRecord>("aiUsage", {
                id: generateId(),
                ...data,
                createdAt: new Date(),
            })
            return record
        },

        /**
         * Get usage summary for a reference
         */
        async getUsage(referenceId: string, options: UsageQueryOptions = {}): Promise<UsageSummary> {
            const { period = "month", startDate, endDate, groupBy } = options

            // Calculate date range
            const now = new Date()
            let start: Date
            let end: Date = endDate || now

            if (startDate) {
                start = startDate
            } else {
                start = new Date(now)
                switch (period) {
                    case "day":
                        start.setHours(0, 0, 0, 0)
                        break
                    case "week":
                        start.setDate(start.getDate() - 7)
                        break
                    case "month":
                        start.setMonth(start.getMonth(), 1)
                        start.setHours(0, 0, 0, 0)
                        break
                    case "year":
                        start.setMonth(0, 1)
                        start.setHours(0, 0, 0, 0)
                        break
                }
            }

            // Fetch usage records
            const records = await driver.findMany<UsageRecord>("aiUsage", {
                where: {
                    referenceId,
                    createdAt: {
                        gte: start,
                        lte: end,
                    },
                },
            })

            // Calculate totals
            let totalTokens = 0
            let totalCost = 0

            // Group breakdown
            const breakdownMap = new Map<string, {
                provider: AIProviderType
                model: string
                tokens: number
                cost: number
                requests: number
            }>()

            for (const record of records) {
                totalTokens += record.totalTokens
                totalCost += record.cost

                const key = groupBy === "provider"
                    ? record.provider
                    : groupBy === "model"
                        ? `${record.provider}:${record.model}`
                        : groupBy === "day"
                            ? new Date(record.createdAt).toISOString().split("T")[0]
                            : `${record.provider}:${record.model}`

                const existing = breakdownMap.get(key)
                if (existing) {
                    existing.tokens += record.totalTokens
                    existing.cost += record.cost
                    existing.requests += 1
                } else {
                    breakdownMap.set(key, {
                        provider: record.provider,
                        model: record.model,
                        tokens: record.totalTokens,
                        cost: record.cost,
                        requests: 1,
                    })
                }
            }

            return {
                period: { start, end },
                totalTokens,
                totalCost: Math.round(totalCost * 1000000) / 1000000,
                limit: -1, // Will be set by caller based on plan
                remaining: -1, // Will be set by caller
                breakdown: Array.from(breakdownMap.values()),
            }
        },

        /**
         * Get raw usage records
         */
        async getUsageRecords(referenceId: string, options: GetUsageRecordsOptions = {}): Promise<UsageRecord[]> {
            const where: Record<string, unknown> = { referenceId }

            if (options.startDate || options.endDate) {
                where.createdAt = {}
                if (options.startDate) (where.createdAt as Record<string, unknown>).gte = options.startDate
                if (options.endDate) (where.createdAt as Record<string, unknown>).lte = options.endDate
            }

            if (options.provider) where.provider = options.provider
            if (options.model) where.model = options.model

            return driver.findMany<UsageRecord>("aiUsage", {
                where,
                orderBy: { createdAt: "desc" },
                take: options.limit,
                skip: options.offset,
            })
        },

        /**
         * Get rate limit state
         */
        async getRateLimitState(referenceId: string): Promise<RateLimitState | null> {
            const state = await driver.findOne<RateLimitState & { id: string }>("aiRateLimitState", {
                referenceId,
            })
            return state
        },

        /**
         * Update rate limit state
         */
        async updateRateLimitState(referenceId: string, state: Partial<RateLimitState>): Promise<RateLimitState> {
            const existing = await driver.findOne<RateLimitState & { id: string }>("aiRateLimitState", {
                referenceId,
            })

            if (existing) {
                const updated = await driver.update<RateLimitState & { id: string }>("aiRateLimitState", { id: existing.id }, {
                    ...state,
                    updatedAt: new Date(),
                })
                return updated!
            }

            // Create new state
            const created = await driver.create<RateLimitState & { id: string }>("aiRateLimitState", {
                id: generateId(),
                referenceId,
                minuteCount: 0,
                minuteStart: Date.now(),
                dayCount: 0,
                dayStart: Date.now(),
                monthTokens: 0,
                monthStart: Date.now(),
                ...state,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            return created
        },

        /**
         * Check rate limits and return result
         */
        async checkRateLimit(referenceId: string, limits: PlanLimits): Promise<RateLimitResult> {
            const now = Date.now()
            const oneMinute = 60 * 1000
            const oneDay = 24 * 60 * 60 * 1000
            const oneMonth = 30 * 24 * 60 * 60 * 1000

            let state = await this.getRateLimitState(referenceId)

            if (!state) {
                state = {
                    minuteCount: 0,
                    minuteStart: now,
                    dayCount: 0,
                    dayStart: now,
                    monthTokens: 0,
                    monthStart: now,
                }
            }

            // Reset windows if expired
            const updates: Partial<RateLimitState> = {}

            if (now - state.minuteStart > oneMinute) {
                updates.minuteCount = 0
                updates.minuteStart = now
                state.minuteCount = 0
            }

            if (now - state.dayStart > oneDay) {
                updates.dayCount = 0
                updates.dayStart = now
                state.dayCount = 0
            }

            if (now - state.monthStart > oneMonth) {
                updates.monthTokens = 0
                updates.monthStart = now
                state.monthTokens = 0
            }

            // Check minute limit
            if (limits.requestsPerMinute > 0 && state.minuteCount >= limits.requestsPerMinute) {
                return {
                    allowed: false,
                    reason: "minute_limit",
                    limit: limits.requestsPerMinute,
                    current: state.minuteCount,
                    resetAt: new Date(state.minuteStart + oneMinute),
                }
            }

            // Check day limit
            if (limits.requestsPerDay && limits.requestsPerDay > 0 && state.dayCount >= limits.requestsPerDay) {
                return {
                    allowed: false,
                    reason: "day_limit",
                    limit: limits.requestsPerDay,
                    current: state.dayCount,
                    resetAt: new Date(state.dayStart + oneDay),
                }
            }

            // Check token limit (-1 = unlimited)
            if (limits.tokens !== -1 && state.monthTokens >= limits.tokens) {
                return {
                    allowed: false,
                    reason: "token_limit",
                    limit: limits.tokens,
                    current: state.monthTokens,
                    resetAt: new Date(state.monthStart + oneMonth),
                }
            }

            // Update state if we have changes
            if (Object.keys(updates).length > 0) {
                await this.updateRateLimitState(referenceId, updates)
            }

            return { allowed: true }
        },

        /**
         * Delete usage records for a reference
         */
        async deleteUsageRecords(referenceId: string): Promise<void> {
            const records = await driver.findMany<{ id: string }>("aiUsage", {
                where: { referenceId },
            })

            for (const record of records) {
                await driver.delete("aiUsage", { id: record.id })
            }
        },

        /**
         * Delete rate limit state
         */
        async deleteRateLimitState(referenceId: string): Promise<void> {
            const state = await driver.findOne<{ id: string }>("aiRateLimitState", {
                referenceId,
            })

            if (state) {
                await driver.delete("aiRateLimitState", { id: state.id })
            }
        },
    }
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Increment rate limit counters after a request
 */
export async function incrementRateLimits(
    adapter: AIGatewayAdapter,
    referenceId: string,
    tokensUsed: number
): Promise<void> {
    const state = await adapter.getRateLimitState(referenceId)
    const now = Date.now()

    await adapter.updateRateLimitState(referenceId, {
        minuteCount: (state?.minuteCount || 0) + 1,
        dayCount: (state?.dayCount || 0) + 1,
        monthTokens: (state?.monthTokens || 0) + tokensUsed,
    })
}
