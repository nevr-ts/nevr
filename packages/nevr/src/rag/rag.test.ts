// =============================================================================
// RAG ENGINE TESTS
// Tests for vector store, embedding providers, and full-text search
// =============================================================================

import { describe, it, expect, beforeEach } from "vitest"
import {
    InMemoryVectorStore,
    inMemoryTextSearch,
    buildPostgresSearchQuery,
    buildSqliteSearchQuery,
    highlightMatches,
    extractSnippets,
    getEmbeddingFields,
    hasEmbeddingFields,
    getSearchableFields,
    hasSearchableFields,
} from "./index.js"
import { entity, string, text } from "../index.js"

// -----------------------------------------------------------------------------
// In-Memory Vector Store Tests
// -----------------------------------------------------------------------------

describe("InMemoryVectorStore", () => {
    let store: InMemoryVectorStore

    beforeEach(() => {
        store = new InMemoryVectorStore()
    })

    describe("upsert", () => {
        it("should store a vector with metadata", async () => {
            await store.upsert("test:1:content", [0.1, 0.2, 0.3], {
                entity: "test",
                field: "content",
                recordId: "1",
            })

            const result = await store.get("test:1:content")
            expect(result).not.toBeNull()
            expect(result?.vector).toEqual([0.1, 0.2, 0.3])
            expect(result?.metadata.entity).toBe("test")
        })

        it("should update existing vector on upsert", async () => {
            await store.upsert("test:1:content", [0.1, 0.2, 0.3], {
                entity: "test",
                field: "content",
                recordId: "1",
            })

            await store.upsert("test:1:content", [0.4, 0.5, 0.6], {
                entity: "test",
                field: "content",
                recordId: "1",
            })

            const result = await store.get("test:1:content")
            expect(result?.vector).toEqual([0.4, 0.5, 0.6])
        })
    })

    describe("upsertBatch", () => {
        it("should store multiple vectors", async () => {
            await store.upsertBatch([
                { id: "test:1:a", vector: [0.1, 0.2], metadata: { entity: "test", field: "a", recordId: "1" } },
                { id: "test:2:b", vector: [0.3, 0.4], metadata: { entity: "test", field: "b", recordId: "2" } },
            ])

            expect(await store.count()).toBe(2)
        })
    })

    describe("search", () => {
        beforeEach(async () => {
            await store.upsertBatch([
                { id: "post:1:title", vector: [1, 0, 0], metadata: { entity: "post", field: "title", recordId: "1" } },
                { id: "post:2:title", vector: [0.9, 0.1, 0], metadata: { entity: "post", field: "title", recordId: "2" } },
                { id: "article:1:content", vector: [0, 1, 0], metadata: { entity: "article", field: "content", recordId: "1" } },
                { id: "post:3:title", vector: [0, 0, 1], metadata: { entity: "post", field: "title", recordId: "3" } },
            ])
        })

        it("should return results ordered by similarity", async () => {
            const results = await store.search([1, 0, 0], { limit: 3 })

            expect(results).toHaveLength(3)
            expect(results[0].id).toBe("post:1:title")
            expect(results[0].score).toBeCloseTo(1, 5)
            expect(results[1].id).toBe("post:2:title")
        })

        it("should filter by entity", async () => {
            const results = await store.search([1, 0, 0], { entities: ["article"] })

            expect(results).toHaveLength(1)
            expect(results[0].metadata.entity).toBe("article")
        })

        it("should filter by minimum score", async () => {
            const results = await store.search([1, 0, 0], { minScore: 0.9 })

            expect(results).toHaveLength(2)
        })

        it("should respect limit", async () => {
            const results = await store.search([1, 0, 0], { limit: 1 })

            expect(results).toHaveLength(1)
        })
    })

    describe("delete", () => {
        it("should delete a vector by ID", async () => {
            await store.upsert("test:1:a", [0.1], { entity: "test", field: "a", recordId: "1" })
            await store.delete("test:1:a")

            expect(await store.get("test:1:a")).toBeNull()
        })
    })

    describe("deleteByFilter", () => {
        it("should delete vectors matching filter", async () => {
            await store.upsertBatch([
                { id: "post:1:a", vector: [0.1], metadata: { entity: "post", field: "a", recordId: "1" } },
                { id: "post:1:b", vector: [0.2], metadata: { entity: "post", field: "b", recordId: "1" } },
                { id: "post:2:a", vector: [0.3], metadata: { entity: "post", field: "a", recordId: "2" } },
            ])

            const deleted = await store.deleteByFilter({ entity: "post", recordId: "1" })

            expect(deleted).toBe(2)
            expect(await store.count()).toBe(1)
        })
    })

    describe("count", () => {
        it("should return total count", async () => {
            await store.upsertBatch([
                { id: "a:1:x", vector: [0.1], metadata: { entity: "a", field: "x", recordId: "1" } },
                { id: "b:1:x", vector: [0.2], metadata: { entity: "b", field: "x", recordId: "1" } },
            ])

            expect(await store.count()).toBe(2)
        })

        it("should count by entity filter", async () => {
            await store.upsertBatch([
                { id: "a:1:x", vector: [0.1], metadata: { entity: "a", field: "x", recordId: "1" } },
                { id: "a:2:x", vector: [0.2], metadata: { entity: "a", field: "x", recordId: "2" } },
                { id: "b:1:x", vector: [0.3], metadata: { entity: "b", field: "x", recordId: "1" } },
            ])

            expect(await store.count({ entity: "a" })).toBe(2)
        })
    })
})

