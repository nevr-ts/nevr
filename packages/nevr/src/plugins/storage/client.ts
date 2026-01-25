// =============================================================================
// STORAGE CLIENT
// Unified client with plugin pattern + helper utilities
// Simplifies file uploads to 5 lines of code
// =============================================================================

import { atom, type WritableAtom } from "nanostores"
import type {
    NevrClientPlugin,
    NevrFetch,
    NevrFetchResponse,
    ClientStore,
} from "../../client/types.js"
import type { StorageFile } from "./types.js"
import { STORAGE_ERROR_CODES } from "./error-codes.js"

// =============================================================================
// TYPES
// =============================================================================

export interface StorageClientOptions {
    /** Base path for storage endpoints (default: /storage) */
    basePath?: string
    /** Auto-refresh files after upload/delete */
    autoRefresh?: boolean
}

export interface UploadProgress {
    loaded: number
    total: number
    percentage: number
}

export interface UploadParams {
    name: string
    mimeType: string
    size: number
    visibility?: "public" | "private"
    metadata?: Record<string, string>
}

export interface UploadUrlResponse {
    uploadUrl: string
    method: string
    headers: Record<string, string>
    key: string
    expiresAt: string
}

export interface DownloadUrlResponse {
    url: string
    method: string
    expiresAt: string | null
    file: StorageFile
}

export interface FileListResult {
    files: StorageFile[]
    pagination: { limit: number; offset: number; hasMore: boolean }
}

export interface StorageStats {
    totalFiles: number
    totalSize: number
    byType: Record<string, { count: number; size: number }>
    publicFiles: number
    privateFiles: number
}

export interface FileMetadata {
    id: string
    key: string
    name: string
    mimeType: string
    size: number
    visibility: "public" | "private"
    url: string | null
    createdAt: string
    updatedAt: string
}

// =============================================================================
// FILES STATE (Reactive)
// =============================================================================

export interface FilesState {
    files: StorageFile[]
    isLoading: boolean
    error: Error | null
}

// =============================================================================
// CLIENT METHODS INTERFACE
// =============================================================================

export interface StorageClientMethods {
    /** Request presigned upload URL */
    requestUpload(params: UploadParams): Promise<NevrFetchResponse<UploadUrlResponse>>

    /** Confirm file upload */
    confirmUpload(params: { key: string }): Promise<NevrFetchResponse<{ file: StorageFile }>>

    /** Get presigned download URL */
    getDownloadUrl(params: { key: string; expiresIn?: number }): Promise<NevrFetchResponse<DownloadUrlResponse>>

    /** Get file by ID */
    getFile(id: string): Promise<NevrFetchResponse<{ file: StorageFile }>>

    /** Delete file by key */
    deleteFile(params: { key: string }): Promise<NevrFetchResponse<{ success: boolean }>>

    /** List files with pagination */
    listFiles(params?: { limit?: number; offset?: number; visibility?: string }): Promise<NevrFetchResponse<FileListResult>>

    /** Search files by name */
    searchFiles(params: { query: string; limit?: number; mimeType?: string }): Promise<NevrFetchResponse<{ files: StorageFile[] }>>

    /** Bulk delete files */
    bulkDeleteFiles(params: { keys: string[] }): Promise<NevrFetchResponse<{ deleted: string[]; failed: { key: string; reason: string }[] }>>

    /** Get storage stats */
    getStats(): Promise<NevrFetchResponse<StorageStats>>

    // =========================================================================
    // SIMPLIFIED HELPERS (5 lines of code!)
    // =========================================================================

    /**
     * Upload a file in one call (handles all 3 steps)
     * 
     * @example
     * ```ts
     * // Just 1 line to upload!
     * const file = await client.storage.upload(fileInput.files[0], { visibility: "public" })
     * ```
     */
    upload(file: File, options?: {
        visibility?: "public" | "private"
        metadata?: Record<string, string>
        onProgress?: (progress: UploadProgress) => void
    }): Promise<StorageFile>

    /**
     * Download a file (opens in new tab or returns blob)
     * 
     * @example
     * ```ts
     * // Open file in new tab
     * await client.storage.download(fileKey)
     * 
     * // Get as blob
     * const blob = await client.storage.download(fileKey, { asBlob: true })
     * ```
     */
    download(key: string, options?: { asBlob?: boolean }): Promise<Blob | void>

