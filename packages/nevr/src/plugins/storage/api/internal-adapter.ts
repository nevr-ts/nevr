// =============================================================================
// STORAGE INTERNAL ADAPTER
// Database operations abstraction for storage plugin
// =============================================================================

import type { Driver } from "../../../types.js"
import type { StorageAdapter, StorageFile } from "../types.js"
import { generateId } from "../../auth/crypto/index.js"

// -----------------------------------------------------------------------------
// Internal Adapter Factory
// -----------------------------------------------------------------------------

/**
 * Create internal adapter for storage database operations
 */
export function createStorageAdapter(driver: Driver): StorageAdapter {
    return {
        async findFileById(id: string): Promise<StorageFile | null> {
            return driver.findOne<StorageFile>("storageFile", { id })
        },

        async findFileByKey(key: string): Promise<StorageFile | null> {
            return driver.findOne<StorageFile>("storageFile", { key })
        },

        async findFilesByUserId(userId: string): Promise<StorageFile[]> {
            return driver.findMany<StorageFile>("storageFile", { where: { userId } })
        },

        async createFile(data: Omit<StorageFile, "id" | "createdAt" | "updatedAt">): Promise<StorageFile> {
            const now = new Date()
            return driver.create<StorageFile>("storageFile", {
                id: generateId(),
                ...data,
                createdAt: now,
                updatedAt: now,
            })
        },

        async updateFile(id: string, data: Partial<StorageFile>): Promise<StorageFile | null> {
            return driver.update<StorageFile>("storageFile", { id }, {
                ...data,
                updatedAt: new Date(),
            })
        },

        async deleteFile(id: string): Promise<void> {
            await driver.delete("storageFile", { id })
        },

        async listFiles(options?: { limit?: number; offset?: number; userId?: string }): Promise<StorageFile[]> {
            const where = options?.userId ? { userId: options.userId } : {}
            return driver.findMany<StorageFile>("storageFile", {
                where,
                take: options?.limit,
                skip: options?.offset,
            })
        },
    }
}
