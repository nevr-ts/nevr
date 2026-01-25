// =============================================================================
// RAG ERROR CODES
// Standardized error codes for RAG operations
// =============================================================================

/**
 * RAG error codes
 */
export const RAG_ERROR_CODES = {
    /** RAG engine not initialized */
    ENGINE_NOT_INITIALIZED: "ENGINE_NOT_INITIALIZED",
    /** Entity not found in registry */
    ENTITY_NOT_FOUND: "ENTITY_NOT_FOUND",
    /** Entity has no embedding fields */
    NO_EMBEDDING_FIELDS: "NO_EMBEDDING_FIELDS",
    /** Embedding generation failed */
    EMBEDDING_FAILED: "EMBEDDING_FAILED",
    /** Vector store operation failed */
    VECTOR_STORE_ERROR: "VECTOR_STORE_ERROR",
    /** Search operation failed */
    SEARCH_FAILED: "SEARCH_FAILED",
    /** Invalid search options */
    INVALID_SEARCH_OPTIONS: "INVALID_SEARCH_OPTIONS",
    /** Provider API error */
    PROVIDER_ERROR: "PROVIDER_ERROR",
    /** Rate limit exceeded */
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const

export type RAGErrorCode = (typeof RAG_ERROR_CODES)[keyof typeof RAG_ERROR_CODES]

/**
 * RAG-specific error class
 */
export class RAGError extends Error {
    constructor(
        public readonly code: RAGErrorCode,
        message: string,
        public readonly cause?: unknown
    ) {
        super(message)
        this.name = "RAGError"
    }
}

/**
 * Check if error is a RAG error
 */
export function isRAGError(error: unknown): error is RAGError {
    return error instanceof RAGError
}

/**
 * Check if error is a specific RAG error code
 */
export function isRAGErrorCode(error: unknown, code: RAGErrorCode): boolean {
    return isRAGError(error) && error.code === code
}