    /**
     * Delete a file by key
     * 
     * @example
     * ```ts
     * await client.storage.delete(fileKey)
     * ```
     */
    delete(key: string): Promise<void>
}

// =============================================================================
// CLIENT PLUGIN TYPE
// =============================================================================

export type StorageClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        endpoints: StorageClientMethods
        $ERROR_CODES: typeof STORAGE_ERROR_CODES
        File: StorageFile
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format file size to human readable string
 * @example formatSize(1024) => "1.0 KB"
 */
export function formatSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"]
    let unitIndex = 0
    let size = bytes

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

/** Check if MIME type is an image */
export function isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/")
}

/** Check if MIME type is a video */
export function isVideo(mimeType: string): boolean {
    return mimeType.startsWith("video/")
}

/** Check if MIME type is audio */
export function isAudio(mimeType: string): boolean {
    return mimeType.startsWith("audio/")
}

/** Check if MIME type is a document */
export function isDocument(mimeType: string): boolean {
    return (
        mimeType.startsWith("application/pdf") ||
        mimeType.startsWith("application/msword") ||
        mimeType.startsWith("application/vnd.openxmlformats") ||
        mimeType.startsWith("text/")
    )
}

/** Get file extension from name */
export function getExtension(filename: string): string {
    return filename.split(".").pop()?.toLowerCase() || ""
}

/** Get icon name for file type */
export function getFileIcon(mimeType: string): string {
    if (isImage(mimeType)) return "image"
    if (isVideo(mimeType)) return "video"
    if (isAudio(mimeType)) return "audio"
    if (mimeType.includes("pdf")) return "pdf"
    if (mimeType.includes("word") || mimeType.includes("document")) return "doc"
    if (mimeType.includes("sheet") || mimeType.includes("excel")) return "spreadsheet"
    if (mimeType.includes("zip") || mimeType.includes("archive")) return "archive"
    return "file"
}

// =============================================================================
// CLIENT PLUGIN FACTORY
// =============================================================================

/**
 * Create storage client plugin
 *
 * @example
 * ```ts
 * import { createTypedClient } from "nevr/client"
 * import { storageClient } from "nevr/plugins/storage"
 *
 * const client = createTypedClient<API>({
 *   plugins: [storageClient()]
 * })
 *
 * // Upload in 1 line!
 * const file = await client.storage.upload(fileInput.files[0])
 *
 * // Download
 * await client.storage.download(file.key)
 *
 * // Delete
 * await client.storage.delete(file.key)
 * ```
 */
