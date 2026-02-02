// =============================================================================
// STORAGE PLUGIN
// File storage with S3-compatible providers (AWS S3, Cloudflare R2, MinIO)
// =============================================================================

import { createPlugin } from "../unified/index.js"
import { getLogger } from "../../logger.js"
import type { StoragePluginOptions, StorageProvider, StorageRouteConfig, StorageFile } from "./types.js"
import { getStorageSchema } from "./schema.js"
import { createS3Provider } from "./api/providers/s3.js"
import { createLocalProvider } from "./api/providers/local.js"
import { requestUpload, confirmUpload } from "./api/routes/upload.js"
import { requestDownloadUrl, getFile } from "./api/routes/download.js"
import { deleteFile, bulkDeleteFiles } from "./api/routes/delete.js"
import { listFiles, searchFiles, getStorageStats } from "./api/routes/list.js"

// =============================================================================
// RE-EXPORTS
// =============================================================================

export * from "./types.js"
export { STORAGE_ERROR_CODES } from "./error-codes.js"
export { getStorageSchema } from "./schema.js"
export { createS3Provider } from "./api/providers/s3.js"
export { createLocalProvider } from "./api/providers/local.js"
export { createStorageAdapter } from "./api/internal-adapter.js"

// Unified endpoint utilities
export { z, endpoint, EndpointError, createMiddleware } from "../unified/endpoint.js"

// =============================================================================
// CLIENT EXPORTS - Import from "nevr/plugins/storage/client" instead
// =============================================================================

//
// For frontend/client usage:
//   import { storageClient, formatSize, isImage, ... } from "nevr/plugins/storage/client"
// =============================================================================

// Re-export type-only client types for convenience
export type {
    StorageClientPlugin,
    StorageClientMethods,
    StorageClientOptions,
    FileMetadata,
    UploadProgress,
    FilesState,
} from "./client.js"

// =============================================================================
// PRE-REGISTRATION (Side Effect)
// Allows plugin('storage').storageFile to work during generation
// =============================================================================

import { preRegisterPluginSchema } from "../unified/runtime.js"

// Pre-register storage schema when this module is imported
preRegisterPluginSchema("storage", getStorageSchema())

// =============================================================================
// PROVIDER CACHE
// =============================================================================

// Cache for provider instances
const providerCache = new Map<string, StorageProvider>()

function getCacheKey(options: StoragePluginOptions): string {
    return JSON.stringify({
        type: options.provider,
        ...options.s3,
        ...options.local,
    })
}

async function getOrCreateProvider(options: StoragePluginOptions): Promise<StorageProvider> {
    const cacheKey = getCacheKey(options)

    const cached = providerCache.get(cacheKey)
    if (cached) {
        return cached
    }

    let provider: StorageProvider

    switch (options.provider) {
        case "s3":
            if (!options.s3) {
                throw new Error("[Storage] S3 configuration is required for S3 provider")
            }
            provider = await createS3Provider(options.s3)
            break

        case "local":
            if (!options.local) {
                throw new Error("[Storage] Local configuration is required for local provider")
            }
            provider = await createLocalProvider(options.local)
            break

        default:
            throw new Error(`[Storage] Unknown provider type: ${options.provider}`)
    }

    providerCache.set(cacheKey, provider)
    getLogger().debug(`[Storage] Created ${options.provider} provider`)

    return provider
}

// =============================================================================
// STORAGE PLUGIN
// =============================================================================

/**
 * Storage plugin for file management with S3-compatible providers
 *
 * @example
 * ```ts
 * // AWS S3
 * import { storage } from "nevr/plugins"
 *
 * const app = nevr({
 *   plugins: [
 *     storage({
 *       provider: "s3",
 *       s3: {
 *         bucket: "my-bucket",
 *         region: "us-east-1",
 *         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
 *         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
 *       },
 *     }),
 *   ],
 * })
 *
 * // Cloudflare R2
 * storage({
 *   provider: "s3",
 *   s3: {
 *     bucket: "my-bucket",
 *     region: "auto",
 *     endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
 *     accessKeyId: process.env.R2_ACCESS_KEY_ID,
 *     secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
 *     publicUrlBase: "https://pub-xxx.r2.dev",
 *   },
 * })
 *
 * // Local filesystem (development)
 * storage({
 *   provider: "local",
 *   local: {
 *     basePath: "./uploads",
 *     publicUrlBase: "http://localhost:3000",
 *   },
 * })
 * ```
 */
