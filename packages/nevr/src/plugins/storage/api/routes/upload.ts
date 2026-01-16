// =============================================================================
// ROUTE - UPLOAD
// File upload endpoints
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import { STORAGE_ERROR_CODES } from "../../error-codes.js"
import type { StorageRouteConfig } from "../../types.js"
import { createStorageAdapter } from "../internal-adapter.js"
import { getLogger } from "../../../../logger.js"

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

export const requestUploadSchema = z.object({
    name: z.string().min(1, "Filename is required"),
    mimeType: z.string().min(1, "MIME type is required"),
    size: z.number().int().positive("Size must be positive"),
    visibility: z.enum(["public", "private"]).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
})

export type RequestUploadInput = z.infer<typeof requestUploadSchema>

// -----------------------------------------------------------------------------
// Request Upload URL
// -----------------------------------------------------------------------------

/**
 * Request a presigned URL for file upload
 * POST /storage/upload
 */
export function requestUpload(config: StorageRouteConfig) {
    const { options, getProvider } = config

    return endpoint("/upload", {
        method: "POST",
        body: requestUploadSchema,
        meta: {
            summary: "Request upload URL",
            description: "Get a presigned URL for uploading a file",
            tags: ["Storage"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(requestUploadSchema, rawBody)

            // Authentication optional but tracked
            const userId = ctx.user?.id

            // Validate file size
            const maxSize = options.maxFileSize || 10 * 1024 * 1024 // 10MB default
            if (body.size > maxSize) {
                throw new EndpointError("BAD_REQUEST", {
                    code: STORAGE_ERROR_CODES.FILE_TOO_LARGE,
                    message: `File exceeds maximum size of ${maxSize} bytes`,
                })
            }

            // Validate MIME type
            if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
                if (!options.allowedMimeTypes.includes(body.mimeType)) {
                    throw new EndpointError("BAD_REQUEST", {
                        code: STORAGE_ERROR_CODES.INVALID_MIME_TYPE,
                        message: `File type ${body.mimeType} is not allowed`,
                    })
                }
            }

            // Apply before upload hook
            let fileInput: {
                name: string
                mimeType: string
                size: number
                visibility: "public" | "private"
                metadata?: Record<string, unknown>
            } = {
                name: body.name,
                mimeType: body.mimeType,
                size: body.size,
                visibility: body.visibility || options.defaultVisibility || "private",
                metadata: body.metadata,
            }

            if (options.hooks?.beforeUpload) {
                const modified = await options.hooks.beforeUpload(fileInput, userId)
                if (modified === null) {
                    throw new EndpointError("BAD_REQUEST", {
                        code: STORAGE_ERROR_CODES.UPLOAD_FAILED,
                        message: "Upload rejected by hook",
                    })
                }
                fileInput = {
                    ...modified,
                    visibility: modified.visibility || "private",
                }
            }

            // Generate storage key
            const key = options.generatePath
                ? options.generatePath(fileInput, userId)
                : generateDefaultPath(fileInput, userId)

            const provider = getProvider()
            const expiresIn = options.presignedUrlExpiry || 3600 // 1 hour default

            try {
                const presignedUrl = await provider.getUploadUrl(key, {
                    mimeType: fileInput.mimeType,
                    size: fileInput.size,
                    expiresIn,
                    visibility: fileInput.visibility,
                })

                // Create pending file record
                const driver = ctx.context?.driver || ctx.driver
                if (driver) {
                    const adapter = createStorageAdapter(driver)
                    await adapter.createFile({
                        userId: userId || null,
                        key,
                        name: fileInput.name,
                        mimeType: fileInput.mimeType,
                        size: fileInput.size,
                        visibility: fileInput.visibility,
                        url: fileInput.visibility === "public" ? provider.getPublicUrl(key) : null,
                        metadata: fileInput.metadata || null,
                    })
                }

                getLogger().debug("[Storage] Upload URL generated:", key)

                return {
                    status: 200,
                    body: {
                        uploadUrl: presignedUrl.url,
                        method: presignedUrl.method,
                        headers: presignedUrl.headers,
                        key,
                        expiresAt: presignedUrl.expiresAt.toISOString(),
                    },
                }
            } catch (error) {
                getLogger().error("[Storage] Failed to generate upload URL:", error)
                throw new EndpointError("INTERNAL_ERROR", {
                    code: STORAGE_ERROR_CODES.PRESIGN_FAILED,
                    message: "Failed to generate upload URL",
                })
            }
        },
    })
}

// -----------------------------------------------------------------------------
// Confirm Upload
// -----------------------------------------------------------------------------

const confirmUploadSchema = z.object({
    key: z.string().min(1, "Key is required"),
})

/**
 * Confirm upload completion
 * POST /storage/upload/confirm
 */
export function confirmUpload(config: StorageRouteConfig) {
    const { options, getProvider } = config

    return endpoint("/upload/confirm", {
        method: "POST",
        body: confirmUploadSchema,
        meta: {
            summary: "Confirm upload",
            description: "Confirm that a file upload has completed",
            tags: ["Storage"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(confirmUploadSchema, rawBody)

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

            // Verify file exists in storage
            const provider = getProvider()
            const exists = await provider.fileExists(body.key)

            if (!exists) {
                // Delete the pending record
                await adapter.deleteFile(file.id)
                throw new EndpointError("BAD_REQUEST", {
                    code: STORAGE_ERROR_CODES.UPLOAD_FAILED,
                    message: "Upload not completed",
                })
            }

            // Call after upload hook
            if (options.hooks?.afterUpload) {
                await options.hooks.afterUpload(file, driver)
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
                    },
                },
            }
        },
    })
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function generateDefaultPath(file: { name: string; mimeType: string }, userId?: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const ext = file.name.split(".").pop() || ""

    if (userId) {
        return `users/${userId}/${timestamp}-${random}.${ext}`
    }

    return `uploads/${timestamp}-${random}.${ext}`
}
