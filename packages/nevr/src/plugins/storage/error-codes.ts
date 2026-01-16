// =============================================================================
// STORAGE ERROR CODES
// Centralized error codes for storage plugin
// =============================================================================

/**
 * Storage plugin error codes
 */
export const STORAGE_ERROR_CODES = {
    // Configuration errors
    PROVIDER_NOT_CONFIGURED: "Storage provider is not configured",
    INVALID_PROVIDER: "Invalid storage provider configuration",

    // File errors
    FILE_NOT_FOUND: "File not found",
    FILE_TOO_LARGE: "File exceeds maximum allowed size",
    INVALID_MIME_TYPE: "File type is not allowed",
    FILE_ALREADY_EXISTS: "A file with this key already exists",

    // Upload errors
    UPLOAD_FAILED: "Failed to upload file",
    PRESIGN_FAILED: "Failed to generate presigned URL",
    INVALID_UPLOAD: "Invalid upload request",

    // Download errors
    DOWNLOAD_FAILED: "Failed to download file",
    FILE_NOT_ACCESSIBLE: "File is not accessible",

    // Delete errors
    DELETE_FAILED: "Failed to delete file",
    DELETE_NOT_ALLOWED: "You don't have permission to delete this file",

    // Access errors
    ACCESS_DENIED: "Access denied",
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "You don't have permission to access this file",

    // Provider errors
    S3_ERROR: "S3 operation failed",
    LOCAL_ERROR: "Local storage operation failed",

    // General errors
    INTERNAL_ERROR: "An internal error occurred",
} as const

export type StorageErrorCode = keyof typeof STORAGE_ERROR_CODES
