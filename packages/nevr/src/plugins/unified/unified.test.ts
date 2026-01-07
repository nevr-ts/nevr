import { describe, it, expect, beforeEach, vi } from "vitest"
import {
    // Types
    type UnifiedPlugin,
    type UnifiedPluginMeta,
    type LifecycleHooks,
    type EntityHooks,
    type InterceptorContext,
    // Type guards
    isNewPlugin,
    isUnifiedPlugin,
    // Normalization
    normalizeNewPlugin,
    normalizePlugin,
    normalizePlugins,
    validateUnifiedPlugin,
    // Lifecycle
    LifecycleManager,
    getLifecycleManager,
    setLifecycleManager,
    clearLifecycleManager,
    registerAndInitializePlugins,
    // Helpers
    matchPath,
    matchPrefix,
    matchRegex,
    matchAll,
    matchAnyOf,
} from "./index.js"
import type { NevrInstance, NevrRequest } from "../../types.js"

// =============================================================================
// Test Utilities
// =============================================================================

const mockNevrInstance = {
    entities: {},
    driver: {},
    options: {},
} as unknown as NevrInstance

const mockRequest = {
    method: "GET",
    path: "/test",
    headers: {},
    user: { id: "user-1", role: "admin" },
} as unknown as NevrRequest

// =============================================================================
// Type Guards Tests
// =============================================================================

describe("Type Guards", () => {
    describe("isNewPlugin", () => {
        it("should detect new-style plugins with meta.id", () => {
            const newPlugin = {
                meta: { id: "new-plugin", name: "New", version: "1.0.0" },
                requestHooks: {},
            }
            expect(isNewPlugin(newPlugin)).toBe(true)
        })

        it("should not detect invalid plugins as new", () => {
            const invalid = {
                name: "invalid-plugin",
            }
            expect(isNewPlugin(invalid)).toBe(false)
        })
    })

    describe("isUnifiedPlugin", () => {
        it("should detect unified plugins with lifecycle hooks", () => {
            const unified: UnifiedPlugin = {
                meta: { id: "test", name: "Test", version: "1.0.0" },
                lifecycle: { onInit: async () => { } },
            }
            expect(isUnifiedPlugin(unified)).toBe(true)
        })

        it("should detect unified plugins with interceptors", () => {
            const unified: UnifiedPlugin = {
                meta: { id: "test", name: "Test", version: "1.0.0" },
                interceptors: {
                    before: [{ matcher: "/test", handler: async () => { } }],
                },
            }
            expect(isUnifiedPlugin(unified)).toBe(true)
        })

        it("should detect unified plugins with entityHooks", () => {
            const unified: UnifiedPlugin = {
                meta: { id: "test", name: "Test", version: "1.0.0" },
                entityHooks: {
                    user: { create: { before: async () => { } } },
                },
            }
            expect(isUnifiedPlugin(unified)).toBe(true)
        })
    })
})

// =============================================================================
// Normalization Tests
// =============================================================================

describe("Normalization", () => {
    describe("normalizeNewPlugin", () => {
        it("should normalize a new-style plugin", () => {
            const newPlugin = {
                meta: { id: "new-test", name: "New Test", version: "2.0.0" },
                schema: {
                    entities: {
                        user: { fields: { name: { type: "string" } } },
                    },
                },
            }

            const unified = normalizeNewPlugin(newPlugin as any)

            expect(unified.meta.id).toBe("new-test")
            expect(unified.schema?.entities?.user).toBeDefined()
        })

        it("should convert requestHooks to interceptors", () => {
            const handler = vi.fn()
            const newPlugin = {
                meta: { id: "hooks-test", name: "Hooks Test", version: "1.0.0" },
                requestHooks: {
                    before: [{ matcher: () => true, handler }],
                },
            }

            const unified = normalizeNewPlugin(newPlugin as any)

            expect(unified.interceptors?.before).toBeDefined()
            expect(unified.interceptors?.before?.[0].handler).toBe(handler)
        })
    })

    describe("normalizePlugin (universal)", () => {
        it("should normalize new-style plugins", () => {
            const newPlugin = {
                meta: { id: "new", name: "New", version: "1.0.0" },
                requestHooks: {},
            }
            const unified = normalizePlugin(newPlugin as any)
            expect(unified.meta.id).toBe("new")
        })

        it("should normalize unified plugins", () => {
            const unified: UnifiedPlugin = {
                meta: { id: "unified", name: "Unified", version: "1.0.0" },
                lifecycle: { onInit: async () => { } },
            }
            const result = normalizePlugin(unified)
            expect(result.meta.id).toBe("unified")
        })
    })

    describe("normalizePlugins (array)", () => {
        it("should normalize an array of plugins", () => {
            const plugins = [
                { meta: { id: "new1", name: "New 1", version: "1.0.0" } },
                { meta: { id: "new2", name: "New 2", version: "1.0.0" } },
                {
                    meta: { id: "unified", name: "Unified", version: "1.0.0" },
                    lifecycle: {},
                },
            ]

            const result = normalizePlugins(plugins as any)

            expect(result).toHaveLength(3)
            expect(result[0].meta.id).toBe("new1")
            expect(result[1].meta.id).toBe("new2")
            expect(result[2].meta.id).toBe("unified")
        })
    })
})

