// =============================================================================
// INTROSPECTION TESTS
// Tests for AI-First context generation
// =============================================================================

import { describe, it, expect } from "vitest"
import { entity, string, text, int } from "./index.js"
import type { Entity } from "./types.js"
import {
    generateContext,
    contextToMarkdown,
    contextToJSON,
    generateContextString,
    type AppContext,
} from "./introspection.js"

// -----------------------------------------------------------------------------
// Context Generation Tests
// -----------------------------------------------------------------------------

describe("Introspection", () => {
    describe("generateContext", () => {
        it("should extract basic entity fields", () => {
            const user = entity("user", {
                email: string.unique(),
                name: string.optional(),
                age: int.optional(),
            }).build()

            const mockInstance = {
                _entities: new Map<string, Entity>([["user", user]]),
                plugins: [],
                config: {},
            } as any

            const ctx = generateContext(mockInstance)

            expect(ctx.version).toBe("1.0.0")
            expect(ctx.generatedAt).toBeDefined()
            expect(ctx.entities).toHaveLength(1)
            expect(ctx.entities[0].name).toBe("user")
            expect(ctx.entities[0].fields).toHaveProperty("email")
            expect(ctx.entities[0].fields.email.type).toBe("string")
            expect(ctx.entities[0].fields.email.required).toBe(true)
            expect(ctx.entities[0].fields.email.unique).toBe(true)
        })

        it("should capture AI instructions", () => {
            const order = entity("order", {
                total: int.instruction("Calculate from lineItems"),
                status: string.instruction("Use workflows for transitions"),
            })
                .instruction("Core business entity")
                .build()

            const mockInstance = {
                _entities: new Map<string, Entity>([["order", order]]),
                plugins: [],
                config: {},
            } as any

            const ctx = generateContext(mockInstance)
            const orderEntity = ctx.entities[0]

            expect(orderEntity.instruction).toBe("Core business entity")
            expect(orderEntity.fields.total.instruction).toBe("Calculate from lineItems")
            expect(orderEntity.fields.status.instruction).toBe("Use workflows for transitions")
        })

        it("should capture semantic fields (searchable, embedding)", () => {
            const article = entity("article", {
                title: string.searchable(),
                content: text.embedding({ provider: "openai" }),
            }).build()

            const mockInstance = {
                _entities: new Map<string, Entity>([["article", article]]),
                plugins: [],
                config: {},
            } as any

            const ctx = generateContext(mockInstance)

            expect(ctx.searchable).toHaveLength(1)
            expect(ctx.searchable[0]).toEqual({ entity: "article", field: "title" })
            expect(ctx.embeddings).toHaveLength(1)
            expect(ctx.embeddings[0].entity).toBe("article")
            expect(ctx.embeddings[0].provider).toBe("openai")
        })

        it("should capture entity namespace", () => {
            const product = entity("product", { name: string })
                .namespace("catalog")
                .build()

            const mockInstance = {
                _entities: new Map<string, Entity>([["product", product]]),
                plugins: [],
                config: {},
            } as any

            const ctx = generateContext(mockInstance)
            expect(ctx.entities[0].namespace).toBe("catalog")
        })
    })

    describe("contextToMarkdown", () => {
        it("should format entities as markdown", () => {
            const ctx: AppContext = {
                version: "1.0.0",
                generatedAt: "2024-01-01T00:00:00.000Z",
                entities: [
                    {
                        name: "user",
                        instruction: "Core auth entity",
                        fields: {
                            email: { type: "string", required: true, unique: true, searchable: true },
                            password: { type: "string", required: true, sensitive: true },
                        },
                        relations: [],
                        actions: ["signIn", "signOut"],
                        rules: { create: ["everyone"], update: ["owner"] },
                    },
                ],
                plugins: [],
                services: [],
                searchable: [{ entity: "user", field: "email" }],
                embeddings: [],
            }

            const md = contextToMarkdown(ctx)

            expect(md).toContain("# APP CONTEXT (Nevr)")
            expect(md).toContain("### user")
            expect(md).toContain("Core auth entity")
            expect(md).toContain("email (string)")
        })
    })

    describe("contextToJSON", () => {
        it("should produce compact JSON", () => {
            const ctx: AppContext = {
                version: "1.0.0",
                generatedAt: "2024-01-01T00:00:00.000Z",
                entities: [
                    {
                        name: "post",
                        fields: {
                            title: { type: "string", required: true, searchable: true },
                            content: { type: "text", required: false, embedding: { provider: "openai" } },
                        },
                        relations: [{ field: "author", target: "user", type: "belongsTo", required: true }],
                        actions: [],
                        rules: {},
                    },
                ],
                plugins: [],
                services: [],
                searchable: [],
                embeddings: [],
            }

            const json = contextToJSON(ctx)
            const parsed = JSON.parse(json)

            expect(parsed.v).toBe("1.0.0")
            expect(parsed.e).toHaveLength(1)
            expect(parsed.e[0].n).toBe("post")
        })
    })

    describe("generateContextString", () => {
        it("should return markdown by default", () => {
            const mockInstance = {
                _entities: new Map(),
                plugins: [],
                config: {},
            } as any

            const result = generateContextString(mockInstance)
            expect(result).toContain("# APP CONTEXT (Nevr)")
        })

        it("should return JSON when format is json", () => {
            const mockInstance = {
                _entities: new Map(),
                plugins: [],
                config: {},
            } as any

            const result = generateContextString(mockInstance, "json")
            expect(result.startsWith("{")).toBe(true)
        })
    })
})
