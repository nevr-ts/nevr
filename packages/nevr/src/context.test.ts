// =============================================================================
// CONTEXT TESTS
// Tests for NevrContext, RuleRegistry, and PluginManager
// =============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
    createNevrContext,
    getGlobalContext,
    clearGlobalContext,
    RuleRegistry,
    PluginManager,
    type NevrContext,
} from "./context.js"
import type { NevrPlugin } from "./plugins/core/contract.js"
import type { NamedRule } from "./rules.js"

describe("NevrContext", () => {
    describe("createNevrContext", () => {
        it("should create an isolated context with all components", () => {
            const ctx = createNevrContext()

            expect(ctx).toBeDefined()
            expect(ctx.services).toBeDefined()
            expect(ctx.rules).toBeDefined()
            expect(ctx.plugins).toBeDefined()
        })

        it("should create independent contexts", () => {
            const ctx1 = createNevrContext()
            const ctx2 = createNevrContext()

            // Register something in ctx1
            ctx1.services.registerInstance("test", { value: 1 })

            // ctx2 should not have it
            expect(ctx1.services.has("test")).toBe(true)
            expect(ctx2.services.has("test")).toBe(false)
        })

        it("should allow clearing all components at once", () => {
            const ctx = createNevrContext()

            // Add some state
            ctx.services.registerInstance("service", {})
            const mockRule: NamedRule = Object.assign(() => true, {
                ruleName: "test",
                check: () => true,
            })
            ctx.rules.register("rule", mockRule)

            // Clear everything
            ctx.services.clear()
            ctx.rules.clear()
            ctx.plugins.clear()

            // Verify cleared
            expect(ctx.services.has("service")).toBe(false)
            expect(ctx.rules.has("rule")).toBe(false)
            expect(ctx.plugins.getAllInstances()).toHaveLength(0)
        })
    })

    describe("Global Context", () => {
        beforeEach(() => {
            clearGlobalContext()
        })

        it("should return same instance when called multiple times", () => {
            const ctx1 = getGlobalContext()
            const ctx2 = getGlobalContext()

            expect(ctx1).toBe(ctx2)
        })

        it("should clear global context properly", () => {
            const ctx = getGlobalContext()
            ctx.services.registerInstance("test", {})

            clearGlobalContext()

            const newCtx = getGlobalContext()
            expect(newCtx).not.toBe(ctx)
            expect(newCtx.services.has("test")).toBe(false)
        })
    })
})

describe("RuleRegistry", () => {
    let registry: RuleRegistry

    beforeEach(() => {
        registry = new RuleRegistry()
    })

    it("should register and retrieve rules", () => {
        const mockRule: NamedRule = Object.assign(() => true, {
            ruleName: "premium",
            check: () => true,
        })

        registry.register("premium", mockRule)

        const retrieved = registry.get("premium")
        expect(retrieved).toBe(mockRule)
        expect(retrieved?.ruleName).toBe("premium")
    })

    it("should check if rule exists", () => {
        const mockRule: NamedRule = Object.assign(() => true, {
            ruleName: "test",
            check: () => true,
        })

        expect(registry.has("test")).toBe(false)
        registry.register("test", mockRule)
        expect(registry.has("test")).toBe(true)
    })

    it("should return all rules as a copy", () => {
        const rule1: NamedRule = Object.assign(() => true, {
            ruleName: "rule1",
            check: () => true,
        })
        const rule2: NamedRule = Object.assign(() => false, {
            ruleName: "rule2",
            check: () => false,
        })

        registry.register("rule1", rule1)
        registry.register("rule2", rule2)

        const all = registry.getAll()
        expect(all.size).toBe(2)
        expect(all.get("rule1")).toBe(rule1)
        expect(all.get("rule2")).toBe(rule2)

        // Should be a copy (modifying doesn't affect internal)
        all.delete("rule1")
        expect(registry.has("rule1")).toBe(true)
    })

    it("should clear all rules", () => {
        const mockRule: NamedRule = Object.assign(() => true, {
            ruleName: "test",
            check: () => true,
        })
        registry.register("test", mockRule)

        registry.clear()

        expect(registry.has("test")).toBe(false)
        expect(registry.getAll().size).toBe(0)
    })
})

