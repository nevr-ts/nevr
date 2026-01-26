// =============================================================================
// AI GATEWAY SCHEMA
// Entity definitions for usage tracking
// =============================================================================

import { string, int, float, json, datetime } from "../index.js"
import type { PluginSchema } from "../plugins/unified/types.js"

// -----------------------------------------------------------------------------
// Schema Export
// -----------------------------------------------------------------------------

/**
 * Get the AI Gateway plugin schema
 *
 * Provides entities for:
 * - aiUsage: Tracks all AI requests for billing and analytics
 * - aiRateLimitState: Tracks rate limit state per reference
 *
 * @returns Plugin schema with entities
 */
export function getAIGatewaySchema(): PluginSchema {
    return {
        entities: {
            aiUsage: {
                description: "AI usage record for billing and analytics",
                internal: true,
                fields: {
                    /** Reference ID (userId, orgId, or custom) */
                    referenceId: string.label("Reference ID"),

                    /** Provider used (openai, anthropic, google) */
                    provider: string.label("Provider"),

                    /** Model used (gpt-4, claude-3-opus, etc.) */
                    model: string.label("Model"),

                    /** Input/prompt tokens */
                    inputTokens: int.label("Input Tokens"),

                    /** Output/completion tokens */
                    outputTokens: int.label("Output Tokens"),

                    /** Total tokens (input + output) */
                    totalTokens: int.label("Total Tokens"),

                    /** Calculated cost in USD */
                    cost: float.label("Cost (USD)"),

                    /** Optional request ID for tracing */
                    requestId: string.optional().label("Request ID"),

                    /** Optional metadata for custom tracking */
                    metadata: json.optional().label("Metadata"),
                },
            },

            aiRateLimitState: {
                description: "Rate limit state per reference",
                internal: true,
                fields: {
                    /** Reference ID (userId, orgId, or custom) */
                    referenceId: string.label("Reference ID"),

                    /** Current minute request count */
                    minuteCount: int.default(0).label("Minute Count"),

                    /** Minute window start timestamp */
                    minuteStart: int.default(0).label("Minute Start"),

                    /** Current day request count */
                    dayCount: int.default(0).label("Day Count"),

                    /** Day window start timestamp */
                    dayStart: int.default(0).label("Day Start"),

                    /** Current month token count */
                    monthTokens: int.default(0).label("Month Tokens"),

                    /** Month window start timestamp */
                    monthStart: int.default(0).label("Month Start"),
                },
            },
        },
    }
}

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export const aiGatewaySchema = getAIGatewaySchema()
export default getAIGatewaySchema
