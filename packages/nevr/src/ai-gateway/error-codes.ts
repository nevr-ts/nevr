// =============================================================================
// AI GATEWAY ERROR CODES
// Centralized error codes for the AI Gateway plugin
// =============================================================================

export const AI_GATEWAY_ERROR_CODES = {
    // Configuration errors
    PROVIDER_NOT_CONFIGURED: "PROVIDER_NOT_CONFIGURED",
    INVALID_API_KEY: "INVALID_API_KEY",
    MISSING_API_KEY: "MISSING_API_KEY",

    // Rate limit errors
    RATE_LIMIT_MINUTE: "RATE_LIMIT_MINUTE",
    RATE_LIMIT_DAY: "RATE_LIMIT_DAY",
    RATE_LIMIT_TOKENS: "RATE_LIMIT_TOKENS",

    // Model errors
    MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
    MODEL_NOT_ALLOWED: "MODEL_NOT_ALLOWED",
    PROVIDER_NOT_ALLOWED: "PROVIDER_NOT_ALLOWED",

    // Request errors
    INVALID_REQUEST: "INVALID_REQUEST",
    EMPTY_MESSAGES: "EMPTY_MESSAGES",
    INVALID_MESSAGE_FORMAT: "INVALID_MESSAGE_FORMAT",
    REQUEST_CANCELLED: "REQUEST_CANCELLED",

    // Provider errors
    PROVIDER_ERROR: "PROVIDER_ERROR",
    PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
    PROVIDER_RATE_LIMITED: "PROVIDER_RATE_LIMITED",
    PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",

    // Response errors
    CONTENT_FILTERED: "CONTENT_FILTERED",
    MAX_TOKENS_EXCEEDED: "MAX_TOKENS_EXCEEDED",

    // Internal errors
    ENGINE_NOT_INITIALIZED: "ENGINE_NOT_INITIALIZED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type AIGatewayErrorCode = typeof AI_GATEWAY_ERROR_CODES[keyof typeof AI_GATEWAY_ERROR_CODES]

// -----------------------------------------------------------------------------
// Error Messages
// -----------------------------------------------------------------------------

export const AI_GATEWAY_ERROR_MESSAGES: Record<AIGatewayErrorCode, string> = {
    [AI_GATEWAY_ERROR_CODES.PROVIDER_NOT_CONFIGURED]: "Provider is not configured",
    [AI_GATEWAY_ERROR_CODES.INVALID_API_KEY]: "Invalid API key for provider",
    [AI_GATEWAY_ERROR_CODES.MISSING_API_KEY]: "API key is missing for provider",

    [AI_GATEWAY_ERROR_CODES.RATE_LIMIT_MINUTE]: "Rate limit exceeded: too many requests per minute",
    [AI_GATEWAY_ERROR_CODES.RATE_LIMIT_DAY]: "Rate limit exceeded: too many requests per day",
    [AI_GATEWAY_ERROR_CODES.RATE_LIMIT_TOKENS]: "Token limit exceeded for this billing period",

    [AI_GATEWAY_ERROR_CODES.MODEL_NOT_FOUND]: "Model not found",
    [AI_GATEWAY_ERROR_CODES.MODEL_NOT_ALLOWED]: "Model not allowed for your plan",
    [AI_GATEWAY_ERROR_CODES.PROVIDER_NOT_ALLOWED]: "Provider not allowed for your plan",

    [AI_GATEWAY_ERROR_CODES.INVALID_REQUEST]: "Invalid request format",
    [AI_GATEWAY_ERROR_CODES.EMPTY_MESSAGES]: "Messages array cannot be empty",
    [AI_GATEWAY_ERROR_CODES.INVALID_MESSAGE_FORMAT]: "Invalid message format",
    [AI_GATEWAY_ERROR_CODES.REQUEST_CANCELLED]: "Request was cancelled",

    [AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR]: "Error from AI provider",
    [AI_GATEWAY_ERROR_CODES.PROVIDER_TIMEOUT]: "Request to AI provider timed out",
    [AI_GATEWAY_ERROR_CODES.PROVIDER_RATE_LIMITED]: "AI provider rate limit exceeded",
    [AI_GATEWAY_ERROR_CODES.PROVIDER_UNAVAILABLE]: "AI provider is temporarily unavailable",

    [AI_GATEWAY_ERROR_CODES.CONTENT_FILTERED]: "Content was filtered by safety settings",
    [AI_GATEWAY_ERROR_CODES.MAX_TOKENS_EXCEEDED]: "Maximum token limit exceeded",

    [AI_GATEWAY_ERROR_CODES.ENGINE_NOT_INITIALIZED]: "AI Gateway engine not initialized",
    [AI_GATEWAY_ERROR_CODES.INTERNAL_ERROR]: "Internal server error",
}

// -----------------------------------------------------------------------------
// Error Class
// -----------------------------------------------------------------------------

export class AIGatewayError extends Error {
    readonly code: AIGatewayErrorCode
    readonly statusCode: number
    readonly details?: Record<string, unknown>

    constructor(
        code: AIGatewayErrorCode,
        message?: string,
        statusCode?: number,
        details?: Record<string, unknown>
    ) {
        super(message || AI_GATEWAY_ERROR_MESSAGES[code])
        this.name = "AIGatewayError"
        this.code = code
        this.statusCode = statusCode || getStatusCodeForError(code)
        this.details = details
    }

    toJSON() {
        return {
            error: this.code,
            message: this.message,
            statusCode: this.statusCode,
            details: this.details,
        }
    }
}

// -----------------------------------------------------------------------------
// HTTP Status Code Mapping
// -----------------------------------------------------------------------------

function getStatusCodeForError(code: AIGatewayErrorCode): number {
    switch (code) {
        // 400 Bad Request
        case AI_GATEWAY_ERROR_CODES.INVALID_REQUEST:
        case AI_GATEWAY_ERROR_CODES.EMPTY_MESSAGES:
        case AI_GATEWAY_ERROR_CODES.INVALID_MESSAGE_FORMAT:
            return 400

        // 499 Client Closed Request (nginx convention for cancelled)
        case AI_GATEWAY_ERROR_CODES.REQUEST_CANCELLED:
            return 499

        // 401 Unauthorized
        case AI_GATEWAY_ERROR_CODES.INVALID_API_KEY:
        case AI_GATEWAY_ERROR_CODES.MISSING_API_KEY:
            return 401

        // 403 Forbidden
        case AI_GATEWAY_ERROR_CODES.MODEL_NOT_ALLOWED:
        case AI_GATEWAY_ERROR_CODES.PROVIDER_NOT_ALLOWED:
            return 403

        // 404 Not Found
        case AI_GATEWAY_ERROR_CODES.MODEL_NOT_FOUND:
        case AI_GATEWAY_ERROR_CODES.PROVIDER_NOT_CONFIGURED:
            return 404

        // 429 Too Many Requests
        case AI_GATEWAY_ERROR_CODES.RATE_LIMIT_MINUTE:
        case AI_GATEWAY_ERROR_CODES.RATE_LIMIT_DAY:
        case AI_GATEWAY_ERROR_CODES.RATE_LIMIT_TOKENS:
        case AI_GATEWAY_ERROR_CODES.PROVIDER_RATE_LIMITED:
            return 429

        // 502 Bad Gateway
        case AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR:
        case AI_GATEWAY_ERROR_CODES.PROVIDER_UNAVAILABLE:
            return 502

        // 504 Gateway Timeout
        case AI_GATEWAY_ERROR_CODES.PROVIDER_TIMEOUT:
            return 504

        // 500 Internal Server Error (default)
        default:
            return 500
    }
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

export function isRateLimitError(code: AIGatewayErrorCode): boolean {
    const rateLimitErrors: AIGatewayErrorCode[] = [
        AI_GATEWAY_ERROR_CODES.RATE_LIMIT_MINUTE,
        AI_GATEWAY_ERROR_CODES.RATE_LIMIT_DAY,
        AI_GATEWAY_ERROR_CODES.RATE_LIMIT_TOKENS,
    ]
    return rateLimitErrors.includes(code)
}

export function isProviderError(code: AIGatewayErrorCode): boolean {
    const providerErrors: AIGatewayErrorCode[] = [
        AI_GATEWAY_ERROR_CODES.PROVIDER_ERROR,
        AI_GATEWAY_ERROR_CODES.PROVIDER_TIMEOUT,
        AI_GATEWAY_ERROR_CODES.PROVIDER_RATE_LIMITED,
        AI_GATEWAY_ERROR_CODES.PROVIDER_UNAVAILABLE,
    ]
    return providerErrors.includes(code)
}

export function isRetryableError(code: AIGatewayErrorCode): boolean {
    const retryableErrors: AIGatewayErrorCode[] = [
        AI_GATEWAY_ERROR_CODES.PROVIDER_TIMEOUT,
        AI_GATEWAY_ERROR_CODES.PROVIDER_RATE_LIMITED,
        AI_GATEWAY_ERROR_CODES.PROVIDER_UNAVAILABLE,
    ]
    return retryableErrors.includes(code)
}