// =============================================================================
// Validation Tests
// =============================================================================

describe("Validation", () => {
    describe("validateUnifiedPlugin", () => {
        it("should pass for valid plugins", () => {
            const plugin: UnifiedPlugin = {
                meta: { id: "valid", name: "Valid", version: "1.0.0" },
            }
            const errors = validateUnifiedPlugin(plugin)
            expect(errors).toHaveLength(0)
        })

        it("should fail for missing meta.id", () => {
            const plugin = { meta: { name: "Test", version: "1.0.0" } }
            const errors = validateUnifiedPlugin(plugin as any)
            expect(errors).toContain("Plugin must have meta.id")
        })

        it("should fail for missing meta.name", () => {
            const plugin = { meta: { id: "test", version: "1.0.0" } }
            const errors = validateUnifiedPlugin(plugin as any)
            expect(errors).toContain("Plugin must have meta.name")
        })

        it("should fail for missing meta.version", () => {
            const plugin = { meta: { id: "test", name: "Test" } }
            const errors = validateUnifiedPlugin(plugin as any)
            expect(errors).toContain("Plugin must have meta.version")
        })
    })
})

// =============================================================================
// Lifecycle Manager Tests
// =============================================================================

describe("LifecycleManager", () => {
    let manager: LifecycleManager

    beforeEach(() => {
        manager = new LifecycleManager()
        clearLifecycleManager()
    })

    describe("register", () => {
        it("should register a plugin and call onRegister", async () => {
            const onRegister = vi.fn()
            const plugin: UnifiedPlugin = {
                meta: { id: "test", name: "Test", version: "1.0.0" },
                lifecycle: { onRegister },
            }

            await manager.register(plugin, mockNevrInstance)

            expect(onRegister).toHaveBeenCalledWith(mockNevrInstance)
            expect(manager.getPlugins()).toContain(plugin)
        })
    })

    describe("initialize", () => {
        it("should call onInit for all registered plugins", async () => {
            const onInit1 = vi.fn()
            const onInit2 = vi.fn()

            const plugin1: UnifiedPlugin = {
                meta: { id: "p1", name: "P1", version: "1.0.0" },
                lifecycle: { onInit: onInit1 },
            }
            const plugin2: UnifiedPlugin = {
                meta: { id: "p2", name: "P2", version: "1.0.0" },
                lifecycle: { onInit: onInit2 },
            }

            await manager.register(plugin1, mockNevrInstance)
            await manager.register(plugin2, mockNevrInstance)
            await manager.initialize(mockNevrInstance)

            expect(onInit1).toHaveBeenCalled()
            expect(onInit2).toHaveBeenCalled()
        })

        it("should initialize plugins in dependency order", async () => {
            const callOrder: string[] = []

            const pluginA: UnifiedPlugin = {
                meta: { id: "a", name: "A", version: "1.0.0", dependencies: ["b"] },
                lifecycle: {
                    onInit: async () => {
                        callOrder.push("a")
                    },
                },
            }
            const pluginB: UnifiedPlugin = {
                meta: { id: "b", name: "B", version: "1.0.0" },
                lifecycle: {
                    onInit: async () => {
                        callOrder.push("b")
                    },
                },
            }

            // Register in wrong order
            await manager.register(pluginA, mockNevrInstance)
            await manager.register(pluginB, mockNevrInstance)
            await manager.initialize(mockNevrInstance)

            // B should be called before A
            expect(callOrder).toEqual(["b", "a"])
        })

        it("should detect circular dependencies", async () => {
            const pluginA: UnifiedPlugin = {
                meta: { id: "a", name: "A", version: "1.0.0", dependencies: ["b"] },
            }
            const pluginB: UnifiedPlugin = {
                meta: { id: "b", name: "B", version: "1.0.0", dependencies: ["a"] },
            }

            await manager.register(pluginA, mockNevrInstance)
            await manager.register(pluginB, mockNevrInstance)

            await expect(manager.initialize(mockNevrInstance)).rejects.toThrow(
                /[Cc]ircular/
            )
        })
    })

    describe("shutdown", () => {
        it("should call onShutdown for all plugins in reverse order", async () => {
            const callOrder: string[] = []

            const plugin1: UnifiedPlugin = {
                meta: { id: "p1", name: "P1", version: "1.0.0" },
                lifecycle: {
                    onShutdown: async () => {
                        callOrder.push("p1")
                    },
                },
            }
            const plugin2: UnifiedPlugin = {
                meta: { id: "p2", name: "P2", version: "1.0.0" },
                lifecycle: {
                    onShutdown: async () => {
                        callOrder.push("p2")
                    },
                },
            }

            await manager.register(plugin1, mockNevrInstance)
            await manager.register(plugin2, mockNevrInstance)
            await manager.shutdown(mockNevrInstance)

            // Should be in reverse order
            expect(callOrder).toEqual(["p2", "p1"])
        })
    })

    describe("onRequest", () => {
        it("should call onRequest for all plugins", async () => {
            const onRequest1 = vi.fn()
            const onRequest2 = vi.fn()

            const plugin1: UnifiedPlugin = {
                meta: { id: "p1", name: "P1", version: "1.0.0" },
                lifecycle: { onRequest: onRequest1 },
            }
            const plugin2: UnifiedPlugin = {
                meta: { id: "p2", name: "P2", version: "1.0.0" },
                lifecycle: { onRequest: onRequest2 },
            }

            await manager.register(plugin1, mockNevrInstance)
            await manager.register(plugin2, mockNevrInstance)
            await manager.onRequest(mockRequest, mockNevrInstance)

            expect(onRequest1).toHaveBeenCalledWith(mockRequest, mockNevrInstance)
            expect(onRequest2).toHaveBeenCalledWith(mockRequest, mockNevrInstance)
        })
    })

    describe("onError", () => {
        it("should call onError for all plugins", async () => {
            const onError1 = vi.fn()
            const onError2 = vi.fn()
            const error = new Error("Test error")

            const plugin1: UnifiedPlugin = {
                meta: { id: "p1", name: "P1", version: "1.0.0" },
                lifecycle: { onError: onError1 },
            }
            const plugin2: UnifiedPlugin = {
                meta: { id: "p2", name: "P2", version: "1.0.0" },
                lifecycle: { onError: onError2 },
            }

            await manager.register(plugin1, mockNevrInstance)
            await manager.register(plugin2, mockNevrInstance)
            await manager.onError(error, mockRequest, mockNevrInstance)

            expect(onError1).toHaveBeenCalledWith(error, mockRequest, mockNevrInstance)
            expect(onError2).toHaveBeenCalledWith(error, mockRequest, mockNevrInstance)
        })
    })

    describe("executeBeforeInterceptors", () => {
        it("should execute matching before interceptors", async () => {
            const handler1 = vi.fn()
            const handler2 = vi.fn()

            const plugin: UnifiedPlugin = {
                meta: { id: "test", name: "Test", version: "1.0.0" },
                interceptors: {
                    before: [
                        { matcher: "/test", handler: handler1 },
                        { matcher: "/other", handler: handler2 },
                    ],
                },
            }

            await manager.register(plugin, mockNevrInstance)

            const ctx: InterceptorContext = {
                path: "/test",
                method: "GET",
                headers: {},
                params: {},
                query: {},
                body: undefined,
                context: {
                    nevr: mockNevrInstance,
                    driver: mockNevrInstance.driver,
                },
                setHeader: vi.fn(),
                getResponseHeaders: vi.fn(() => ({})),
            }

            await manager.executeBeforeInterceptors(ctx)

            expect(handler1).toHaveBeenCalled()
            expect(handler2).not.toHaveBeenCalled()
        })

        it("should support regex matchers", async () => {
            const handler = vi.fn()

            const plugin: UnifiedPlugin = {
                meta: { id: "test", name: "Test", version: "1.0.0" },
                interceptors: {
                    before: [{ matcher: /^\/api\//, handler }],
                },
            }

            await manager.register(plugin, mockNevrInstance)

            const ctx: InterceptorContext = {
                path: "/api/users",
                method: "GET",
                headers: {},
                params: {},
                query: {},
                body: undefined,
                context: {
                    nevr: mockNevrInstance,
                    driver: mockNevrInstance.driver,
                },
                setHeader: vi.fn(),
                getResponseHeaders: vi.fn(() => ({})),
            }

            await manager.executeBeforeInterceptors(ctx)

            expect(handler).toHaveBeenCalled()
        })

        it("should support function matchers", async () => {
            const handler = vi.fn()

            const plugin: UnifiedPlugin = {
                meta: { id: "test", name: "Test", version: "1.0.0" },
                interceptors: {
                    before: [
                        {
                            matcher: (ctx) => ctx.method === "POST",
                            handler,
                        },
                    ],
                },
            }

            await manager.register(plugin, mockNevrInstance)

            const ctx: InterceptorContext = {
                path: "/test",
                method: "POST",
                headers: {},
                params: {},
                query: {},
                body: undefined,
                context: {
                    nevr: mockNevrInstance,
                    driver: mockNevrInstance.driver,
                },
                setHeader: vi.fn(),
                getResponseHeaders: vi.fn(() => ({})),
            }

            await manager.executeBeforeInterceptors(ctx)

            expect(handler).toHaveBeenCalled()
        })
    })
})

// =============================================================================
// Global Lifecycle Manager Tests
// =============================================================================

describe("Global Lifecycle Manager", () => {
    beforeEach(() => {
        clearLifecycleManager()
    })

    it("should create a singleton instance", () => {
        const manager1 = getLifecycleManager()
        const manager2 = getLifecycleManager()
        expect(manager1).toBe(manager2)
    })

    it("should allow setting a custom manager", () => {
        const customManager = new LifecycleManager()
        setLifecycleManager(customManager)
        expect(getLifecycleManager()).toBe(customManager)
    })

    it("should clear the manager", () => {
        const manager1 = getLifecycleManager()
        clearLifecycleManager()
        const manager2 = getLifecycleManager()
        expect(manager1).not.toBe(manager2)
    })
})

// =============================================================================
// Helper Functions Tests
// =============================================================================

describe("Helper Functions", () => {
    describe("Path Matchers", () => {
        describe("matchPath", () => {
            it("should create exact string matcher", () => {
                const matcher = matchPath("/exact")
                expect(matcher({ path: "/exact" })).toBe(true)
                expect(matcher({ path: "/other" })).toBe(false)
            })

            it("should create glob pattern matcher", () => {
                const matcher = matchPath("/api/*")
                expect(matcher({ path: "/api/users" })).toBe(true)
                expect(matcher({ path: "/other" })).toBe(false)
            })

            it("should accept regex", () => {
                const matcher = matchPath(/^\/admin\//)
                expect(matcher({ path: "/admin/users" })).toBe(true)
                expect(matcher({ path: "/users" })).toBe(false)
            })

            it("should accept function", () => {
                const matcher = matchPath((ctx) => ctx.path.includes("test"))
                expect(matcher({ path: "/test/path" })).toBe(true)
                expect(matcher({ path: "/other" })).toBe(false)
            })
        })

        describe("matchPrefix", () => {
            it("should match paths starting with prefix", () => {
                const matcher = matchPrefix("/api")
                expect(matcher({ path: "/api/users" })).toBe(true)
                expect(matcher({ path: "/api" })).toBe(true)
                expect(matcher({ path: "/other" })).toBe(false)
            })
        })

        describe("matchRegex", () => {
            it("should match regex pattern", () => {
                const matcher = matchRegex(/^\/v\d+\//)
                expect(matcher({ path: "/v1/users" })).toBe(true)
                expect(matcher({ path: "/v2/posts" })).toBe(true)
                expect(matcher({ path: "/users" })).toBe(false)
            })
        })

        describe("matchAll", () => {
            it("should combine matchers with AND", () => {
                const matcher = matchAll(matchPrefix("/api"), (ctx) =>
                    ctx.path.includes("users")
                )
                expect(matcher({ path: "/api/users" })).toBe(true)
                expect(matcher({ path: "/api/posts" })).toBe(false)
                expect(matcher({ path: "/other/users" })).toBe(false)
            })
        })

        describe("matchAnyOf", () => {
            it("should combine matchers with OR", () => {
                const matcher = matchAnyOf(matchPrefix("/api"), matchPrefix("/admin"))
                expect(matcher({ path: "/api/users" })).toBe(true)
                expect(matcher({ path: "/admin/dashboard" })).toBe(true)
                expect(matcher({ path: "/other" })).toBe(false)
            })
        })
    })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("Integration", () => {
    beforeEach(() => {
        clearLifecycleManager()
    })

    describe("registerAndInitializePlugins", () => {
        it("should register and initialize multiple plugins", async () => {
            const callOrder: string[] = []

            const plugins: UnifiedPlugin[] = [
                {
                    meta: { id: "first", name: "First", version: "1.0.0" },
                    lifecycle: {
                        onRegister: async () => { callOrder.push("first-register") },
                        onInit: async () => { callOrder.push("first-init") },
                    },
                },
                {
                    meta: { id: "second", name: "Second", version: "1.0.0" },
                    lifecycle: {
                        onRegister: async () => { callOrder.push("second-register") },
                        onInit: async () => { callOrder.push("second-init") },
                    },
                },
            ]

            const normalizedPlugins = await registerAndInitializePlugins(
                plugins,
                mockNevrInstance
            )

            expect(callOrder).toContain("first-register")
            expect(callOrder).toContain("second-register")
            expect(callOrder).toContain("first-init")
            expect(callOrder).toContain("second-init")
            expect(normalizedPlugins).toHaveLength(2)
        })

        it("should handle multiple plugins", async () => {
            const plugins = [
                { meta: { id: "first", name: "First", version: "1.0.0" } },
                { meta: { id: "second", name: "Second", version: "1.0.0" } },
                {
                    meta: { id: "third", name: "Third", version: "1.0.0" },
                    lifecycle: { onInit: vi.fn() },
                },
            ]

            const normalizedPlugins = await registerAndInitializePlugins(
                plugins as any,
                mockNevrInstance
            )

            expect(normalizedPlugins).toHaveLength(3)
        })
    })

    describe("End-to-End Plugin Flow", () => {
        it("should handle complete plugin lifecycle", async () => {
            const events: string[] = []

            const instance: UnifiedPlugin = {
                meta: { id: "e2e", name: "E2E Test", version: "1.0.0" },
                lifecycle: {
                    onRegister: async () => { events.push("register") },
                    onInit: async () => { events.push("init") },
                    onRequest: async () => { events.push("request") },
                    onError: async () => { events.push("error") },
                    onShutdown: async () => { events.push("shutdown") },
                },
                interceptors: {
                    before: [
                        {
                            matcher: "/test",
                            handler: async () => { events.push("before-intercept") },
                        },
                    ],
                    after: [
                        {
                            matcher: "/test",
                            handler: async () => { events.push("after-intercept") },
                        },
                    ],
                },
            }

            const manager = new LifecycleManager()
            await manager.register(instance, mockNevrInstance)
            expect(events).toContain("register")

            await manager.initialize(mockNevrInstance)
            expect(events).toContain("init")

            await manager.onRequest(mockRequest, mockNevrInstance)
            expect(events).toContain("request")

            const ctx: InterceptorContext = {
                path: "/test",
                method: "GET",
                headers: {},
                params: {},
                query: {},
                body: undefined,
                context: {
                    nevr: mockNevrInstance,
                    driver: mockNevrInstance.driver,
                },
                setHeader: vi.fn(),
                getResponseHeaders: vi.fn(() => ({})),
            }

            await manager.executeBeforeInterceptors(ctx)
            expect(events).toContain("before-intercept")

            await manager.executeAfterInterceptors(ctx)
            expect(events).toContain("after-intercept")

            await manager.onError(new Error("test"), mockRequest, mockNevrInstance)
            expect(events).toContain("error")

            await manager.shutdown(mockNevrInstance)
            expect(events).toContain("shutdown")
        })
    })
})

// =============================================================================
// Part 8: Architectural Improvements Tests
// =============================================================================

describe("Part 8: Architectural Improvements", () => {
    let manager: LifecycleManager

    beforeEach(() => {
        manager = new LifecycleManager()
        clearLifecycleManager()
    })

    describe("Rich Dependencies", () => {
        it("should support string dependency format (backward compatible)", async () => {
            const pluginA: UnifiedPlugin = {
                meta: { id: "a", name: "A", version: "1.0.0", dependencies: ["b"] },
            }
            const pluginB: UnifiedPlugin = {
                meta: { id: "b", name: "B", version: "1.0.0" },
            }

            await manager.register(pluginA, mockNevrInstance)
            await manager.register(pluginB, mockNevrInstance)
            await manager.initialize(mockNevrInstance)

            expect(manager.isInitialized("a")).toBe(true)
            expect(manager.isInitialized("b")).toBe(true)
        })

        it("should support rich dependency format with version", async () => {
            const pluginA: UnifiedPlugin = {
                meta: {
                    id: "a",
                    name: "A",
                    version: "1.0.0",
                    dependencies: [{ id: "b", version: "^1.0.0" }],
                },
            }
            const pluginB: UnifiedPlugin = {
                meta: { id: "b", name: "B", version: "1.2.0" },
            }

            await manager.register(pluginA, mockNevrInstance)
            await manager.register(pluginB, mockNevrInstance)
            await manager.initialize(mockNevrInstance)

            expect(manager.isInitialized("a")).toBe(true)
            expect(manager.isInitialized("b")).toBe(true)
        })

        it("should throw for incompatible versions", async () => {
            const pluginA: UnifiedPlugin = {
                meta: {
                    id: "a",
                    name: "A",
                    version: "1.0.0",
                    dependencies: [{ id: "b", version: "^2.0.0" }],
                },
            }
            const pluginB: UnifiedPlugin = {
                meta: { id: "b", name: "B", version: "1.5.0" },
            }

            await manager.register(pluginA, mockNevrInstance)
            await manager.register(pluginB, mockNevrInstance)

            await expect(manager.initialize(mockNevrInstance)).rejects.toThrow(
                /requires "b" version/
            )
        })

        it("should skip optional missing dependencies", async () => {
            const pluginA: UnifiedPlugin = {
                meta: {
                    id: "a",
                    name: "A",
                    version: "1.0.0",
                    dependencies: [{ id: "optional-plugin", optional: true }],
                },
                lifecycle: {
                    onInit: vi.fn(),
                },
            }

            await manager.register(pluginA, mockNevrInstance)
            await manager.initialize(mockNevrInstance)

            // Should not throw for missing optional dependency
            expect(manager.isInitialized("a")).toBe(true)
            expect(pluginA.lifecycle?.onInit).toHaveBeenCalled()
        })

        it("should still throw for missing required dependencies", async () => {
            const pluginA: UnifiedPlugin = {
                meta: {
                    id: "a",
                    name: "A",
                    version: "1.0.0",
                    dependencies: [{ id: "required-plugin", optional: false }],
                },
            }

            await manager.register(pluginA, mockNevrInstance)

            await expect(manager.initialize(mockNevrInstance)).rejects.toThrow(
                /depends on missing plugin/
            )
        })

        it("should support semver ~ constraint", async () => {
            const pluginA: UnifiedPlugin = {
                meta: {
                    id: "a",
                    name: "A",
                    version: "1.0.0",
                    dependencies: [{ id: "b", version: "~1.2.0" }],
                },
            }
            const pluginB: UnifiedPlugin = {
                meta: { id: "b", name: "B", version: "1.2.5" },
            }

            await manager.register(pluginA, mockNevrInstance)
            await manager.register(pluginB, mockNevrInstance)
            await manager.initialize(mockNevrInstance)

            expect(manager.isInitialized("a")).toBe(true)
        })

        it("should support >= constraint", async () => {
            const pluginA: UnifiedPlugin = {
                meta: {
                    id: "a",
                    name: "A",
                    version: "1.0.0",
                    dependencies: [{ id: "b", version: ">=1.0.0" }],
                },
            }
            const pluginB: UnifiedPlugin = {
                meta: { id: "b", name: "B", version: "2.0.0" },
            }

            await manager.register(pluginA, mockNevrInstance)
            await manager.register(pluginB, mockNevrInstance)
            await manager.initialize(mockNevrInstance)

            expect(manager.isInitialized("a")).toBe(true)
        })
    })

    describe("Hot Reload", () => {
        it("should hot reload a plugin with onHotReload hook", async () => {
            const onHotReload = vi.fn()
            const plugin: UnifiedPlugin = {
                meta: { id: "hot", name: "Hot", version: "1.0.0" },
                options: { value: "original" },
                lifecycle: { onHotReload },
            }

            await manager.register(plugin, mockNevrInstance)

            const success = await manager.hotReload(
                "hot",
                { value: "updated" },
                mockNevrInstance
            )

            expect(success).toBe(true)
            expect(onHotReload).toHaveBeenCalledWith(
                mockNevrInstance,
                { value: "updated" }
            )
            expect(plugin.options?.value).toBe("updated")
        })

        it("should return false for plugins without onHotReload", async () => {
            const plugin: UnifiedPlugin = {
                meta: { id: "no-hot", name: "No Hot", version: "1.0.0" },
            }

            await manager.register(plugin, mockNevrInstance)

            const success = await manager.hotReload(
                "no-hot",
                { value: "new" },
                mockNevrInstance
            )

            expect(success).toBe(false)
        })

        it("should throw for non-existent plugin", async () => {
            await expect(
                manager.hotReload("nonexistent", {}, mockNevrInstance)
            ).rejects.toThrow(/Plugin not found/)
        })

        it("should hot reload all supporting plugins", async () => {
            const onHotReload1 = vi.fn()
            const onHotReload2 = vi.fn()

            const plugin1: UnifiedPlugin = {
                meta: { id: "hot1", name: "Hot1", version: "1.0.0" },
                lifecycle: { onHotReload: onHotReload1 },
            }
            const plugin2: UnifiedPlugin = {
                meta: { id: "hot2", name: "Hot2", version: "1.0.0" },
                lifecycle: { onHotReload: onHotReload2 },
            }
            const plugin3: UnifiedPlugin = {
                meta: { id: "no-hot", name: "No Hot", version: "1.0.0" },
            }

            await manager.register(plugin1, mockNevrInstance)
            await manager.register(plugin2, mockNevrInstance)
            await manager.register(plugin3, mockNevrInstance)

            const results = await manager.hotReloadAll(
                {
                    hot1: { a: 1 },
                    hot2: { b: 2 },
                    "no-hot": { c: 3 },
                },
                mockNevrInstance
            )

            expect(results.get("hot1")).toBe(true)
            expect(results.get("hot2")).toBe(true)
            expect(results.get("no-hot")).toBe(false)
        })

        it("should list hot reloadable plugins", async () => {
            const plugin1: UnifiedPlugin = {
                meta: { id: "hot", name: "Hot", version: "1.0.0" },
                lifecycle: { onHotReload: vi.fn() },
            }
            const plugin2: UnifiedPlugin = {
                meta: { id: "no-hot", name: "No Hot", version: "1.0.0" },
            }

            await manager.register(plugin1, mockNevrInstance)
            await manager.register(plugin2, mockNevrInstance)

            const hotReloadable = manager.getHotReloadablePlugins()

            expect(hotReloadable).toHaveLength(1)
            expect(hotReloadable[0].meta.id).toBe("hot")
        })
    })
})
