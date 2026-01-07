import { describe, it, expect, beforeEach } from "vitest"
import {
    validateCrossFields,
    CrossFieldValidationError,
    CrossFieldValidationErrors,
    hasCrossFieldValidators,
    getValidators,
    getValidatorsForOperation,
    getCrossFieldValidatedFields,
    runValidator,
} from "./cross-field-validation.js"
import type { Entity, EntityValidator } from "../types.js"

// Helper to create a test entity with validators
function createTestEntity(validators: EntityValidator[]): Entity {
    return {
        name: "testEntity",
        config: {
            fields: {
                password: { type: "string", optional: false, unique: false, hasDefault: false },
                confirmPassword: { type: "string", optional: false, unique: false, hasDefault: false },
                startDate: { type: "datetime", optional: false, unique: false, hasDefault: false },
                endDate: { type: "datetime", optional: false, unique: false, hasDefault: false },
                minPrice: { type: "float", optional: false, unique: false, hasDefault: false },
                maxPrice: { type: "float", optional: false, unique: false, hasDefault: false },
            },
            rules: { create: [], read: [], update: [], delete: [], list: [] },
            validators,
            timestamps: false,
        },
    }
}

describe("Cross-Field Validation", () => {
    describe("runValidator", () => {
        it("should return null when validator passes", async () => {
            const validator: EntityValidator = {
                fn: (data: any) => data.password === data.confirmPassword,
                message: "Passwords must match",
                fields: ["password", "confirmPassword"],
            }

            const result = await runValidator(validator, {
                password: "test123",
                confirmPassword: "test123",
            })

            expect(result).toBeNull()
        })

        it("should return error when validator fails", async () => {
            const validator: EntityValidator = {
                fn: (data: any) => data.password === data.confirmPassword,
                message: "Passwords must match",
                fields: ["password", "confirmPassword"],
            }

            const result = await runValidator(validator, {
                password: "test123",
                confirmPassword: "different",
            })

            expect(result).toBeInstanceOf(CrossFieldValidationError)
            expect(result?.message).toBe("Passwords must match")
        })

        it("should handle async validators", async () => {
            const validator: EntityValidator = {
                fn: async (data: any) => {
                    await new Promise((r) => setTimeout(r, 10))
                    return data.value > 0
                },
                message: "Value must be positive",
            }

            const result = await runValidator(validator, { value: 5 })
            expect(result).toBeNull()
        })

        it("should handle validator that throws", async () => {
            const validator: EntityValidator = {
                fn: () => { throw new Error("Something went wrong") },
                message: "Validation error",
            }

            const result = await runValidator(validator, {})
            expect(result?.message).toBe("Something went wrong")
        })
    })

    describe("validateCrossFields", () => {
        it("should pass when all validators pass", async () => {
            const entity = createTestEntity([
                {
                    fn: (data: any) => data.password === data.confirmPassword,
                    message: "Passwords must match",
                    fields: ["password", "confirmPassword"],
                },
            ])

            await expect(
                validateCrossFields(
                    { password: "test", confirmPassword: "test" },
                    entity,
                    "create"
                )
            ).resolves.toBeUndefined()
        })

        it("should throw when validators fail", async () => {
            const entity = createTestEntity([
                {
                    fn: (data: any) => data.password === data.confirmPassword,
                    message: "Passwords must match",
                },
            ])

            await expect(
                validateCrossFields(
                    { password: "a", confirmPassword: "b" },
                    entity,
                    "create"
                )
            ).rejects.toThrow(CrossFieldValidationErrors)
        })

        it("should collect multiple validation errors", async () => {
            const entity = createTestEntity([
                { fn: () => false, message: "Error 1" },
                { fn: () => false, message: "Error 2" },
            ])

            try {
                await validateCrossFields({}, entity, "create")
                expect.fail("Should have thrown")
            } catch (e) {
                expect(e).toBeInstanceOf(CrossFieldValidationErrors)
                expect((e as CrossFieldValidationErrors).errors).toHaveLength(2)
            }
        })

        it("should skip validators for different operations", async () => {
            const entity = createTestEntity([
                {
                    fn: () => false,
                    message: "Create only",
                    operations: ["create"],
                },
            ])

            // Should pass for update since validator is create-only
            await expect(
                validateCrossFields({}, entity, "update")
            ).resolves.toBeUndefined()
        })

        it("should skip validators if no relevant fields being updated", async () => {
            const entity = createTestEntity([
                {
                    fn: () => false,
                    message: "Date error",
                    fields: ["startDate", "endDate"],
                },
            ])

            // Updating unrelated field should pass
            await expect(
                validateCrossFields({ password: "new" }, entity, "update")
            ).resolves.toBeUndefined()
        })

        it("should merge existing data on update", async () => {
            let capturedData: any

            const entity = createTestEntity([
                {
                    fn: (data: any) => {
                        capturedData = data
                        return true
                    },
                    message: "Test",
                },
            ])

            await validateCrossFields(
                { password: "new" },
                entity,
                "update",
                { existingData: { confirmPassword: "old" } }
            )

            expect(capturedData).toEqual({
                password: "new",
                confirmPassword: "old",
            })
        })
    })

    describe("Utility Functions", () => {
        it("hasCrossFieldValidators should detect validators", () => {
            const withValidators = createTestEntity([
                { fn: () => true, message: "test" },
            ])
            const withoutValidators = createTestEntity([])

            expect(hasCrossFieldValidators(withValidators)).toBe(true)
            expect(hasCrossFieldValidators(withoutValidators)).toBe(false)
        })

        it("getValidators should return all validators", () => {
            const entity = createTestEntity([
                { fn: () => true, message: "v1" },
                { fn: () => true, message: "v2" },
            ])

            expect(getValidators(entity)).toHaveLength(2)
        })

        it("getValidatorsForOperation should filter by operation", () => {
            const entity = createTestEntity([
                { fn: () => true, message: "create only", operations: ["create"] },
                { fn: () => true, message: "update only", operations: ["update"] },
                { fn: () => true, message: "all operations" },
            ])

            expect(getValidatorsForOperation(entity, "create")).toHaveLength(2)
            expect(getValidatorsForOperation(entity, "update")).toHaveLength(2)
        })

        it("getCrossFieldValidatedFields should return unique fields", () => {
            const entity = createTestEntity([
                { fn: () => true, message: "v1", fields: ["password", "confirmPassword"] },
                { fn: () => true, message: "v2", fields: ["password", "startDate"] },
            ])

            const fields = getCrossFieldValidatedFields(entity)
            expect(fields).toContain("password")
            expect(fields).toContain("confirmPassword")
            expect(fields).toContain("startDate")
            expect(fields).toHaveLength(3)
        })
    })

    describe("CrossFieldValidationError", () => {
        it("should have correct properties", () => {
            const error = new CrossFieldValidationError("Test error", ["field1", "field2"])

            expect(error.message).toBe("Test error")
            expect(error.fields).toEqual(["field1", "field2"])
            expect(error.name).toBe("CrossFieldValidationError")
        })
    })

    describe("CrossFieldValidationErrors", () => {
        it("should aggregate error messages", () => {
            const errors = new CrossFieldValidationErrors([
                new CrossFieldValidationError("Error 1"),
                new CrossFieldValidationError("Error 2"),
            ])

            expect(errors.message).toContain("Error 1")
            expect(errors.message).toContain("Error 2")
            expect(errors.errors).toHaveLength(2)
        })
    })
})
