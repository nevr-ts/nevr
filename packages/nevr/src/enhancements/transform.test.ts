// =============================================================================
// TRANSFORM ENHANCEMENT TESTS
// Tests for string transforms: trim, lower, upper
// =============================================================================

import { describe, it, expect } from "vitest"
import { entity, string, text, int } from "../index.js"
import {
  transformField,
  transformData,
  hasTransforms,
  getTransformFields,
} from "./transform.js"

// -----------------------------------------------------------------------------
// Test Entities
// -----------------------------------------------------------------------------

const userEntity = entity("user", {
  email: string.trim().lower(),
  username: string.trim(),
  displayName: string,
  bio: text.trim(),
  code: string.upper(),
  age: int,
})

const simpleEntity = entity("simple", {
  name: string,
  value: int,
})

// -----------------------------------------------------------------------------
// transformField Tests
// -----------------------------------------------------------------------------

describe("transformField", () => {
  describe("trim transform", () => {
    it("should trim leading whitespace", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { trim: true } }
      expect(transformField("  hello", fieldDef)).toBe("hello")
    })

    it("should trim trailing whitespace", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { trim: true } }
      expect(transformField("hello  ", fieldDef)).toBe("hello")
    })

    it("should trim both leading and trailing whitespace", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { trim: true } }
      expect(transformField("  hello world  ", fieldDef)).toBe("hello world")
    })

    it("should handle strings with only whitespace", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { trim: true } }
      expect(transformField("   ", fieldDef)).toBe("")
    })

    it("should preserve internal whitespace", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { trim: true } }
      expect(transformField("  hello   world  ", fieldDef)).toBe("hello   world")
    })
  })

  describe("lower transform", () => {
    it("should convert uppercase to lowercase", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { lower: true } }
      expect(transformField("HELLO", fieldDef)).toBe("hello")
    })

    it("should convert mixed case to lowercase", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { lower: true } }
      expect(transformField("HeLLo WoRLD", fieldDef)).toBe("hello world")
    })

    it("should handle already lowercase strings", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { lower: true } }
      expect(transformField("hello", fieldDef)).toBe("hello")
    })

    it("should handle strings with numbers and symbols", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { lower: true } }
      expect(transformField("USER123@EXAMPLE.COM", fieldDef)).toBe("user123@example.com")
    })
  })

  describe("upper transform", () => {
    it("should convert lowercase to uppercase", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { upper: true } }
      expect(transformField("hello", fieldDef)).toBe("HELLO")
    })

    it("should convert mixed case to uppercase", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { upper: true } }
      expect(transformField("HeLLo WoRLD", fieldDef)).toBe("HELLO WORLD")
    })

    it("should handle already uppercase strings", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { upper: true } }
      expect(transformField("HELLO", fieldDef)).toBe("HELLO")
    })

    it("should handle strings with numbers and symbols", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { upper: true } }
      expect(transformField("code-abc-123", fieldDef)).toBe("CODE-ABC-123")
    })
  })

  describe("combined transforms", () => {
    it("should apply trim then lower", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { trim: true, lower: true } }
      expect(transformField("  HELLO WORLD  ", fieldDef)).toBe("hello world")
    })

    it("should apply trim then upper", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { trim: true, upper: true } }
      expect(transformField("  hello world  ", fieldDef)).toBe("HELLO WORLD")
    })

    it("should handle all transforms (upper takes precedence over lower)", () => {
      // When both lower and upper are set, both are applied in order: lower then upper
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { trim: true, lower: true, upper: true } }
      expect(transformField("  Hello  ", fieldDef)).toBe("HELLO")
    })
  })

  describe("edge cases", () => {
    it("should return non-string values unchanged", () => {
      const fieldDef = { type: "int" as const, optional: false, unique: false, transforms: { trim: true } }
      expect(transformField(123, fieldDef)).toBe(123)
      expect(transformField(null, fieldDef)).toBe(null)
      expect(transformField(undefined, fieldDef)).toBe(undefined)
      expect(transformField(true, fieldDef)).toBe(true)
    })

    it("should return value unchanged when no transforms", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false }
      expect(transformField("  HELLO  ", fieldDef)).toBe("  HELLO  ")
    })

    it("should return value unchanged when transforms is empty", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: {} }
      expect(transformField("  HELLO  ", fieldDef)).toBe("  HELLO  ")
    })

    it("should handle empty string", () => {
      const fieldDef = { type: "string" as const, optional: false, unique: false, transforms: { trim: true, lower: true } }
      expect(transformField("", fieldDef)).toBe("")
    })
  })
})