export const storage = createPlugin<StoragePluginOptions>({
    id: "storage",
    name: "File Storage",
    version: "1.0.0",
    description: "File storage with S3-compatible providers",
    basePath: "/storage",

    defaults: {
        provider: "local",
        defaultVisibility: "private",
        maxFileSize: 10 * 1024 * 1024, // 10MB
        presignedUrlExpiry: 3600, // 1 hour
    },

    validate: (options) => {
        const errors: string[] = []

        if (!options.provider) {
            errors.push("Provider type is required")
        }

        if (options.provider === "s3" && !options.s3) {
            errors.push("S3 configuration is required when provider is 's3'")
        }

        if (options.provider === "local" && !options.local) {
            errors.push("Local configuration is required when provider is 'local'")
        }

        return errors
    },

    factory: (options) => {
        // Provider instance (lazy initialized)
        let providerInstance: StorageProvider | null = null

        const getProvider = (): StorageProvider => {
            if (providerInstance) {
                return providerInstance
            }
            throw new Error("[Storage] Provider not initialized. Wait for plugin initialization.")
        }

        // Build route config
        const routeConfig: StorageRouteConfig = {
            options,
            getProvider,
        }

        return {
            schema: getStorageSchema(),

            endpoints: {
                // Upload
                requestUpload: requestUpload(routeConfig),
                confirmUpload: confirmUpload(routeConfig),

                // Download
                requestDownloadUrl: requestDownloadUrl(routeConfig),
                getFile: getFile(routeConfig),

                // Delete
                deleteFile: deleteFile(routeConfig),
                bulkDeleteFiles: bulkDeleteFiles(routeConfig),

                // List & Search
                listFiles: listFiles(routeConfig),
                searchFiles: searchFiles(routeConfig),
                getStorageStats: getStorageStats(routeConfig),
            } as any,

            lifecycle: {
                onInit: async () => {
                    getLogger().debug("[Storage] Initializing storage plugin...")

                    // Initialize provider
                    providerInstance = await getOrCreateProvider(options)

                    getLogger().info(`[Storage] Initialized with ${options.provider} provider`)
                },
            },

            // Add storage helpers via interceptors
            interceptors: {
                before: [
                    {
                        matcher: "/storage/**",
                        handler: async (ctx: any) => {
                            // Add storage helpers to context
                            ctx.storage = {
                                getProvider,
                                getUploadUrl: async (key: string, uploadOptions: {
                                    mimeType: string
                                    size: number
                                    expiresIn?: number
                                    visibility?: "public" | "private"
                                }) => {
                                    const provider = getProvider()
                                    return provider.getUploadUrl(key, {
                                        ...uploadOptions,
                                        expiresIn: uploadOptions.expiresIn || options.presignedUrlExpiry || 3600,
                                    })
                                },
                                getDownloadUrl: async (key: string, expiresIn?: number) => {
                                    const provider = getProvider()
                                    return provider.getDownloadUrl(key, {
                                        expiresIn: expiresIn || options.presignedUrlExpiry || 3600,
                                    })
                                },
                                getPublicUrl: (key: string) => {
                                    const provider = getProvider()
                                    return provider.getPublicUrl(key)
                                },
                                deleteFile: async (key: string) => {
                                    const provider = getProvider()
                                    return provider.deleteFile(key)
                                },
                            }
                        },
                    },
                ],
            },

            $Infer: {
                File: {} as StorageFile,
            },
            $ERROR_CODES: {} as typeof import("./error-codes.js").STORAGE_ERROR_CODES,
        }
    },
})

export default storage