describe("PluginManager", () => {
    let manager: PluginManager

    beforeEach(() => {
        manager = new PluginManager()
    })

    describe("Factory Registration", () => {
        it("should register and retrieve factories", () => {
            const factory = vi.fn((opts?: { setting: boolean }) => ({
                meta: { id: "test", name: "Test", version: "1.0.0" },
            })) as any

            manager.registerFactory("test", factory)

            const retrieved = manager.getFactory("test")
            expect(retrieved).toBe(factory)
        })

        it("should throw on duplicate factory registration", () => {
            const factory = vi.fn() as any
            manager.registerFactory("test", factory)

            expect(() => manager.registerFactory("test", factory)).toThrow(
                'Plugin factory "test" is already registered'
            )
        })

        it("should create plugins from factory", () => {
            const mockPlugin = {
                meta: { id: "auth", name: "Auth", version: "1.0.0" },
            }
            const factory = vi.fn(() => mockPlugin) as any

            manager.registerFactory("auth", factory)

            const created = manager.createFromFactory("auth", { secretKey: "abc" })
            expect(created).toBe(mockPlugin)
            expect(factory).toHaveBeenCalledWith({ secretKey: "abc" })
        })
    })

    describe("Instance Registration", () => {
        const createMockPlugin = (id: string): NevrPlugin => ({
            meta: { id, name: id, version: "1.0.0" },
        })

        it("should register and retrieve plugin instances", () => {
            const plugin = createMockPlugin("payments")

            manager.registerInstance(plugin)

            const retrieved = manager.getInstance("payments")
            expect(retrieved).toBe(plugin)
        })

        it("should throw on duplicate instance registration", () => {
            const plugin = createMockPlugin("payments")
            manager.registerInstance(plugin)

            expect(() => manager.registerInstance(plugin)).toThrow(
                'Plugin "payments" is already registered'
            )
        })

        it("should return all registered instances", () => {
            manager.registerInstance(createMockPlugin("a"))
            manager.registerInstance(createMockPlugin("b"))
            manager.registerInstance(createMockPlugin("c"))

            const all = manager.getAllInstances()
            expect(all).toHaveLength(3)
            expect(all.map((p) => p.meta.id)).toEqual(["a", "b", "c"])
        })

        it("should track initialization status", () => {
            manager.registerInstance(createMockPlugin("test"))

            expect(manager.isInitialized("test")).toBe(false)

            manager.markInitialized("test")

            expect(manager.isInitialized("test")).toBe(true)
        })
    })

    describe("Entity Resolution", () => {
        it("should parse entity references", () => {
            manager.registerInstance({
                meta: { id: "auth", name: "Auth", version: "1.0.0" },
            })

            const ref = manager.getEntityRef("auth.user")
            expect(ref).toEqual({ pluginId: "auth", entityName: "user" })
        })

        it("should return undefined for invalid refs", () => {
            expect(manager.getEntityRef("invalid")).toBeUndefined()
            expect(manager.getEntityRef("unregistered.entity")).toBeUndefined()
        })

        it("should cache and retrieve entities", () => {
            const mockEntity = { name: "user", config: {} }

            manager.cacheEntity("auth.user", mockEntity)

            expect(manager.getCachedEntity("auth.user")).toBe(mockEntity)
            expect(manager.getCachedEntity("other.entity")).toBeUndefined()
        })
    })

    describe("Clear", () => {
        it("should clear all state", () => {
            manager.registerFactory("factory", vi.fn() as any)
            manager.registerInstance({
                meta: { id: "plugin", name: "Plugin", version: "1.0.0" },
            })
            manager.cacheEntity("test.entity", {})

            manager.clear()

            expect(manager.getFactory("factory")).toBeUndefined()
            expect(manager.getInstance("plugin")).toBeUndefined()
            expect(manager.getCachedEntity("test.entity")).toBeUndefined()
        })
    })
})

describe("Context Integration", () => {
    it("should provide full isolation between contexts", () => {
        const ctx1 = createNevrContext()
        const ctx2 = createNevrContext()

        // Add different data to each context
        ctx1.services.registerInstance("shared", { value: "ctx1" })
        ctx2.services.registerInstance("shared", { value: "ctx2" })

        const rule1: NamedRule = Object.assign(() => true, {
            ruleName: "rule1",
            check: () => true,
        })
        const rule2: NamedRule = Object.assign(() => false, {
            ruleName: "rule2",
            check: () => false,
        })

        ctx1.rules.register("myrule", rule1)
        ctx2.rules.register("myrule", rule2)

        ctx1.plugins.registerInstance({
            meta: { id: "p1", name: "P1", version: "1.0.0" },
        })
        ctx2.plugins.registerInstance({
            meta: { id: "p2", name: "P2", version: "1.0.0" },
        })

        // Verify isolation
        expect((ctx1.services.resolve("shared") as any).value).toBe("ctx1")
        expect((ctx2.services.resolve("shared") as any).value).toBe("ctx2")

        expect(ctx1.rules.get("myrule")?.ruleName).toBe("rule1")
        expect(ctx2.rules.get("myrule")?.ruleName).toBe("rule2")

        expect(ctx1.plugins.getInstance("p1")).toBeDefined()
        expect(ctx1.plugins.getInstance("p2")).toBeUndefined()
        expect(ctx2.plugins.getInstance("p2")).toBeDefined()
        expect(ctx2.plugins.getInstance("p1")).toBeUndefined()
    })
})
