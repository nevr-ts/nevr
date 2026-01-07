// =============================================================================
// FACADE TESTS
// Tests for the unified plugin facade API
// =============================================================================

import { describe, it, expect, beforeEach } from "vitest"
import {
    createPlugin,
    createPluginFactory,
    createLifecyclePlugin,
    createEntityHooksPlugin,
    createInterceptorPlugin,
    detectPluginType,
    isValidPlugin,
    processPlugin,
    processPlugins,
} from "./facade.js"
import type { UnifiedPlugin } from "./types.js"

describe("Plugin Facade", () => {
    describe("createPlugin", () => {
        it("should create a basic plugin", () => {
            const plugin = createPlugin({
                id: "test",
                name: "Test Plugin",
                version: "1.0.0",
            })

            expect(plugin.meta.id).toBe("test")
            expect(plugin.meta.name).toBe("Test Plugin")
            expect(plugin.meta.version).toBe("1.0.0")
        })

        it("should create plugin with all options", () => {
            const plugin = createPlugin({
                id: "full-plugin",
                name: "Full Plugin",
                version: "2.0.0",
                description: "A complete plugin",
                author: "Test Author",
                homepage: "https://example.com",
                dependencies: ["dep1", "dep2"],
                basePath: "/api/v1",
            })

            expect(plugin.meta.description).toBe("A complete plugin")
            expect(plugin.meta.author).toBe("Test Author")
            expect(plugin.meta.homepage).toBe("https://example.com")
            expect(plugin.meta.dependencies).toEqual(["dep1", "dep2"])
            expect(plugin.meta.basePath).toBe("/api/v1")
        })

        it("should throw on invalid plugin ID", () => {
            expect(() => createPlugin({
                id: "Invalid-ID",  // Uppercase not allowed
                name: "Test",
                version: "1.0.0",
            })).toThrow("Invalid plugin")
        })

        it("should throw on reserved plugin ID", () => {
            expect(() => createPlugin({
                id: "nevr",  // Reserved
                name: "Test",
                version: "1.0.0",
            })).toThrow("reserved")
        })

        it("should create plugin with lifecycle hooks", () => {
            const onInit = async () => { }
            const onRequest = async () => { }

            const plugin = createPlugin({
                id: "lifecycle-test",
                name: "Lifecycle Test",
                version: "1.0.0",
                lifecycle: {
                    onInit,
                    onRequest,
                }
            })

            expect(plugin.lifecycle?.onInit).toBe(onInit)
            expect(plugin.lifecycle?.onRequest).toBe(onRequest)
        })

        it("should create plugin with entity hooks", () => {
            const beforeCreate = async () => { }

            const plugin = createPlugin({
                id: "hooks-test",
                name: "Hooks Test",
                version: "1.0.0",
                entityHooks: {
                    user: {
                        create: {
                            before: beforeCreate
                        }
                    }
                }
            })

            expect(plugin.entityHooks?.user?.create?.before).toBe(beforeCreate)
        })
    })

    describe("createPluginFactory", () => {
        it("should create a factory that produces plugins", () => {
            interface MyOptions {
                timeout: number
            }

            const factory = createPluginFactory<MyOptions>((options) => ({
                id: "factory-plugin",
                name: "Factory Plugin",
                version: "1.0.0",
                options,
            }))

            const plugin = factory({ timeout: 5000 })

            expect(plugin.meta.id).toBe("factory-plugin")
            expect((plugin as any).options?.timeout).toBe(5000)
        })
    })

    describe("createLifecyclePlugin", () => {
        it("should create a plugin with lifecycle hooks", () => {
            const onInit = async () => { }

            const plugin = createLifecyclePlugin({
                id: "lc-plugin",
                name: "Lifecycle Plugin",
                version: "1.0.0",
                onInit,
            })

            expect(plugin.meta.id).toBe("lc-plugin")
            expect(plugin.lifecycle?.onInit).toBe(onInit)
        })
    })

    describe("createEntityHooksPlugin", () => {
        it("should create a plugin with entity hooks", () => {
            const beforeCreate = async () => { }

            const plugin = createEntityHooksPlugin({
                id: "eh-plugin",
                name: "Entity Hooks Plugin",
                version: "1.0.0",
                hooks: {
                    "*": {
                        create: {
                            before: beforeCreate
                        }
                    }
                }
            })

            expect(plugin.meta.id).toBe("eh-plugin")
            expect(plugin.entityHooks?.["*"]?.create?.before).toBe(beforeCreate)
        })
    })

    describe("createInterceptorPlugin", () => {
        it("should create a plugin with interceptors", () => {
            const handler = async () => { }

            const plugin = createInterceptorPlugin({
                id: "int-plugin",
                name: "Interceptor Plugin",
                version: "1.0.0",
                before: [{
                    matcher: "**",
                    handler,
                }]
            })

            expect(plugin.meta.id).toBe("int-plugin")
            expect(plugin.interceptors?.before).toHaveLength(1)
            expect(plugin.interceptors?.before?.[0].handler).toBe(handler)
        })
    })

    describe("detectPluginType", () => {
        it("should detect unified plugin", () => {
            const plugin = createPlugin({
                id: "test",
                name: "Test",
                version: "1.0.0",
            })

            expect(detectPluginType(plugin)).toBe("unified")
        })

        it("should return unknown for invalid plugins", () => {
            const invalidPlugin = {
                name: "Invalid Plugin",
                setup: () => { },
            }

            expect(detectPluginType(invalidPlugin)).toBe("unknown")
        })

        it("should return unknown for invalid input", () => {
            expect(detectPluginType(null)).toBe("unknown")
            expect(detectPluginType({})).toBe("unknown")
            expect(detectPluginType("string")).toBe("unknown")
        })
    })

    describe("isValidPlugin", () => {
        it("should return true for valid plugins", () => {
            const unified = createPlugin({
                id: "test",
                name: "Test",
                version: "1.0.0",
            })

            expect(isValidPlugin(unified)).toBe(true)
        })

        it("should return false for invalid plugins", () => {
            const invalid = { name: "Invalid", setup: () => { } }

            expect(isValidPlugin(invalid)).toBe(false)
        })

        it("should return false for invalid input", () => {
            expect(isValidPlugin(null)).toBe(false)
            expect(isValidPlugin({})).toBe(false)
            expect(isValidPlugin("string")).toBe(false)
        })
    })

    describe("processPlugin", () => {
        it("should process and normalize plugins", () => {
            const plugin = createPlugin({
                id: "test",
                name: "Test",
                version: "1.0.0",
            })

            const result = processPlugin(plugin)

            expect(result.normalized.meta.id).toBe("test")
            expect(result.type).toBe("unified")
            expect(result.errors).toHaveLength(0)
        })

        it("should return errors for invalid plugins", () => {
            const invalidPlugin = {
                meta: { id: "INVALID", name: "", version: "" }
            } as any

            const result = processPlugin(invalidPlugin)

            expect(result.errors.length).toBeGreaterThan(0)
        })
    })

    describe("processPlugins", () => {
        it("should process multiple plugins", () => {
            const plugins = [
                createPlugin({ id: "a", name: "A", version: "1.0.0" }),
                createPlugin({ id: "b", name: "B", version: "1.0.0" }),
            ]

            const result = processPlugins(plugins)

            expect(result.normalized).toHaveLength(2)
            expect(result.errors.size).toBe(0)
        })
    })
})
