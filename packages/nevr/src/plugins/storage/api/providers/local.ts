// =============================================================================
// LOCAL STORAGE PROVIDER
// Filesystem-based storage for development and simple deployments
// =============================================================================

import type { StorageProvider, LocalProviderConfig, PresignedUrl } from "../../types.js"
import { getLogger } from "../../../../logger.js"
import { generateId } from "../../../auth/crypto/index.js"

// We'll use dynamic imports for fs/path to handle both Node and edge environments

// -----------------------------------------------------------------------------
// Local Provider Implementation
// -----------------------------------------------------------------------------

/**
 * Create local filesystem storage provider
 */
export async function createLocalProvider(config: LocalProviderConfig): Promise<StorageProvider> {
    // Dynamic import node modules
    let fs: typeof import("fs/promises")
    let path: typeof import("path")

    try {
        fs = await import("fs/promises")
        path = await import("path")
    } catch (error) {
        throw new Error("[Storage] Local provider requires Node.js environment")
    }

    // Ensure base directory exists
    try {
        await fs.mkdir(config.basePath, { recursive: true })
    } catch (error) {
        getLogger().error("[Storage] Failed to create storage directory:", error)
        throw error
    }

    // Token store for presigned URLs (in-memory for simplicity)
    // In production, use Redis or database
    const uploadTokens = new Map<string, {
        key: string
        mimeType: string
        size: number
        expiresAt: Date
    }>()

    const downloadTokens = new Map<string, {
        key: string
        expiresAt: Date
    }>()

    // Clean expired tokens periodically
    setInterval(() => {
        const now = Date.now()
        for (const [token, data] of uploadTokens) {
            if (data.expiresAt.getTime() < now) {
                uploadTokens.delete(token)
            }
        }
        for (const [token, data] of downloadTokens) {
            if (data.expiresAt.getTime() < now) {
                downloadTokens.delete(token)
            }
        }
    }, 60000) // Clean every minute

    return {
        type: "local",

        async getUploadUrl(key, options) {
            // Generate a unique token for this upload
            const token = generateId()
            const expiresAt = new Date(Date.now() + options.expiresIn * 1000)

            uploadTokens.set(token, {
                key,
                mimeType: options.mimeType,
                size: options.size,
                expiresAt,
            })

            // Return URL to our upload endpoint
            const baseUrl = config.publicUrlBase || "http://localhost:3000"
            const url = `${baseUrl}/storage/upload/${token}`

            return {
                url,
                method: "PUT",
                headers: {
                    "Content-Type": options.mimeType,
                },
                expiresAt,
                key,
            }
        },

        async getDownloadUrl(key, options) {
            const token = generateId()
            const expiresAt = new Date(Date.now() + options.expiresIn * 1000)

            downloadTokens.set(token, {
                key,
                expiresAt,
            })

            const baseUrl = config.publicUrlBase || "http://localhost:3000"
            const url = `${baseUrl}/storage/download/${token}`

            return {
                url,
                method: "GET",
                expiresAt,
                key,
            }
        },

        getPublicUrl(key) {
            if (config.publicUrlBase) {
                return `${config.publicUrlBase.replace(/\/$/, "")}/files/${key}`
            }
            return `/files/${key}`
        },

        async deleteFile(key) {
            try {
                const filePath = path.join(config.basePath, key)
                await fs.unlink(filePath)
            } catch (error: any) {
                if (error.code !== "ENOENT") {
                    getLogger().error("[Storage] Local delete failed:", error)
                    throw error
                }
            }
        },

        async fileExists(key) {
            try {
                const filePath = path.join(config.basePath, key)
                await fs.access(filePath)
                return true
            } catch {
                return false
            }
        },

        async copyFile(sourceKey, destKey) {
            try {
                const sourcePath = path.join(config.basePath, sourceKey)
                const destPath = path.join(config.basePath, destKey)

                // Ensure destination directory exists
                await fs.mkdir(path.dirname(destPath), { recursive: true })

                await fs.copyFile(sourcePath, destPath)
            } catch (error) {
                getLogger().error("[Storage] Local copy failed:", error)
                throw error
            }
        },
    }
}

// -----------------------------------------------------------------------------
// Token Validation (exported for route handlers)
// -----------------------------------------------------------------------------

// Note: In a real implementation, these would be stored in Redis/database
// This is a simple in-memory implementation for development

export interface UploadTokenData {
    key: string
    mimeType: string
    size: number
    expiresAt: Date
}

export interface DownloadTokenData {
    key: string
    expiresAt: Date
}
