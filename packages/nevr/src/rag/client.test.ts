// =============================================================================
// RAG CLIENT PLUGIN TESTS
// Tests for RAG client plugin pattern
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { ragClient, type RAGClientPlugin } from "./client.js"
import { RAG_ERROR_CODES } from "./error-codes.js"

describe("RAG Client Plugin", () => {
    describe("Plugin Structure", () => {
        it("should have required plugin properties", () => {
            const client = ragClient()

            expect(client.id).toBe("rag-client")
            expect(client.pathMethods).toBeDefined()
            expect(client.getActions).toBeDefined()
            expect(client.getAtoms).toBeDefined()
            expect(client.$InferTypes).toBeDefined()
        })

        it("should have correct $InferTypes structure", () => {
            const client = ragClient()
            const infer = client.$InferTypes

            expect(infer).toHaveProperty("endpoints")
            expect(infer).toHaveProperty("$ERROR_CODES")
            expect(infer).toHaveProperty("SearchResult")
        })

        it("should have pathMethods for all endpoints", () => {
            const client = ragClient()
            const methods = client.pathMethods

            expect(methods["/rag/search"]).toBe("POST")
            expect(methods["/rag/index"]).toBe("POST")
            expect(methods["/rag/stats"]).toBe("GET")
            expect(methods["/rag/clear"]).toBe("DELETE")
        })

        it("should support custom basePath", () => {
            const client = ragClient({ basePath: "/api/rag" })
            const methods = client.pathMethods

            expect(methods["/api/rag/search"]).toBe("POST")
            expect(methods["/api/rag/stats"]).toBe("GET")
        })
    })

    describe("getAtoms", () => {
        it("should create reactive atoms", () => {
            const client = ragClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })

            const atoms = client.getAtoms!(mockFetch as any)

            expect(atoms).toHaveProperty("search")
        })

        it("should initialize with empty state", () => {
            const client = ragClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })

            const atoms = client.getAtoms!(mockFetch as any)
            const searchState = atoms.search.get()

            expect(searchState.query).toBeNull()
            expect(searchState.results).toEqual([])
            expect(searchState.isLoading).toBe(false)
            expect(searchState.error).toBeNull()
        })
    })

    describe("getActions", () => {
        let mockFetch: ReturnType<typeof vi.fn>
        let mockStore: any
        let client: RAGClientPlugin
        let actions: ReturnType<NonNullable<RAGClientPlugin["getActions"]>>

        beforeEach(() => {
            mockFetch = vi.fn().mockResolvedValue({ data: { results: [] }, error: null })
            mockStore = { atoms: {} }
            client = ragClient()

            // Initialize atoms first
            client.getAtoms!(mockFetch)

            actions = client.getActions!(mockFetch as any, mockStore)
        })

        it("should have rag action methods", () => {
            expect(actions.rag).toBeDefined()
            expect(actions.rag.search).toBeDefined()
            expect(actions.rag.index).toBeDefined()
            expect(actions.rag.stats).toBeDefined()
            expect(actions.rag.clear).toBeDefined()
        })

        it("search should call POST with correct body", async () => {
            await actions.rag.search({ query: "test query", entities: ["article"] })

            expect(mockFetch).toHaveBeenCalledWith("/rag/search", {
                method: "POST",
                body: { query: "test query", entities: ["article"] },
            })
        })

        it("index should call POST with entity and records", async () => {
            const records = [{ id: "1", title: "Test" }]
            await actions.rag.index({ entity: "article", records })

            expect(mockFetch).toHaveBeenCalledWith("/rag/index", {
                method: "POST",
                body: { entity: "article", records },
            })
        })

        it("stats should call GET", async () => {
            await actions.rag.stats()

            expect(mockFetch).toHaveBeenCalledWith("/rag/stats", {
                method: "GET",
            })
        })

        it("clear should call DELETE with entity", async () => {
            await actions.rag.clear("article")

            expect(mockFetch).toHaveBeenCalledWith("/rag/clear", {
                method: "DELETE",
                body: { entity: "article" },
            })
        })
    })

    describe("Error Codes", () => {
        it("should have expected error codes", () => {
            expect(RAG_ERROR_CODES.ENGINE_NOT_INITIALIZED).toBe("ENGINE_NOT_INITIALIZED")
            expect(RAG_ERROR_CODES.ENTITY_NOT_FOUND).toBe("ENTITY_NOT_FOUND")
            expect(RAG_ERROR_CODES.EMBEDDING_FAILED).toBe("EMBEDDING_FAILED")
            expect(RAG_ERROR_CODES.SEARCH_FAILED).toBe("SEARCH_FAILED")
        })
    })
})
