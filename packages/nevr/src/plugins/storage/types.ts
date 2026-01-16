// =============================================================================
// STORAGE PLUGIN TYPES
// Type definitions for file storage integration
// Supports S3-compatible providers (AWS, R2, MinIO) and local filesystem
// =============================================================================

import type { Driver } from "../../types.js"

// -----------------------------------------------------------------------------
// Plugin Options
// -----------------------------------------------------------------------------

/**
 * Storage plugin configuration options
 */
export interface StoragePluginOptions {
    /**
     * Storage provider type
     */
    provider: "s3" | "local"

    /**
     * S3-compatible provider configuration
     * Required when provider is "s3"
     */
    s3?: S3ProviderConfig

    /**
     * Local filesystem provider configuration
     * Required when provider is "local"
     */
    local?: LocalProviderConfig

    /**
     * Default visibility for uploaded files
     * @default "private"
     */
    defaultVisibility?: "public" | "private"

    /**
     * Maximum file size in bytes
     * @default 10485760 (10MB)
     */
    maxFileSize?: number

    /**
     * Allowed MIME types (empty = allow all)
     * @example ["image/jpeg", "image/png", "application/pdf"]
     */
    allowedMimeTypes?: string[]

    /**
     * Presigned URL expiration in seconds
     * @default 3600 (1 hour)
     */
    presignedUrlExpiry?: number

    /**
     * Custom path generator for uploaded files
     * @example (file, user) => `users/${user.id}/${file.name}`
     */
    generatePath?: (file: FileUploadInput, userId?: string) => string

    /**
     * Hooks for storage operations
     */
    hooks?: StorageHooks
}

/**
 * S3-compatible provider configuration
 */
export interface S3ProviderConfig {
    /** S3 bucket name */
    bucket: string
    /** AWS region or endpoint region */
    region: string
    /** Access key ID */
    accessKeyId?: string
    /** Secret access key */
    secretAccessKey?: string
    /** Custom endpoint for S3-compatible services (R2, MinIO) */
    endpoint?: string
    /** Force path style (required for MinIO) */
    forcePathStyle?: boolean
    /** Public URL base for public files */
    publicUrlBase?: string
}

/**
 * Local filesystem provider configuration
 */
export interface LocalProviderConfig {
    /** Base path for file storage */
    basePath: string
    /** Public URL base for serving files */
    publicUrlBase?: string
}

/**
 * Storage operation hooks
 */
export interface StorageHooks {
    beforeUpload?: (file: FileUploadInput, userId?: string) => Promise<FileUploadInput | null>
    afterUpload?: (file: StorageFile, driver: Driver) => Promise<void>
    beforeDelete?: (file: StorageFile, userId?: string) => Promise<boolean>
    afterDelete?: (file: StorageFile, driver: Driver) => Promise<void>
}

// -----------------------------------------------------------------------------
// Entity Types
// -----------------------------------------------------------------------------

/**
 * File upload input
 */
export interface FileUploadInput {
    /** Original filename */
    name: string
    /** MIME type */
    mimeType: string
    /** File size in bytes */
    size: number
    /** File visibility */
    visibility?: "public" | "private"
    /** Custom metadata */
    metadata?: Record<string, unknown>
}

/**
 * Storage file record
 */
export interface StorageFile {
    id: string
    /** User who uploaded the file */
    userId?: string | null
    /** Storage key/path */
    key: string
    /** Original filename */
    name: string
    /** MIME type */
    mimeType: string
    /** File size in bytes */
    size: number
    /** File visibility */
    visibility: "public" | "private"
    /** Public URL (for public files) */
    url?: string | null
    /** Custom metadata */
    metadata?: Record<string, unknown> | null
    createdAt: Date
    updatedAt: Date
}

/**
 * Presigned URL response
 */
export interface PresignedUrl {
    /** URL for upload/download */
    url: string
    /** HTTP method (PUT for upload, GET for download) */
    method: "PUT" | "GET"
    /** Headers to include in request */
    headers?: Record<string, string>
    /** URL expiration timestamp */
    expiresAt: Date
    /** File key (for upload completion) */
    key: string
}

// -----------------------------------------------------------------------------
// Internal Adapter Interface
// -----------------------------------------------------------------------------

/**
 * Internal adapter for storage database operations
 */
export interface StorageAdapter {
    // File operations
    findFileById(id: string): Promise<StorageFile | null>
    findFileByKey(key: string): Promise<StorageFile | null>
    findFilesByUserId(userId: string): Promise<StorageFile[]>
    createFile(data: Omit<StorageFile, "id" | "createdAt" | "updatedAt">): Promise<StorageFile>
    updateFile(id: string, data: Partial<StorageFile>): Promise<StorageFile | null>
    deleteFile(id: string): Promise<void>
    listFiles(options?: { limit?: number; offset?: number; userId?: string }): Promise<StorageFile[]>
}

// -----------------------------------------------------------------------------
// Provider Interface
// -----------------------------------------------------------------------------

/**
 * Storage provider interface
 */
export interface StorageProvider {
    /** Provider type identifier */
    type: "s3" | "local"

    /**
     * Generate presigned URL for upload
     */
    getUploadUrl(key: string, options: {
        mimeType: string
        size: number
        expiresIn: number
        visibility?: "public" | "private"
    }): Promise<PresignedUrl>

    /**
     * Generate presigned URL for download
     */
    getDownloadUrl(key: string, options: {
        expiresIn: number
    }): Promise<PresignedUrl>

    /**
     * Get public URL for a file (if public)
     */
    getPublicUrl(key: string): string | null

    /**
     * Delete a file from storage
     */
    deleteFile(key: string): Promise<void>

    /**
     * Check if file exists
     */
    fileExists(key: string): Promise<boolean>

    /**
     * Copy a file
     */
    copyFile(sourceKey: string, destKey: string): Promise<void>
}

// -----------------------------------------------------------------------------
// Route Config Types
// -----------------------------------------------------------------------------

export interface StorageRouteConfig {
    options: StoragePluginOptions
    getProvider: () => StorageProvider
}
