
import { describe, it, expect } from "vitest"
import { validateInput } from "./validation.js"
import { entity, resolveEntity } from "./entity.js"
import { string } from "./fields.js"
import type { Entity } from "./types.js"

// Mock Zod-like Schema
const mockZodSchema = {
    safeParse: (val: unknown) => {
        if (typeof val === "string" && val.includes("zod")) {
            return { success: true, data: val }
        }
        return {
            success: false,
            error: {
                errors: [
                    { message: "Must include 'zod'" }
                ]
            }
        }
    }
}

describe("Validation DX (Zod Integration)", () => {
    it("should execute zod schema validation", () => {
        // 1. Define Entity with .zod() using the factory helper
        const userBuilder = entity("user", {
            username: string.zod(mockZodSchema)
        })

        // Resolve it to a plain Entity object
        const userEntity = resolveEntity(userBuilder)

        // 2. Validate Invalid
        const invalidResult = validateInput(userEntity, { username: "bad" }, "create")
        expect(invalidResult.valid).toBe(false)
        expect(invalidResult.errors.length).toBeGreaterThan(0)
        expect(invalidResult.errors[0].message).toBe("Must include 'zod'")

        // 3. Validate Valid
        const validResult = validateInput(userEntity, { username: "i_love_zod" }, "create")
        expect(validResult.valid).toBe(true)
        expect(validResult.errors).toHaveLength(0)
    })
})
