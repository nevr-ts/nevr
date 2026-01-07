// =============================================================================
// ENTITY-SCHEMA TESTS
// Tests for unified entity actions architecture
// =============================================================================

import { describe, it, expect } from "vitest"
import { entity, string, int, action } from "../../index.js"
import { defineSchema, schemaFromEntities, entitiesToSchema } from "./entity-schema.js"

describe("Entity to Plugin Schema Conversion", () => {
    describe("entitiesToSchema", () => {
        it("carries over entity actions to plugin schema", () => {
            const order = entity("order", {
                total: int,
                status: string,
            })
                .actions({
                    checkout: action("checkout")
                        .post()
                        .onResource()
                        .rules("owner")
                        .input({ paymentMethod: string })
                        .meta({ summary: "Process checkout" }),
                    cancel: action("cancel")
                        .post()
                        .onResource()
                        .rules("admin"),
                })
                .timestamps(false)
                .build()

            const schema = entitiesToSchema([order])

            // Actions should be preserved
            expect(schema.entities?.order?.actions).toBeDefined()
            expect(schema.entities?.order?.actions?.checkout).toBeDefined()
            expect(schema.entities?.order?.actions?.cancel).toBeDefined()
            expect(schema.entities?.order?.actions?.checkout?.method).toBe("POST")
            expect(schema.entities?.order?.actions?.checkout?.metadata?.summary).toBe("Process checkout")
        })

        it("carries over entity rules to plugin schema", () => {
            const secret = entity("secret", {
                data: string,
            })
                .rules({
                    create: ["authenticated"],
                    read: ["owner"],
                    update: ["owner"],
                    delete: ["admin"],
                })
                .timestamps(false)
                .build()

            const schema = entitiesToSchema([secret])

            // Rules should be preserved
            expect(schema.entities?.secret?.rules).toBeDefined()
            expect(schema.entities?.secret?.rules?.create).toContain("authenticated")
            expect(schema.entities?.secret?.rules?.read).toContain("owner")
            expect(schema.entities?.secret?.rules?.delete).toContain("admin")
        })

        it("marks entities as internal when specified", () => {
            const session = entity("session", {
                token: string,
            })
                .timestamps(false)
                .build()

            const schema = entitiesToSchema([session], { internal: ["session"] })

            expect(schema.entities?.session?.internal).toBe(true)
        })
    })

    describe("defineSchema builder", () => {
        it("preserves actions when building schema from entities", () => {
            const user = entity("user", {
                email: string.unique(),
            })
                .actions({
                    verify: action("verify")
                        .post()
                        .onResource()
                        .rules("authenticated"),
                })
                .timestamps(false)
                .build()

            const schema = defineSchema()
                .entity(user)
                .build()

            expect(schema.entities?.user?.actions).toBeDefined()
            expect(schema.entities?.user?.actions?.verify).toBeDefined()
        })

        it("preserves actions with internal flag", () => {
            const session = entity("session", {
                token: string,
            })
                .actions({
                    refresh: action("refresh")
                        .post()
                        .onResource(),
                })
                .timestamps(false)
                .build()

            const schema = defineSchema()
                .entity(session, { internal: true })
                .build()

            expect(schema.entities?.session?.actions?.refresh).toBeDefined()
            expect(schema.entities?.session?.internal).toBe(true)
        })
    })

    describe("schemaFromEntities helper", () => {
        it("preserves actions in quick schema conversion", () => {
            const payment = entity("payment", {
                amount: int,
            })
                .actions({
                    refund: action("refund")
                        .post()
                        .onResource()
                        .input({ reason: string.optional() }),
                })
                .timestamps(false)
                .build()

            const schema = schemaFromEntities([payment])

            expect(schema.entities?.payment?.actions?.refund).toBeDefined()
            expect(schema.entities?.payment?.actions?.refund?.input).toBeDefined()
        })
    })
})

// =============================================================================
// Full Entity-First Flow Tests
// Tests that entity actions flow through the entire plugin system
// =============================================================================

import { resolvePlugin } from "./resolver.js"
import type { NevrPlugin, PluginMeta, PluginSchema } from "./contract.js"

