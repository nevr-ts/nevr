// =============================================================================
// AI GATEWAY CLIENT PLUGIN TEST
// Tests for AI Gateway client plugin pattern
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import { aiClient, type AIGatewayClientPlugin } from "./client.js"

describe("AI Gateway Client Plugin", () => {
    describe("Plugin Structure", () => {
        it("should have required plugin properties", () => {
            const client = aiClient()

            expect(client.id).toBe("ai-gateway")
            expect(client.pathMethods).toBeDefined()
            expect(client.getActions).toBeDefined()
            expect(client.getAtoms).toBeDefined()
            expect(client.atomListeners).toBeDefined()
            expect(client.$InferTypes).toBeDefined()
        })

        it("should have correct $InferTypes structure", () => {
            const client = aiClient()
            const infer = client.$InferTypes

            expect(infer).toHaveProperty("endpoints")
            expect(infer).toHaveProperty("$ERROR_CODES")
            expect(infer).toHaveProperty("UsageRecord")
            expect(infer).toHaveProperty("ChatResponse")
        })

        it("should have pathMethods for all endpoints", () => {
            const client = aiClient()
            const methods = client.pathMethods

            expect(methods["/ai/chat"]).toBe("POST")
            expect(methods["/ai/usage"]).toBe("GET")
            expect(methods["/ai/usage/records"]).toBe("GET")
            expect(methods["/ai/usage/limits"]).toBe("GET")
            expect(methods["/ai/models"]).toBe("GET")
            expect(methods["/ai/tokens/count"]).toBe("POST")
        })

        it("should support custom basePath", () => {
            const client = aiClient({ basePath: "/api/ai" })

            expect(client.pathMethods["/api/ai/chat"]).toBe("POST")
            expect(client.pathMethods["/api/ai/models"]).toBe("GET")
        })

        it("should have atomListeners for usage-changing actions", () => {
            const client = aiClient()

            expect(client.atomListeners).toContain("chat")
            expect(client.atomListeners).toContain("countTokens")
        })
    })

    describe("getAtoms", () => {
        it("should create reactive atoms", () => {
            const client = aiClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })

            const atoms = client.getAtoms!(mockFetch as any)

            expect(atoms).toHaveProperty("usage")
            expect(atoms).toHaveProperty("models")
        })

        it("should initialize with loading state", () => {
            const client = aiClient()
            const mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })

            const atoms = client.getAtoms!(mockFetch as any)
            const usageState = atoms.usage.get()
            const modelsState = atoms.models.get()

            expect(usageState.isLoading).toBe(true)
            expect(usageState.usage).toBeNull()
            expect(modelsState.isLoading).toBe(true)
            expect(modelsState.models).toBeNull()
        })
    })

    describe("getActions", () => {
        let mockFetch: ReturnType<typeof vi.fn>
        let mockStore: any
        let client: AIGatewayClientPlugin
        let actions: ReturnType<NonNullable<AIGatewayClientPlugin["getActions"]>>

        beforeEach(() => {
            mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })
            mockStore = { atoms: {} }
            client = aiClient()

            // Initialize atoms first
            client.getAtoms!(mockFetch)

            actions = client.getActions!(mockFetch as any, mockStore)
        })

        it("should have ai action methods", () => {
            expect(actions.ai).toBeDefined()
            expect(actions.ai.chat).toBeDefined()
            expect(actions.ai.chatStream).toBeDefined()
            expect(actions.ai.getUsage).toBeDefined()
            expect(actions.ai.getUsageRecords).toBeDefined()
            expect(actions.ai.getRateLimitStatus).toBeDefined()
            expect(actions.ai.getModels).toBeDefined()
            expect(actions.ai.getModelInfo).toBeDefined()
            expect(actions.ai.countTokens).toBeDefined()
        })
    })
})
