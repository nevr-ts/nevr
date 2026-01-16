// =============================================================================
// ROUTE - DELETE
// File deletion endpoints
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import { STORAGE_ERROR_CODES } from "../../error-codes.js"
import type { StorageRouteConfig } from "../../types.js"
import { createStorageAdapter } from "../internal-adapter.js"
import { getLogger } from "../../../../logger.js"

// -----------------------------------------------------------------------------
// Delete File
// -----------------------------------------------------------------------------

const deleteFileSchema = z.object({
    key: z.string().min(1, "Key is required"),
})

/**
 * Delete a file
 * DELETE /storage/file
 */
export function deleteFile(config: StorageRouteConfig) {
    const { options, getProvider } = config

    return endpoint("/file", {
        method: "DELETE",
        body: deleteFileSchema,
        meta: {
            summary: "Delete file",
            description: "Delete a file from storage",
            tags: ["Storage"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(deleteFileSchema, rawBody)

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

            // Check ownership
            const userId = ctx.user?.id
            if (file.userId && file.userId !== userId) {
                throw new EndpointError("FORBIDDEN", {
                    code: STORAGE_ERROR_CODES.ACCESS_DENIED,
                    message: "Access denied",
                })
            }

            // Call before delete hook
            if (options.hooks?.beforeDelete) {
                const allowed = await options.hooks.beforeDelete(file, userId)
                if (!allowed) {
                    throw new EndpointError("FORBIDDEN", {
                        code: STORAGE_ERROR_CODES.DELETE_FAILED,
                        message: "Delete rejected by hook",
                    })
                }
            }

            try {
                // Delete from storage provider
                const provider = getProvider()
                await provider.deleteFile(body.key)

                // Delete database record
                await adapter.deleteFile(file.id)

                // Call after delete hook
                if (options.hooks?.afterDelete) {
                    await options.hooks.afterDelete(file, driver)
                }

                getLogger().debug("[Storage] File deleted:", body.key)

                return {
                    status: 200,
                    body: {
                        success: true,
                        deletedFile: {
                            id: file.id,
                            key: file.key,
                            name: file.name,
                        },
                    },
                }
            } catch (error) {
                getLogger().error("[Storage] Failed to delete file:", error)
                throw new EndpointError("INTERNAL_ERROR", {
                    code: STORAGE_ERROR_CODES.DELETE_FAILED,
                    message: "Failed to delete file",
                })
            }
        },
    })
}

// -----------------------------------------------------------------------------
// Bulk Delete
// -----------------------------------------------------------------------------

const bulkDeleteSchema = z.object({
    keys: z.array(z.string().min(1)).min(1, "At least one key is required").max(100, "Maximum 100 files per request"),
})

/**
 * Delete multiple files
 * DELETE /storage/files
 */
export function bulkDeleteFiles(config: StorageRouteConfig) {
    const { options, getProvider } = config

    return endpoint("/files", {
        method: "DELETE",
        body: bulkDeleteSchema,
        meta: {
            summary: "Bulk delete files",
            description: "Delete multiple files at once",
            tags: ["Storage"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(bulkDeleteSchema, rawBody)

            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Database driver not available",
                })
            }

            const adapter = createStorageAdapter(driver)
            const userId = ctx.user?.id
            const provider = getProvider()

            const results: {
                deleted: string[]
                failed: { key: string; reason: string }[]
            } = {
                deleted: [],
                failed: [],
            }

            for (const key of body.keys) {
                try {
                    const file = await adapter.findFileByKey(key)

                    if (!file) {
                        results.failed.push({ key, reason: "File not found" })
                        continue
                    }

                    // Check ownership
                    if (file.userId && file.userId !== userId) {
                        results.failed.push({ key, reason: "Access denied" })
                        continue
                    }

                    // Call before delete hook
                    if (options.hooks?.beforeDelete) {
                        const allowed = await options.hooks.beforeDelete(file, userId)
                        if (!allowed) {
                            results.failed.push({ key, reason: "Rejected by hook" })
                            continue
                        }
                    }

                    // Delete from storage
                    await provider.deleteFile(key)

                    // Delete database record
                    await adapter.deleteFile(file.id)

                    // Call after delete hook
                    if (options.hooks?.afterDelete) {
                        await options.hooks.afterDelete(file, driver)
                    }

                    results.deleted.push(key)
                } catch (error) {
                    getLogger().error(`[Storage] Failed to delete file ${key}:`, error)
                    results.failed.push({ key, reason: "Delete failed" })
                }
            }

            getLogger().debug(`[Storage] Bulk delete: ${results.deleted.length} deleted, ${results.failed.length} failed`)

            return {
                status: 200,
                body: results,
            }
        },
    })
}
