import { describe, it, expect } from "vitest"
import {
    evaluatePolicy,
    canReadField,
    canWriteField,
    filterReadableFields,
    filterWritableFields,
    hasFieldAccessPolicies,
    getReadPolicyFields,
    getWritePolicyFields,
    getAccessPolicyFields,
    getFieldAccessSummary,
    FieldAccessDeniedError,
} from "./field-access.js"
import type { Entity, FieldDef, FieldAccessContext } from "../types.js"

// Helper to create test entity
function createTestEntity(fields: Record<string, FieldDef>): Entity {
    return {
        name: "testEntity",
        config: {
            fields,
            rules: { create: [], read: [], update: [], delete: [], list: [] },
            timestamps: false,
        },
    }
}

describe("Field Access Policies", () => {
    describe("evaluatePolicy", () => {
        const baseCtx: FieldAccessContext = {
            user: null,
            entity: "test",
            field: "testField",
            operation: "read",
        }

        it("should allow 'everyone' policy", async () => {
            expect(await evaluatePolicy("everyone", baseCtx)).toBe(true)
        })

        it("should deny 'none' policy", async () => {
            expect(await evaluatePolicy("none", baseCtx)).toBe(false)
        })

        it("should check 'authenticated' policy", async () => {
            expect(await evaluatePolicy("authenticated", baseCtx)).toBe(false)
            expect(await evaluatePolicy("authenticated", { ...baseCtx, user: { id: "1" } })).toBe(true)
        })

        it("should check 'admin' policy", async () => {
            expect(await evaluatePolicy("admin", { ...baseCtx, user: { id: "1", role: "user" } })).toBe(false)
            expect(await evaluatePolicy("admin", { ...baseCtx, user: { id: "1", role: "admin" } })).toBe(true)
            expect(await evaluatePolicy("admin", { ...baseCtx, user: { id: "1", isAdmin: true } })).toBe(true)
        })

        it("should check 'owner' policy", async () => {
            const ownerCtx: FieldAccessContext = {
                ...baseCtx,
                user: { id: "user_1" },
                data: { userId: "user_1" },
                resourceId: "res_1",
            }

            expect(await evaluatePolicy("owner", ownerCtx)).toBe(true)
            expect(await evaluatePolicy("owner", { ...ownerCtx, data: { userId: "other" } })).toBe(false)
        })

        it("should evaluate function policies", async () => {
            const policy = (ctx: FieldAccessContext) => ctx.user?.id === "special"

            expect(await evaluatePolicy(policy, { ...baseCtx, user: { id: "special" } })).toBe(true)
            expect(await evaluatePolicy(policy, { ...baseCtx, user: { id: "other" } })).toBe(false)
        })

        it("should handle async function policies", async () => {
            const policy = async (ctx: FieldAccessContext) => {
                await new Promise((r) => setTimeout(r, 10))
                return ctx.user !== null
            }

            expect(await evaluatePolicy(policy, { ...baseCtx, user: { id: "1" } })).toBe(true)
        })

        it("should deny when function policy throws", async () => {
            const policy = () => { throw new Error("Policy error") }

            expect(await evaluatePolicy(policy, baseCtx)).toBe(false)
        })
    })

    describe("canReadField / canWriteField", () => {
        const baseCtx = { user: null, entity: "test" }

        it("should allow read when no policy", async () => {
            const field: FieldDef = { type: "string", optional: false, unique: false }
            expect(await canReadField("name", field, baseCtx)).toBe(true)
        })

        it("should check read policy", async () => {
            const field: FieldDef = { type: "string", optional: false, unique: false, access: { read: "authenticated" } }

            expect(await canReadField("name", field, baseCtx)).toBe(false)
            expect(await canReadField("name", field, { ...baseCtx, user: { id: "1" } })).toBe(true)
        })

        it("should allow write when no policy", async () => {
            const field: FieldDef = { type: "string", optional: false, unique: false }
            expect(await canWriteField("name", field, baseCtx)).toBe(true)
        })

        it("should check write policy", async () => {
            const field: FieldDef = { type: "string", optional: false, unique: false, access: { write: "admin" } }

            expect(await canWriteField("name", field, { ...baseCtx, user: { id: "1", role: "user" } })).toBe(false)
            expect(await canWriteField("name", field, { ...baseCtx, user: { id: "1", role: "admin" } })).toBe(true)
        })
    })

    describe("filterReadableFields", () => {
        it("should keep readable fields", async () => {
            const entity = createTestEntity({
                name: { type: "string", optional: false, unique: false },
                email: { type: "string", optional: false, unique: false },
            })

            const result = await filterReadableFields(
                { name: "John", email: "john@test.com" },
                entity,
                { user: null }
            )

            expect(result).toEqual({ name: "John", email: "john@test.com" })
        })

        it("should remove fields with failing read policy", async () => {
            const entity = createTestEntity({
                name: { type: "string", optional: false, unique: false },
                secretField: { type: "string", optional: false, unique: false, access: { read: "admin" } },
            })

            const result = await filterReadableFields(
                { name: "John", secretField: "secret" },
                entity,
                { user: { id: "1", role: "user" } }
            )

            expect(result).toEqual({ name: "John" })
        })

        it("should keep fields not in entity definition", async () => {
            const entity = createTestEntity({ name: { type: "string", optional: false, unique: false } })

            const result = await filterReadableFields(
                { name: "John", computed: "value" },
                entity,
                { user: null }
            )

            expect(result.computed).toBe("value")
        })
    })

    describe("filterWritableFields", () => {
        it("should keep writable fields", async () => {
            const entity = createTestEntity({
                name: { type: "string", optional: false, unique: false },
                bio: { type: "string", optional: false, unique: false },
            })

            const result = await filterWritableFields(
                { name: "John", bio: "Hello" },
                entity,
                { user: { id: "1" } }
            )

            expect(result).toEqual({ name: "John", bio: "Hello" })
        })

        it("should remove fields with failing write policy", async () => {
            const entity = createTestEntity({
                name: { type: "string", optional: false, unique: false },
                role: { type: "string", optional: false, unique: false, access: { write: "admin" } },
            })

            const result = await filterWritableFields(
                { name: "John", role: "admin" },
                entity,
                { user: { id: "1", role: "user" } }
            )

            expect(result).toEqual({ name: "John" })
        })

        it("should throw when throwOnDenied is true", async () => {
            const entity = createTestEntity({
                role: { type: "string", optional: false, unique: false, access: { write: "admin" } },
            })

            await expect(
                filterWritableFields(
                    { role: "admin" },
                    entity,
                    { user: { id: "1", role: "user" } },
                    { throwOnDenied: true }
                )
            ).rejects.toThrow(FieldAccessDeniedError)
        })
    })

    describe("Utility Functions", () => {
        it("hasFieldAccessPolicies should detect policies", () => {
            const withPolicies = createTestEntity({
                secret: { type: "string", optional: false, unique: false, access: { read: "admin" } },
            })
            const withoutPolicies = createTestEntity({
                name: { type: "string", optional: false, unique: false },
            })

            expect(hasFieldAccessPolicies(withPolicies)).toBe(true)
            expect(hasFieldAccessPolicies(withoutPolicies)).toBe(false)
        })

        it("getReadPolicyFields should return read policy fields", () => {
            const entity = createTestEntity({
                name: { type: "string", optional: false, unique: false },
                secret: { type: "string", optional: false, unique: false, access: { read: "admin" } },
                password: { type: "string", optional: false, unique: false, access: { read: "none" } },
            })

            expect(getReadPolicyFields(entity)).toEqual(["secret", "password"])
        })

        it("getWritePolicyFields should return write policy fields", () => {
            const entity = createTestEntity({
                name: { type: "string", optional: false, unique: false },
                role: { type: "string", optional: false, unique: false, access: { write: "admin" } },
            })

            expect(getWritePolicyFields(entity)).toEqual(["role"])
        })

        it("getAccessPolicyFields should return all policy fields", () => {
            const entity = createTestEntity({
                name: { type: "string", optional: false, unique: false },
                secret: { type: "string", optional: false, unique: false, access: { read: "admin" } },
                role: { type: "string", optional: false, unique: false, access: { write: "admin" } },
            })

            const fields = getAccessPolicyFields(entity)
            expect(fields).toContain("secret")
            expect(fields).toContain("role")
        })

        it("getFieldAccessSummary should return policy summary", () => {
            const entity = createTestEntity({
                secret: { type: "string", optional: false, unique: false, access: { read: "admin", write: "none" } },
            })

            const summary = getFieldAccessSummary(entity)
            expect(summary.readPolicies.secret).toBe("admin")
            expect(summary.writePolicies.secret).toBe("none")
        })
    })

    describe("FieldAccessDeniedError", () => {
        it("should have correct properties", () => {
            const error = new FieldAccessDeniedError("email", "write", "admin only")

            expect(error.field).toBe("email")
            expect(error.operation).toBe("write")
            expect(error.reason).toBe("admin only")
            expect(error.message).toContain("email")
            expect(error.message).toContain("write")
        })
    })
})