// -----------------------------------------------------------------------------
// transformData Tests
// -----------------------------------------------------------------------------

describe("transformData", () => {
  it("should transform multiple fields in an entity", () => {
    const data = {
      email: "  USER@EXAMPLE.COM  ",
      username: "  john_doe  ",
      displayName: "John Doe",
      code: "abc123",
    }

    const result = transformData(data, userEntity)

    expect(result.email).toBe("user@example.com")
    expect(result.username).toBe("john_doe")
    expect(result.displayName).toBe("John Doe") // no transforms
    expect(result.code).toBe("ABC123")
  })

  it("should only transform fields present in data", () => {
    const data = {
      email: "  TEST@EXAMPLE.COM  ",
    }

    const result = transformData(data, userEntity)

    expect(result.email).toBe("test@example.com")
    expect(result.username).toBeUndefined()
  })

  it("should preserve non-transformed fields", () => {
    const data = {
      email: "  TEST@EXAMPLE.COM  ",
      age: 25,
    }

    const result = transformData(data, userEntity)

    expect(result.email).toBe("test@example.com")
    expect(result.age).toBe(25)
  })

  it("should return copy of data for entity without transforms", () => {
    const data = {
      name: "  Test  ",
      value: 42,
    }

    const result = transformData(data, simpleEntity)

    expect(result.name).toBe("  Test  ")
    expect(result.value).toBe(42)
    expect(result).not.toBe(data) // should be a copy
  })

  it("should handle empty data object", () => {
    const data = {}
    const result = transformData(data, userEntity)
    expect(result).toEqual({})
  })

  it("should handle null and undefined values", () => {
    const data = {
      email: null,
      username: undefined,
      code: "test",
    }

    const result = transformData(data, userEntity)

    expect(result.email).toBeNull()
    expect(result.username).toBeUndefined()
    expect(result.code).toBe("TEST")
  })
})

// -----------------------------------------------------------------------------
// hasTransforms Tests
// -----------------------------------------------------------------------------

describe("hasTransforms", () => {
  it("should return true for entity with transform fields", () => {
    expect(hasTransforms(userEntity)).toBe(true)
  })

  it("should return false for entity without transform fields", () => {
    expect(hasTransforms(simpleEntity)).toBe(false)
  })

  it("should return true if at least one field has transforms", () => {
    const mixedEntity = entity("mixed", {
      name: string,
      email: string.lower(),
      age: int,
    })
    expect(hasTransforms(mixedEntity)).toBe(true)
  })
})

// -----------------------------------------------------------------------------
// getTransformFields Tests
// -----------------------------------------------------------------------------

describe("getTransformFields", () => {
  it("should return list of fields with transforms", () => {
    const fields = getTransformFields(userEntity)

    expect(fields).toContain("email")
    expect(fields).toContain("username")
    expect(fields).toContain("bio")
    expect(fields).toContain("code")
    expect(fields).not.toContain("displayName")
    expect(fields).not.toContain("age")
  })

  it("should return empty array for entity without transforms", () => {
    const fields = getTransformFields(simpleEntity)
    expect(fields).toEqual([])
  })
})

// -----------------------------------------------------------------------------
// FieldBuilder Transform Methods Tests
// -----------------------------------------------------------------------------

describe("FieldBuilder transform methods", () => {
  it("should create trim transform via .trim()", () => {
    const field = string.trim()._build()
    expect(field.transforms?.trim).toBe(true)
  })

  it("should create lower transform via .lower()", () => {
    const field = string.lower()._build()
    expect(field.transforms?.lower).toBe(true)
  })

  it("should create upper transform via .upper()", () => {
    const field = string.upper()._build()
    expect(field.transforms?.upper).toBe(true)
  })

  it("should chain multiple transforms", () => {
    const field = string.trim().lower()._build()
    expect(field.transforms?.trim).toBe(true)
    expect(field.transforms?.lower).toBe(true)
  })

  it("should chain transforms with other modifiers", () => {
    const field = string.trim().lower().optional().unique()._build()
    expect(field.transforms?.trim).toBe(true)
    expect(field.transforms?.lower).toBe(true)
    expect(field.optional).toBe(true)
    expect(field.unique).toBe(true)
  })

  it("should not mutate original builder", () => {
    const original = string
    const trimmed = original.trim()
    const lowered = original.lower()

    expect(original._build().transforms).toBeUndefined()
    expect(trimmed._build().transforms?.trim).toBe(true)
    expect(trimmed._build().transforms?.lower).toBeUndefined()
    expect(lowered._build().transforms?.lower).toBe(true)
    expect(lowered._build().transforms?.trim).toBeUndefined()
  })
})