export function storageClient(options?: StorageClientOptions): StorageClientPlugin {
    const basePath = options?.basePath || "/storage"

    // Atoms for reactive state
    let $files: WritableAtom<FilesState>

    return {
        id: "storage-client",

        /**
         * Path methods for endpoint proxy
         */
        pathMethods: {
            [`${basePath}/upload`]: "POST",
            [`${basePath}/upload/confirm`]: "POST",
            [`${basePath}/download`]: "POST",
            [`${basePath}/file`]: "DELETE",
            [`${basePath}/files`]: "GET",
            [`${basePath}/search`]: "POST",
            [`${basePath}/stats`]: "GET",
        },

        /**
         * Get reactive atoms
         */
        getAtoms($fetch: NevrFetch) {
            $files = atom<FilesState>({
                files: [],
                isLoading: true,
                error: null,
            })

            // Initial fetch
            refreshFiles($fetch)

            return {
                files: $files,
            }

            async function refreshFiles(fetch: NevrFetch) {
                $files.set({ ...$files.get(), isLoading: true })
                try {
                    const result = await fetch(`${basePath}/files`, { method: "GET" })
                    if (result.error) {
                        $files.set({ files: [], error: result.error as any, isLoading: false })
                    } else {
                        const data = result.data as FileListResult
                        $files.set({ files: data?.files || [], error: null, isLoading: false })
                    }
                } catch (error) {
                    $files.set({ files: [], error: error as Error, isLoading: false })
                }
            }
        },

        /**
         * Get action methods
         */
        getActions($fetch: NevrFetch, $store: ClientStore) {
            // Helper to refresh files
            const refreshFiles = async () => {
                if ($files) {
                    $files.set({ ...$files.get(), isLoading: true })
                    const result = await $fetch(`${basePath}/files`, { method: "GET" })
                    const data = result.data as FileListResult
                    $files.set({
                        files: data?.files || [],
                        error: result.error as any,
                        isLoading: false,
                    })
                }
            }

            return {
                storage: {
                    // =========================================================
                    // SIMPLIFIED METHODS (User-facing API)
                    // =========================================================

                    /**
                     * Upload a file in one call
                     */
                    upload: async (
                        file: File,
                        opts?: {
                            visibility?: "public" | "private"
                            metadata?: Record<string, string>
                            onProgress?: (progress: UploadProgress) => void
                        }
                    ): Promise<StorageFile> => {
                        // Step 1: Request upload URL
                        const { data: uploadData, error: uploadError } = await $fetch(
                            `${basePath}/upload`,
                            {
                                method: "POST",
                                body: {
                                    name: file.name,
                                    mimeType: file.type || "application/octet-stream",
                                    size: file.size,
                                    visibility: opts?.visibility,
                                    metadata: opts?.metadata,
                                },
                            }
                        )

                        if (uploadError || !uploadData) {
                            throw new Error((uploadError as any)?.message || "Failed to get upload URL")
                        }

                        const upload = uploadData as UploadUrlResponse

                        // Step 2: Upload to presigned URL
                        if (opts?.onProgress && typeof XMLHttpRequest !== "undefined") {
                            await new Promise<void>((resolve, reject) => {
                                const xhr = new XMLHttpRequest()
                                xhr.open(upload.method, upload.uploadUrl)

                                for (const [key, value] of Object.entries(upload.headers)) {
                                    xhr.setRequestHeader(key, value)
                                }

                                xhr.upload.onprogress = (event) => {
                                    if (event.lengthComputable && opts.onProgress) {
                                        opts.onProgress({
                                            loaded: event.loaded,
                                            total: event.total,
                                            percentage: Math.round((event.loaded / event.total) * 100),
                                        })
                                    }
                                }

                                xhr.onload = () => {
                                    if (xhr.status >= 200 && xhr.status < 300) {
                                        resolve()
                                    } else {
                                        reject(new Error(`Upload failed with status ${xhr.status}`))
                                    }
                                }

                                xhr.onerror = () => reject(new Error("Upload failed"))
                                xhr.send(file)
                            })
                        } else {
                            const response = await fetch(upload.uploadUrl, {
                                method: upload.method,
                                headers: upload.headers,
                                body: file,
                            })

                            if (!response.ok) {
                                throw new Error(`Upload failed with status ${response.status}`)
                            }
                        }

                        // Step 3: Confirm upload
                        const { data: confirmData, error: confirmError } = await $fetch(
                            `${basePath}/upload/confirm`,
                            {
                                method: "POST",
                                body: { key: upload.key },
                            }
                        )

                        if (confirmError || !confirmData) {
                            throw new Error((confirmError as any)?.message || "Failed to confirm upload")
                        }

                        // Refresh files list
                        if (options?.autoRefresh !== false) {
                            await refreshFiles()
                        }

                        return (confirmData as { file: StorageFile }).file
                    },

                    /**
                     * Download a file
                     */
                    download: async (key: string, opts?: { asBlob?: boolean }): Promise<Blob | void> => {
                        const { data, error } = await $fetch(`${basePath}/download`, {
                            method: "POST",
                            body: { key },
                        })

                        if (error || !data) {
                            throw new Error((error as any)?.message || "Failed to get download URL")
                        }

                        const downloadData = data as DownloadUrlResponse

                        if (opts?.asBlob) {
                            const response = await fetch(downloadData.url)
                            return response.blob()
                        } else {
                            window.open(downloadData.url, "_blank")
                        }
                    },

                    /**
                     * Delete a file
                     */
                    delete: async (key: string): Promise<void> => {
                        const { error } = await $fetch(`${basePath}/file`, {
                            method: "DELETE",
                            body: { key },
                        })

                        if (error) {
                            throw new Error((error as any)?.message || "Failed to delete file")
                        }

                        // Refresh files list
                        if (options?.autoRefresh !== false) {
                            await refreshFiles()
                        }
                    },

                    // =========================================================
                    // LOW-LEVEL METHODS (For advanced usage)
                    // =========================================================

                    requestUpload: async (params: UploadParams) => {
                        return $fetch(`${basePath}/upload`, {
                            method: "POST",
                            body: params,
                        }) as Promise<NevrFetchResponse<UploadUrlResponse>>
                    },

                    confirmUpload: async (params: { key: string }) => {
                        const result = await $fetch(`${basePath}/upload/confirm`, {
                            method: "POST",
                            body: params,
                        })
                        if (options?.autoRefresh !== false) await refreshFiles()
                        return result as NevrFetchResponse<{ file: StorageFile }>
                    },

                    getDownloadUrl: async (params: { key: string; expiresIn?: number }) => {
                        return $fetch(`${basePath}/download`, {
                            method: "POST",
                            body: params,
                        }) as Promise<NevrFetchResponse<DownloadUrlResponse>>
                    },

                    getFile: async (id: string) => {
                        return $fetch(`${basePath}/file/${id}`, {
                            method: "GET",
                        }) as Promise<NevrFetchResponse<{ file: StorageFile }>>
                    },

                    deleteFile: async (params: { key: string }) => {
                        const result = await $fetch(`${basePath}/file`, {
                            method: "DELETE",
                            body: params,
                        })
                        if (options?.autoRefresh !== false) await refreshFiles()
                        return result as NevrFetchResponse<{ success: boolean }>
                    },

                    listFiles: async (params?: { limit?: number; offset?: number; visibility?: string }) => {
                        return $fetch(`${basePath}/files`, {
                            method: "GET",
                            query: params as Record<string, string> | undefined,
                        }) as Promise<NevrFetchResponse<FileListResult>>
                    },

                    searchFiles: async (params: { query: string; limit?: number; mimeType?: string }) => {
                        return $fetch(`${basePath}/search`, {
                            method: "POST",
                            body: params,
                        }) as Promise<NevrFetchResponse<{ files: StorageFile[] }>>
                    },

                    bulkDeleteFiles: async (params: { keys: string[] }) => {
                        const result = await $fetch(`${basePath}/files`, {
                            method: "DELETE",
                            body: params,
                        })
                        if (options?.autoRefresh !== false) await refreshFiles()
                        return result as NevrFetchResponse<{ deleted: string[]; failed: { key: string; reason: string }[] }>
                    },

                    getStats: async () => {
                        return $fetch(`${basePath}/stats`, {
                            method: "GET",
                        }) as Promise<NevrFetchResponse<StorageStats>>
                    },
                },
            }
        },

        // Type inference for SDK
        $InferTypes: {
            endpoints: {} as StorageClientMethods,
            $ERROR_CODES: STORAGE_ERROR_CODES,
            File: {} as StorageFile,
        },
    } as StorageClientPlugin
}

