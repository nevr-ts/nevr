// =============================================================================
// STORAGE CLIENT PLUGIN TEST
// Tests for storage client plugin pattern and type inference
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { storageClient, formatSize, isImage, isVideo, isDocument, type StorageClientPlugin } from "./client.js"

describe("Storage Client Plugin", () => {
    describe("Plugin Structure", () => {
        it("should have required plugin properties", () => {
            const client = storageClient()

            expect(client.id).toBe("storage-client")
            expect(client.pathMethods).toBeDefined()
            expect(client.getActions).toBeDefined()
            expect(client.getAtoms).toBeDefined()
            expect(client.$InferTypes).toBeDefined()
        })

        it("should have correct $InferTypes structure", () => {
            const client = storageClient()
            const infer = client.$InferTypes

            expect(infer).toHaveProperty("endpoints")
            expect(infer).toHaveProperty("$ERROR_CODES")
            expect(infer).toHaveProperty("File")
        })

        it("should have pathMethods for all endpoints", () => {
            const client = storageClient()
            const methods = client.pathMethods

            expect(methods["/storage/upload"]).toBe("POST")
            expect(methods["/storage/upload/confirm"]).toBe("POST")
            expect(methods["/storage/download"]).toBe("POST")
            expect(methods["/storage/file"]).toBe("DELETE")
            expect(methods["/storage/files"]).toBe("GET")
            expect(methods["/storage/search"]).toBe("POST")
            expect(methods["/storage/stats"]).toBe("GET")
        })

        it("should support custom basePath", () => {
            const client = storageClient({ basePath: "/api/files" })

            expect(client.pathMethods["/api/files/upload"]).toBe("POST")
            expect(client.pathMethods["/api/files/files"]).toBe("GET")
        })
    })

    describe("getAtoms", () => {
        it("should create reactive atoms", () => {
            const client = storageClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: { files: [] }, error: null })

            const atoms = client.getAtoms!(mockFetch as any)

            expect(atoms).toHaveProperty("files")
        })

        it("should initialize with loading state", () => {
            const client = storageClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: { files: [] }, error: null })

            const atoms = client.getAtoms!(mockFetch as any)
            const state = atoms.files.get()

            expect(state.isLoading).toBe(true)
            expect(state.files).toEqual([])
        })
    })

    describe("getActions", () => {
        let mockFetch: ReturnType<typeof vi.fn>
        let mockStore: any
        let client: StorageClientPlugin
        let actions: ReturnType<NonNullable<StorageClientPlugin["getActions"]>>

        beforeEach(() => {
            mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })
            mockStore = { atoms: {} }
            client = storageClient()

            // Initialize atoms first
            client.getAtoms!(mockFetch)

            actions = client.getActions!(mockFetch as any, mockStore)
        })

        it("should have all storage action methods", () => {
            expect(actions.storage).toBeDefined()
            expect(actions.storage.upload).toBeDefined()
            expect(actions.storage.download).toBeDefined()
            expect(actions.storage.delete).toBeDefined()
            expect(actions.storage.requestUpload).toBeDefined()
            expect(actions.storage.confirmUpload).toBeDefined()
            expect(actions.storage.getDownloadUrl).toBeDefined()
            expect(actions.storage.getFile).toBeDefined()
            expect(actions.storage.deleteFile).toBeDefined()
            expect(actions.storage.listFiles).toBeDefined()
            expect(actions.storage.searchFiles).toBeDefined()
            expect(actions.storage.bulkDeleteFiles).toBeDefined()
            expect(actions.storage.getStats).toBeDefined()
        })

        it("requestUpload should call POST with correct body", async () => {
            mockFetch.mockResolvedValueOnce({
                data: {
                    uploadUrl: "https://s3.amazonaws.com/...",
                    method: "PUT",
                    headers: { "Content-Type": "image/png" },
                    key: "uploads/file.png",
                    expiresAt: "2024-01-01T00:00:00Z",
                },
                error: null,
            })

            await actions.storage.requestUpload({
                name: "test.png",
                mimeType: "image/png",
                size: 12345,
                visibility: "public",
            })

            expect(mockFetch).toHaveBeenCalledWith(
                "/storage/upload",
                expect.objectContaining({
                    method: "POST",
                    body: expect.objectContaining({
                        name: "test.png",
                        mimeType: "image/png",
                    }),
                })
            )
        })

        it("listFiles should call GET", async () => {
            mockFetch.mockResolvedValueOnce({
                data: { files: [], pagination: { limit: 20, offset: 0, hasMore: false } },
                error: null,
            })

            await actions.storage.listFiles({ limit: 10, offset: 0 })

            expect(mockFetch).toHaveBeenCalledWith(
                "/storage/files",
                expect.objectContaining({
                    method: "GET",
                    query: { limit: 10, offset: 0 },
                })
            )
        })

        it("searchFiles should call POST with query", async () => {
            mockFetch.mockResolvedValueOnce({
                data: { files: [] },
                error: null,
            })

            await actions.storage.searchFiles({ query: "test", mimeType: "image/png" })

            expect(mockFetch).toHaveBeenCalledWith(
                "/storage/search",
                expect.objectContaining({
                    method: "POST",
                    body: { query: "test", mimeType: "image/png" },
                })
            )
        })

        it("getStats should call GET", async () => {
            mockFetch.mockResolvedValueOnce({
                data: { totalFiles: 10, totalSize: 1024, byType: {}, publicFiles: 5, privateFiles: 5 },
                error: null,
            })

            await actions.storage.getStats()

            expect(mockFetch).toHaveBeenCalledWith(
                "/storage/stats",
                expect.objectContaining({ method: "GET" })
            )
        })
    })

    describe("Utility Functions", () => {
        it("formatSize should format bytes correctly", () => {
            expect(formatSize(0)).toBe("0 B")
            expect(formatSize(512)).toBe("512 B")
            expect(formatSize(1024)).toBe("1.0 KB")
            expect(formatSize(1536)).toBe("1.5 KB")
            expect(formatSize(1048576)).toBe("1.0 MB")
            expect(formatSize(1073741824)).toBe("1.0 GB")
        })

        it("isImage should detect image MIME types", () => {
            expect(isImage("image/png")).toBe(true)
            expect(isImage("image/jpeg")).toBe(true)
            expect(isImage("image/gif")).toBe(true)
            expect(isImage("application/pdf")).toBe(false)
            expect(isImage("video/mp4")).toBe(false)
        })

        it("isVideo should detect video MIME types", () => {
            expect(isVideo("video/mp4")).toBe(true)
            expect(isVideo("video/webm")).toBe(true)
            expect(isVideo("image/png")).toBe(false)
        })

        it("isDocument should detect document MIME types", () => {
            expect(isDocument("application/pdf")).toBe(true)
            expect(isDocument("application/msword")).toBe(true)
            expect(isDocument("text/plain")).toBe(true)
            expect(isDocument("image/png")).toBe(false)
        })
    })
})
