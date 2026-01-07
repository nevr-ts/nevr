// =============================================================================
// UTILS TEST
// Tests for string utility functions
// =============================================================================

import { describe, it, expect } from "vitest"
import {
  capitalize,
  pascalCase,
  camelCase,
  kebabCase,
  snakeCase,
  isValidIdentifier,
  isValidEntityName,
} from "./index.js"

describe("String Utilities", () => {
  describe("capitalize", () => {
    it("should capitalize the first letter", () => {
      expect(capitalize("hello")).toBe("Hello")
      expect(capitalize("world")).toBe("World")
    })

    it("should handle already capitalized strings", () => {
      expect(capitalize("Hello")).toBe("Hello")
    })

    it("should handle single character", () => {
      expect(capitalize("a")).toBe("A")
    })

    it("should handle empty string", () => {
      expect(capitalize("")).toBe("")
    })

    it("should not modify the rest of the string", () => {
      expect(capitalize("helloWORLD")).toBe("HelloWORLD")
    })
  })

  describe("pascalCase", () => {
    it("should convert to PascalCase", () => {
      expect(pascalCase("hello")).toBe("Hello")
      expect(pascalCase("hello-world")).toBe("HelloWorld")
      expect(pascalCase("hello_world")).toBe("HelloWorld")
      expect(pascalCase("hello world")).toBe("HelloWorld")
    })

    it("should handle already PascalCase", () => {
      expect(pascalCase("HelloWorld")).toBe("HelloWorld")
    })

    it("should handle camelCase input", () => {
      expect(pascalCase("helloWorld")).toBe("HelloWorld")
    })

    it("should handle empty string", () => {
      expect(pascalCase("")).toBe("")
    })
  })

  describe("camelCase", () => {
    it("should convert to camelCase", () => {
      expect(camelCase("hello")).toBe("hello")
      expect(camelCase("hello-world")).toBe("helloWorld")
      expect(camelCase("hello_world")).toBe("helloWorld")
      expect(camelCase("hello world")).toBe("helloWorld")
    })

    it("should handle PascalCase input", () => {
      expect(camelCase("HelloWorld")).toBe("helloWorld")
    })

    it("should handle already camelCase", () => {
      expect(camelCase("helloWorld")).toBe("helloWorld")
    })

    it("should handle empty string", () => {
      expect(camelCase("")).toBe("")
    })
  })

  describe("kebabCase", () => {
    it("should convert to kebab-case", () => {
      expect(kebabCase("helloWorld")).toBe("hello-world")
      expect(kebabCase("HelloWorld")).toBe("hello-world")
      expect(kebabCase("hello_world")).toBe("hello-world")
    })

    it("should handle already kebab-case", () => {
      expect(kebabCase("hello-world")).toBe("hello-world")
    })

    it("should handle single word", () => {
      expect(kebabCase("hello")).toBe("hello")
    })

    it("should handle empty string", () => {
      expect(kebabCase("")).toBe("")
    })
  })

  describe("snakeCase", () => {
    it("should convert to snake_case", () => {
      expect(snakeCase("helloWorld")).toBe("hello_world")
      expect(snakeCase("HelloWorld")).toBe("hello_world")
      expect(snakeCase("hello-world")).toBe("hello_world")
    })

    it("should handle already snake_case", () => {
      expect(snakeCase("hello_world")).toBe("hello_world")
    })

    it("should handle single word", () => {
      expect(snakeCase("hello")).toBe("hello")
    })

    it("should handle empty string", () => {
      expect(snakeCase("")).toBe("")
    })
  })

  describe("isValidIdentifier", () => {
    it("should accept valid identifiers", () => {
      expect(isValidIdentifier("user")).toBe(true)
      expect(isValidIdentifier("User")).toBe(true)
      expect(isValidIdentifier("user123")).toBe(true)
      expect(isValidIdentifier("UserProfile")).toBe(true)
    })

    it("should reject invalid identifiers", () => {
      expect(isValidIdentifier("123user")).toBe(false)
      expect(isValidIdentifier("hello-world")).toBe(false)
      expect(isValidIdentifier("hello world")).toBe(false)
      expect(isValidIdentifier("")).toBe(false)
      expect(isValidIdentifier("_user")).toBe(false) // current impl doesn't support underscore prefix
      expect(isValidIdentifier("$user")).toBe(false) // current impl doesn't support dollar prefix
    })
  })

  describe("isValidEntityName", () => {
    it("should accept valid entity names (lowercase first)", () => {
      expect(isValidEntityName("user")).toBe(true)
      expect(isValidEntityName("userProfile")).toBe(true)
    })

    it("should reject invalid entity names", () => {
      expect(isValidEntityName("123user")).toBe(false)
      expect(isValidEntityName("user-profile")).toBe(false)
      expect(isValidEntityName("user profile")).toBe(false)
      expect(isValidEntityName("")).toBe(false)
      expect(isValidEntityName("User")).toBe(false) // must start with lowercase
      expect(isValidEntityName("user_profile")).toBe(false) // no underscores allowed
    })
  })
})
