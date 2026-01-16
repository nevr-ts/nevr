// =============================================================================
// STORAGE CLIENT
// Frontend helpers for file upload/download
// =============================================================================

import type { RequestUploadInput } from "./api/routes/upload.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface StorageClientOptions {
    /** Base URL for the API */
    baseUrl?: string
    /** Custom fetch function */
    fetch?: typeof fetch
    /** Authorization header getter */
    getAuthHeader?: () => Promise<string | undefined>
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
    file: {
        id: string
        key: string
        name: string
        mimeType: string
        size: number
    }
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

export interface UploadProgress {
    loaded: number
    total: number
    percentage: number
}

// -----------------------------------------------------------------------------
// Storage Client
// -----------------------------------------------------------------------------

/**
 * Create a storage client for frontend usage
 *
 * @example
 * ```ts
 * const storage = createStorageClient({
 *   baseUrl: "/api",
 *   getAuthHeader: async () => `Bearer ${token}`,
 * })
 *
 * // Upload a file
 * const file = fileInput.files[0]
 * const result = await storage.upload(file, {
 *   visibility: "public",
 *   onProgress: (progress) => console.log(`${progress.percentage}%`),
 * })
 *
 * // Download a file
 * const downloadUrl = await storage.getDownloadUrl(result.key)
 * window.open(downloadUrl.url)
 *
 * // Delete a file
 * await storage.delete(result.key)
 * ```
 */
export function createStorageClient(options: StorageClientOptions = {}) {
    const baseUrl = options.baseUrl || ""
    const customFetch = options.fetch || globalThis.fetch

    async function getHeaders(): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }

        if (options.getAuthHeader) {
            const auth = await options.getAuthHeader()
            if (auth) {
                headers["Authorization"] = auth
            }
        }

        return headers
    }

    async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const headers = await getHeaders()
        const response = await customFetch(`${baseUrl}/storage${path}`, {
            ...init,
            headers: {
                ...headers,
                ...init.headers,
            },
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Request failed" }))
            throw new Error(error.message || `Request failed with status ${response.status}`)
        }

        return response.json()
    }

    return {
        /**
         * Upload a file
         */
        async upload(
            file: File,
            options: {
                visibility?: "public" | "private"
                metadata?: Record<string, string>
                onProgress?: (progress: UploadProgress) => void
            } = {}
        ): Promise<FileMetadata> {
            // Step 1: Request upload URL
            const uploadRequest: RequestUploadInput = {
                name: file.name,
                mimeType: file.type || "application/octet-stream",
                size: file.size,
                visibility: options.visibility,
                metadata: options.metadata,
            }

            const { body: uploadData } = await request<{ body: UploadUrlResponse }>("/upload", {
                method: "POST",
                body: JSON.stringify(uploadRequest),
            })

            // Step 2: Upload directly to storage (with progress if supported)
            if (options.onProgress && typeof XMLHttpRequest !== "undefined") {
                // Use XHR for progress tracking
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest()
                    xhr.open(uploadData.method, uploadData.uploadUrl)

                    // Set headers
                    for (const [key, value] of Object.entries(uploadData.headers)) {
                        xhr.setRequestHeader(key, value)
                    }

                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable && options.onProgress) {
                            options.onProgress({
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
                // Use fetch without progress
                const uploadResponse = await customFetch(uploadData.uploadUrl, {
                    method: uploadData.method,
                    headers: uploadData.headers,
                    body: file,
                })

                if (!uploadResponse.ok) {
                    throw new Error(`Upload failed with status ${uploadResponse.status}`)
                }
            }

            // Step 3: Confirm upload
            const { body: confirmData } = await request<{ body: { file: FileMetadata } }>("/upload/confirm", {
                method: "POST",
                body: JSON.stringify({ key: uploadData.key }),
            })

            return confirmData.file
        },

        /**
         * Get a download URL for a file
         */
        async getDownloadUrl(key: string, expiresIn?: number): Promise<DownloadUrlResponse> {
            const { body } = await request<{ body: DownloadUrlResponse }>("/download", {
                method: "POST",
                body: JSON.stringify({ key, expiresIn }),
            })
            return body
        },

        /**
         * Get file metadata
         */
        async getFile(id: string): Promise<FileMetadata> {
            const { body } = await request<{ body: { file: FileMetadata } }>(`/file/${id}`, {
                method: "GET",
            })
            return body.file
        },

        /**
         * List files with pagination
         */
        async listFiles(options?: {
            limit?: number
            offset?: number
            visibility?: "public" | "private"
        }): Promise<{
            files: FileMetadata[]
            pagination: { limit: number; offset: number; hasMore: boolean }
        }> {
            const params = new URLSearchParams()
            if (options?.limit) params.set("limit", String(options.limit))
            if (options?.offset) params.set("offset", String(options.offset))
            if (options?.visibility) params.set("visibility", options.visibility)

            const query = params.toString()
            const { body } = await request<{ body: { files: FileMetadata[]; pagination: any } }>(
                `/files${query ? `?${query}` : ""}`,
                { method: "GET" }
            )
            return body
        },

        /**
         * Search files by name
         */
        async searchFiles(query: string, options?: {
            limit?: number
            mimeType?: string
        }): Promise<FileMetadata[]> {
            const { body } = await request<{ body: { files: FileMetadata[] } }>("/search", {
                method: "POST",
                body: JSON.stringify({ query, ...options }),
            })
            return body.files
        },

        /**
         * Delete a file
         */
        async delete(key: string): Promise<void> {
            await request("/file", {
                method: "DELETE",
                body: JSON.stringify({ key }),
            })
        },

        /**
         * Delete multiple files
         */
        async bulkDelete(keys: string[]): Promise<{
            deleted: string[]
            failed: { key: string; reason: string }[]
        }> {
            const { body } = await request<{ body: { deleted: string[]; failed: any[] } }>("/files", {
                method: "DELETE",
                body: JSON.stringify({ keys }),
            })
            return body
        },

        /**
         * Get storage usage statistics
         */
        async getStats(): Promise<{
            totalFiles: number
            totalSize: number
            byType: Record<string, { count: number; size: number }>
            publicFiles: number
            privateFiles: number
        }> {
            const { body } = await request<{ body: any }>("/stats", { method: "GET" })
            return body
        },

        /**
         * Helper to format file size
         */
        formatSize(bytes: number): string {
            const units = ["B", "KB", "MB", "GB", "TB"]
            let unitIndex = 0
            let size = bytes

            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024
                unitIndex++
            }

            return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
        },

        /**
         * Helper to check if MIME type is an image
         */
        isImage(mimeType: string): boolean {
            return mimeType.startsWith("image/")
        },

        /**
         * Helper to check if MIME type is a video
         */
        isVideo(mimeType: string): boolean {
            return mimeType.startsWith("video/")
        },

        /**
         * Helper to check if MIME type is audio
         */
        isAudio(mimeType: string): boolean {
            return mimeType.startsWith("audio/")
        },

        /**
         * Helper to check if MIME type is a document
         */
        isDocument(mimeType: string): boolean {
            return (
                mimeType.startsWith("application/pdf") ||
                mimeType.startsWith("application/msword") ||
                mimeType.startsWith("application/vnd.openxmlformats") ||
                mimeType.startsWith("text/")
            )
        },
    }
}