// -----------------------------------------------------------------------------
// Full-Text Search Tests
// -----------------------------------------------------------------------------

describe("Full-Text Search", () => {
    describe("inMemoryTextSearch", () => {
        const records = [
            { id: "1", title: "Password Reset Guide", content: "How to reset your password" },
            { id: "2", title: "Account Settings", content: "Configure your account preferences" },
            { id: "3", title: "Getting Started", content: "Welcome to our platform" },
            { id: "4", title: "Security Tips", content: "Keep your password safe and secure" },
        ]

        it("should find matching records by single term", () => {
            const results = inMemoryTextSearch(records, "password", ["title", "content"])

            expect(results).toHaveLength(2)
            const ids = results.map((r) => r.id)
            expect(ids).toContain("1")
            expect(ids).toContain("4")
        })

        it("should find matching records by multiple terms", () => {
            const results = inMemoryTextSearch(records, "password reset", ["title", "content"])

            expect(results[0].id).toBe("1")
            expect(results[0]._searchScore).toBeGreaterThan(results[1]._searchScore)
        })

        it("should respect limit", () => {
            const results = inMemoryTextSearch(records, "password", ["title", "content"], { limit: 1 })

            expect(results).toHaveLength(1)
        })

        it("should return empty for no matches", () => {
            const results = inMemoryTextSearch(records, "nonexistent", ["title", "content"])

            expect(results).toHaveLength(0)
        })
    })

    describe("buildPostgresSearchQuery", () => {
        it("should generate tsquery with prefix matching", () => {
            const { sql, values } = buildPostgresSearchQuery("password reset", ["title", "content"])

            expect(sql).toContain("to_tsvector")
            expect(sql).toContain("to_tsquery")
            expect(values[0]).toContain("password:*")
            expect(values[0]).toContain("reset:*")
        })

        it("should handle empty query", () => {
            const { sql } = buildPostgresSearchQuery("", ["title"])

            expect(sql).toBe("FALSE")
        })
    })

    describe("buildSqliteSearchQuery", () => {
        it("should generate LIKE conditions", () => {
            const { sql, values } = buildSqliteSearchQuery("password", ["title", "content"])

            expect(sql).toContain("LIKE")
            expect(values).toContain("%password%")
        })
    })

    describe("highlightMatches", () => {
        it("should wrap matched terms with tags", () => {
            const result = highlightMatches("Reset your password here", "password")

            expect(result).toBe("Reset your <mark>password</mark> here")
        })

        it("should use custom tag", () => {
            const result = highlightMatches("Reset your password here", "password", { tag: "strong" })

            expect(result).toBe("Reset your <strong>password</strong> here")
        })
    })

    describe("extractSnippets", () => {
        const longText = "Lorem ipsum dolor sit amet. Reset your password by clicking the link. Consectetur adipiscing elit."

        it("should extract context around matches", () => {
            const snippets = extractSnippets(longText, "password")

            expect(snippets).toHaveLength(1)
            expect(snippets[0]).toContain("password")
        })

        it("should limit snippet length", () => {
            const snippets = extractSnippets(longText, "password", { maxLength: 50 })

            expect(snippets.every((s) => s.length <= 50)).toBe(true)
        })
    })
})

// -----------------------------------------------------------------------------
// Entity Field Helpers Tests
// -----------------------------------------------------------------------------

describe("Entity Field Helpers", () => {
    describe("getEmbeddingFields", () => {
        it("should return fields with embedding config as a Map", () => {
            const article = entity("article", {
                title: string,
                content: text.embedding({ provider: "openai" }),
                summary: text.embedding({ provider: "cohere" }),
            }).build()

            const fields = getEmbeddingFields(article)

            expect(fields.size).toBe(2)
            expect(fields.has("content")).toBe(true)
            expect(fields.has("summary")).toBe(true)
        })
    })

    describe("hasEmbeddingFields", () => {
        it("should return true if entity has embedding fields", () => {
            const article = entity("article", {
                content: text.embedding(),
            }).build()

            expect(hasEmbeddingFields(article)).toBe(true)
        })

        it("should return false if entity has no embedding fields", () => {
            const user = entity("user", {
                name: string,
                email: string,
            }).build()

            expect(hasEmbeddingFields(user)).toBe(false)
        })
    })

    describe("getSearchableFields", () => {
        it("should return searchable fields as a Map", () => {
            const post = entity("post", {
                title: string.searchable(),
                content: text.searchable(),
                authorId: string,
            }).build()

            const fields = getSearchableFields(post)

            expect(fields.size).toBe(2)
            expect(fields.has("title")).toBe(true)
            expect(fields.has("content")).toBe(true)
        })
    })

    describe("hasSearchableFields", () => {
        it("should return true if entity has searchable fields", () => {
            const post = entity("post", {
                title: string.searchable(),
            }).build()

            expect(hasSearchableFields(post)).toBe(true)
        })

        it("should return false if entity has no searchable fields", () => {
            const user = entity("user", {
                name: string,
            }).build()

            expect(hasSearchableFields(user)).toBe(false)
        })
    })
})