describe("Entity-First Plugin Resolution", () => {
    describe("resolvePlugin", () => {
        it("carries actions from plugin schema to resolved Nevr entities", () => {
            // Create entity with actions
            const userEntity = entity("user", {
                email: string.unique(),
            })
                .actions({
                    verify: action("verify")
                        .post()
                        .onResource()
                        .rules("owner")
                        .meta({ summary: "Verify user email" }),
                    deactivate: action("deactivate")
                        .post()
                        .onResource()
                        .rules("admin"),
                })
                .timestamps(false)
                .build()

            // Convert to plugin schema
            const schema = schemaFromEntities([userEntity])

            // Create plugin
            const plugin: NevrPlugin = {
                meta: {
                    id: "test",
                    name: "Test Plugin",
                    version: "1.0.0",
                },
                schema,
            }

            // Resolve plugin
            const resolved = resolvePlugin(plugin)

            // Find the user entity
            const resolvedUser = resolved.entities.find(e => e.name === "user")
            expect(resolvedUser).toBeDefined()

            // Actions should be on the resolved Nevr entity
            expect(resolvedUser?.config.actions).toBeDefined()
            expect(resolvedUser?.config.actions?.verify).toBeDefined()
            expect(resolvedUser?.config.actions?.verify.method).toBe("POST")
            expect(resolvedUser?.config.actions?.verify.requiresId).toBe(true)
            expect(resolvedUser?.config.actions?.verify.metadata?.summary).toBe("Verify user email")
            expect(resolvedUser?.config.actions?.deactivate).toBeDefined()
        })

        it("carries rules from plugin schema to resolved Nevr entities", () => {
            const secretEntity = entity("secret", {
                data: string,
            })
                .rules({
                    create: ["authenticated"],
                    read: ["owner"],
                    delete: ["admin"],
                })
                .timestamps(false)
                .build()

            const schema = schemaFromEntities([secretEntity])

            const plugin: NevrPlugin = {
                meta: {
                    id: "secrets",
                    name: "Secrets Plugin",
                    version: "1.0.0",
                },
                schema,
            }

            const resolved = resolvePlugin(plugin)

            const resolvedSecret = resolved.entities.find(e => e.name === "secret")
            expect(resolvedSecret).toBeDefined()

            // Rules should be on the resolved Nevr entity
            expect(resolvedSecret?.config.rules?.create).toContain("authenticated")
            expect(resolvedSecret?.config.rules?.read).toContain("owner")
            expect(resolvedSecret?.config.rules?.delete).toContain("admin")
        })

        it("supports full auth-like plugin pattern with entity actions", () => {
            // This mimics how auth plugin SHOULD work with Entity-First
            const authUserEntity = entity("user", {
                email: string.unique(),
                password: string,
                emailVerified: string.default("false"),
            })
                .actions({
                    // Instead of routes, define as actions!
                    signIn: action("sign-in")
                        .post()
                        .input({ email: string, password: string })
                        .meta({
                            summary: "Sign in with email and password",
                            tags: ["Authentication"],
                        }),
                    signUp: action("sign-up")
                        .post()
                        .input({
                            email: string,
                            password: string,
                            name: string.optional(),
                        })
                        .meta({
                            summary: "Create a new user account",
                            tags: ["Authentication"],
                        }),
                    verifyEmail: action("verify-email")
                        .post()
                        .onResource()
                        .rules("owner")
                        .meta({
                            summary: "Verify user email address",
                            tags: ["Authentication"],
                        }),
                })
                .timestamps(false)
                .build()

            const sessionEntity = entity("session", {
                token: string.unique(),
                userId: string,
            })
                .timestamps(false)
                .build()

            // Build plugin using Entity-First approach
            const schema = schemaFromEntities(
                [authUserEntity, sessionEntity],
                { internal: ["session"] }
            )

            const authPlugin: NevrPlugin = {
                meta: {
                    id: "auth",
                    name: "Authentication",
                    version: "1.0.0",
                    basePath: "/auth",
                },
                schema,
            }

            const resolved = resolvePlugin(authPlugin)

            // Check basePath
            expect(resolved.basePath).toBe("/auth")

            // Check user entity has actions
            const resolvedUser = resolved.entities.find(e => e.name === "user")
            expect(resolvedUser?.config.actions?.signIn).toBeDefined()
            expect(resolvedUser?.config.actions?.signUp).toBeDefined()
            expect(resolvedUser?.config.actions?.verifyEmail).toBeDefined()

            // signIn and signUp are collection actions (no ID)
            expect(resolvedUser?.config.actions?.signIn?.requiresId).toBe(false)
            expect(resolvedUser?.config.actions?.signUp?.requiresId).toBe(false)

            // verifyEmail is a resource action (needs ID)
            expect(resolvedUser?.config.actions?.verifyEmail?.requiresId).toBe(true)

            // Check session entity is internal
            const resolvedSession = resolved.entities.find(e => e.name === "session")
            expect(resolved.entityMeta.get("session")?.internal).toBe(true)
        })
    })
})

