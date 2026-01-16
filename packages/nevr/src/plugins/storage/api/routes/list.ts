// =============================================================================
// ROUTE - LIST
// File listing endpoints
// =============================================================================

import { z } from "zod"
import { endpoint, EndpointError, validateWithZod } from "../../../unified/endpoint.js"
import type { StorageRouteConfig } from "../../types.js"
import { createStorageAdapter } from "../internal-adapter.js"

// -----------------------------------------------------------------------------
// List Files
// -----------------------------------------------------------------------------

const listFilesSchema = z.object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    userId: z.string().optional(),
    visibility: z.enum(["public", "private"]).optional(),
})

/**
 * List files
 * GET /storage/files
 */
export function listFiles(config: StorageRouteConfig) {
    return endpoint("/files", {
        method: "GET",
        query: listFilesSchema,
        meta: {
            summary: "List files",
            description: "List files with pagination",
            tags: ["Storage"],
        },
        handler: async (ctx: any) => {
            const query = ctx.query || {}

            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Database driver not available",
                })
            }

            const adapter = createStorageAdapter(driver)
            const currentUserId = ctx.user?.id

            // If requesting files for a specific user, check authorization
            const requestedUserId = query.userId

            // Non-authenticated users can only see public files
            if (!currentUserId && query.visibility !== "public") {
                // Force public visibility for unauthenticated requests
                query.visibility = "public"
            }

            // Users can only list their own files unless admin
            // For now, we restrict to own files or public files
            let userIdFilter: string | undefined = undefined

            if (requestedUserId) {
                if (requestedUserId !== currentUserId) {
                    // Can only view other users' public files
                    query.visibility = "public"
                }
                userIdFilter = requestedUserId
            } else if (currentUserId) {
                // Default to current user's files
                userIdFilter = currentUserId
            }

            const files = await adapter.listFiles({
                limit: query.limit || 20,
                offset: query.offset || 0,
                userId: userIdFilter,
            })

            // Filter by visibility if specified
            const filteredFiles = query.visibility
                ? files.filter(f => f.visibility === query.visibility)
                : files

            return {
                status: 200,
                body: {
                    files: filteredFiles.map(file => ({
                        id: file.id,
                        key: file.key,
                        name: file.name,
                        mimeType: file.mimeType,
                        size: file.size,
                        visibility: file.visibility,
                        url: file.url,
                        createdAt: file.createdAt,
                        updatedAt: file.updatedAt,
                    })),
                    pagination: {
                        limit: query.limit || 20,
                        offset: query.offset || 0,
                        hasMore: filteredFiles.length === (query.limit || 20),
                    },
                },
            }
        },
    })
}

// -----------------------------------------------------------------------------
// Search Files
// -----------------------------------------------------------------------------

const searchFilesSchema = z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional(),
    mimeType: z.string().optional(),
})

/**
 * Search files by name
 * POST /storage/search
 */
export function searchFiles(config: StorageRouteConfig) {
    return endpoint("/search", {
        method: "POST",
        body: searchFilesSchema,
        meta: {
            summary: "Search files",
            description: "Search files by name or metadata",
            tags: ["Storage"],
        },
        handler: async (ctx: any) => {
            const rawBody = ctx.body || ctx.input || {}
            const body = validateWithZod(searchFilesSchema, rawBody)

            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Database driver not available",
                })
            }

            const adapter = createStorageAdapter(driver)
            const userId = ctx.user?.id

            // Get all files for user
            const allFiles = await adapter.listFiles({
                userId: userId || undefined,
                limit: 1000, // Search limit
            })

            // Filter by search query
            const searchLower = body.query.toLowerCase()
            let results = allFiles.filter(file =>
                file.name.toLowerCase().includes(searchLower) ||
                file.key.toLowerCase().includes(searchLower)
            )

            // Filter by MIME type if specified
            if (body.mimeType) {
                results = results.filter(file =>
                    file.mimeType.startsWith(body.mimeType!)
                )
            }

            // Apply limit
            const limit = body.limit || 20
            results = results.slice(0, limit)

            return {
                status: 200,
                body: {
                    files: results.map(file => ({
                        id: file.id,
                        key: file.key,
                        name: file.name,
                        mimeType: file.mimeType,
                        size: file.size,
                        visibility: file.visibility,
                        url: file.url,
                    })),
                    total: results.length,
                },
            }
        },
    })
}

// -----------------------------------------------------------------------------
// Get Storage Stats
// -----------------------------------------------------------------------------

/**
 * Get storage usage statistics
 * GET /storage/stats
 */
export function getStorageStats(config: StorageRouteConfig) {
    return endpoint("/stats", {
        method: "GET",
        meta: {
            summary: "Get storage stats",
            description: "Get storage usage statistics for the current user",
            tags: ["Storage"],
        },
        handler: async (ctx: any) => {
            const driver = ctx.context?.driver || ctx.driver
            if (!driver) {
                throw new EndpointError("INTERNAL_ERROR", {
                    message: "Database driver not available",
                })
            }

            const adapter = createStorageAdapter(driver)
            const userId = ctx.user?.id

            if (!userId) {
                throw new EndpointError("UNAUTHORIZED", {
                    message: "Authentication required",
                })
            }

            // Get all files for user
            const files = await adapter.listFiles({ userId })

            // Calculate stats
            const totalSize = files.reduce((sum, file) => sum + file.size, 0)
            const filesByType: Record<string, { count: number; size: number }> = {}

            for (const file of files) {
                const type = file.mimeType.split("/")[0] || "other"
                if (!filesByType[type]) {
                    filesByType[type] = { count: 0, size: 0 }
                }
                filesByType[type].count++
                filesByType[type].size += file.size
            }

            return {
                status: 200,
                body: {
                    totalFiles: files.length,
                    totalSize,
                    byType: filesByType,
                    publicFiles: files.filter(f => f.visibility === "public").length,
                    privateFiles: files.filter(f => f.visibility === "private").length,
                },
            }
        },
    })
}