// =============================================================================
// REACT HOOKS
// =============================================================================

/**
 * React hook factory for file uploads with progress
 *
 * @example
 * ```tsx
 * const useFileUpload = createUseFileUpload(React)
 *
 * function UploadButton({ client }) {
 *   const { upload, progress, isUploading } = useFileUpload(client)
 *
 *   return (
 *     <input
 *       type="file"
 *       onChange={(e) => upload(e.target.files[0])}
 *       disabled={isUploading}
 *     />
 *   )
 * }
 * ```
 */
export function createUseFileUpload(React: {
    useState: <T>(initial: T) => [T, (value: T) => void]
    useCallback: <T extends (...args: any[]) => any>(fn: T, deps: any[]) => T
}) {
    const { useState, useCallback } = React

    return function useFileUpload(client: { storage: StorageClientMethods }) {
        const [isUploading, setIsUploading] = useState(false)
        const [progress, setProgress] = useState(0)
        const [error, setError] = useState(null as Error | null)
        const [uploadedFile, setUploadedFile] = useState(null as StorageFile | null)

        const upload = useCallback(
            async (
                file: File,
                options?: {
                    visibility?: "public" | "private"
                    metadata?: Record<string, string>
                }
            ) => {
                setIsUploading(true)
                setProgress(0)
                setError(null)
                setUploadedFile(null)

                try {
                    const result = await client.storage.upload(file, {
                        ...options,
                        onProgress: (p) => setProgress(p.percentage),
                    })
                    setUploadedFile(result)
                    return result
                } catch (err) {
                    const error = err instanceof Error ? err : new Error("Upload failed")
                    setError(error)
                    throw error
                } finally {
                    setIsUploading(false)
                }
            },
            [client]
        )

        const reset = useCallback(() => {
            setIsUploading(false)
            setProgress(0)
            setError(null)
            setUploadedFile(null)
        }, [])

        return {
            upload,
            reset,
            isUploading,
            progress,
            error,
            uploadedFile,
        }
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default storageClient
