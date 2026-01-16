// =============================================================================
// ROUTE - DOWNLOAD
// File download endpoints
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import { STORAGE_ERROR_CODES } from "../../error-codes.js"
import type { StorageRouteConfig } from "../../types.js"
import { createStorageAdapter } from "../internal-adapter.js"
import { getLogger } from "../../../../logger.js"

// -----------------------------------------------------------------------------
// Download URL Request
// -----------------------------------------------------------------------------

const downloadUrlSchema = z.object({
    key: z.string().min(1, "Key is required"),
    expiresIn: z.number().int().positive().optional(),
})

/**
 * Get a presigned download URL
 * POST /storage/download
 */
export function requestDownloadUrl(config: StorageRouteConfig) {
    const { options, getProvider } = config

    return endpoint("/download", {
        method: "POST",
        body: downloadUrlSchema,
        meta: {
            summary: "Request download URL",
            description: "Get a presigned URL for downloading a file",
            tags: ["Storage"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(downloadUrlSchema, rawBody)

            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Database driver not available",
                })
            }

            const adapter = createStorageAdapter(driver)
            const file = await adapter.findFileByKey(body.key)

            if (!file) {
                throw new EndpointError("NOT_FOUND", {
                    code: STORAGE_ERROR_CODES.FILE_NOT_FOUND,
                    message: "File not found",
                })
            }

            // Check access permissions
            const userId = ctx.user?.id
            if (file.visibility === "private") {
                // Private files require ownership or admin access
                if (!userId || (file.userId && file.userId !== userId)) {
                    throw new EndpointError("FORBIDDEN", {
                        code: STORAGE_ERROR_CODES.ACCESS_DENIED,
                        message: "Access denied",
                    })
                }
            }

            // Public files with URL can be accessed directly
            if (file.visibility === "public" && file.url) {
                return {
                    status: 200,
                    body: {
                        url: file.url,
                        method: "GET" as const,
                        expiresAt: null as string | null, // Public URLs don't expire
                        file: {
                            id: file.id,
                            key: file.key,
                            name: file.name,
                            mimeType: file.mimeType,
                            size: file.size,
                        },
                    },
                }
            }

            // Generate presigned URL for private files
            const provider = getProvider()
            const expiresIn = body.expiresIn || options.presignedUrlExpiry || 3600

            try {
                const presignedUrl = await provider.getDownloadUrl(body.key, {
                    expiresIn,
                })

                getLogger().debug("[Storage] Download URL generated:", body.key)

                return {
                    status: 200,
                    body: {
                        url: presignedUrl.url,
                        method: "GET" as const,
                        expiresAt: presignedUrl.expiresAt.toISOString() as string | null,
                        file: {
                            id: file.id,
                            key: file.key,
                            name: file.name,
                            mimeType: file.mimeType,
                            size: file.size,
                        },
                    },
                }
            } catch (error) {
                getLogger().error("[Storage] Failed to generate download URL:", error)
                throw new EndpointError("INTERNAL_ERROR", {
                    code: STORAGE_ERROR_CODES.PRESIGN_FAILED,
                    message: "Failed to generate download URL",
                })
            }
        },
    })
}

// -----------------------------------------------------------------------------
// Get File by ID
// -----------------------------------------------------------------------------

const getFileSchema = z.object({
    id: z.string().min(1, "File ID is required"),
})

/**
 * Get file metadata by ID
 * GET /storage/file/:id
 */
export function getFile(config: StorageRouteConfig) {
    return endpoint("/file/:id", {
        method: "GET",
        meta: {
            summary: "Get file metadata",
            description: "Retrieve file metadata by ID",
            tags: ["Storage"],
        },
        handler: async (ctx: any) => {
            const fileId = ctx.params?.id

            if (!fileId) {
                throw new EndpointError("BAD_REQUEST", {
                    message: "File ID is required",
                })
            }

            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Database driver not available",
                })
            }

            const adapter = createStorageAdapter(driver)
            const file = await adapter.findFileById(fileId)

            if (!file) {
                throw new EndpointError("NOT_FOUND", {
                    code: STORAGE_ERROR_CODES.FILE_NOT_FOUND,
                    message: "File not found",
                })
            }

            // Check access for private files
            const userId = ctx.user?.id
            if (file.visibility === "private") {
                if (!userId || (file.userId && file.userId !== userId)) {
                    throw new EndpointError("FORBIDDEN", {
                        code: STORAGE_ERROR_CODES.ACCESS_DENIED,
                        message: "Access denied",
                    })
                }
            }

            return {
                status: 200,
                body: {
                    file: {
                        id: file.id,
                        key: file.key,
                        name: file.name,
                        mimeType: file.mimeType,
                        size: file.size,
                        visibility: file.visibility,
                        url: file.url,
                        metadata: file.metadata,
                        createdAt: file.createdAt,
                        updatedAt: file.updatedAt,
                    },
                },
            }
        },
    })
}