// -----------------------------------------------------------------------------
// React Hooks (if React is available)
// -----------------------------------------------------------------------------

/**
 * React hook for file uploads with progress tracking
 *
 * @example
 * ```tsx
 * function UploadButton() {
 *   const { upload, progress, isUploading, error } = useFileUpload({
 *     baseUrl: "/api",
 *   })
 *
 *   return (
 *     <div>
 *       <input
 *         type="file"
 *         onChange={(e) => {
 *           if (e.target.files?.[0]) {
 *             upload(e.target.files[0], { visibility: "public" })
 *           }
 *         }}
 *         disabled={isUploading}
 *       />
 *       {isUploading && <progress value={progress} max={100} />}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   )
 * }
 * ```
 */
export function createUseFileUpload(React: {
    useState: <T>(initial: T) => [T, (value: T) => void]
    useCallback: <T extends (...args: any[]) => any>(fn: T, deps: any[]) => T
}) {
    const { useState, useCallback } = React

    return function useFileUpload(options: StorageClientOptions = {}) {
        const [isUploading, setIsUploading] = useState(false)
        const [progress, setProgress] = useState(0)
        const [error, setError] = useState(null as Error | null)
        const [uploadedFile, setUploadedFile] = useState(null as FileMetadata | null)

        const client = createStorageClient(options)

        const upload = useCallback(
            async (
                file: File,
                uploadOptions?: {
                    visibility?: "public" | "private"
                    metadata?: Record<string, string>
                }
            ) => {
                setIsUploading(true)
                setProgress(0)
                setError(null)
                setUploadedFile(null)

                try {
                    const result = await client.upload(file, {
                        ...uploadOptions,
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

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export default createStorageClient
