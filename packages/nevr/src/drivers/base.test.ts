// =============================================================================
// DRIVER FACTORY TESTS
// Tests for the driver factory pattern
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Driver, Where } from "../types.js"

// -----------------------------------------------------------------------------
// Mock Driver Implementation (Simple In-Memory)
// -----------------------------------------------------------------------------

function createMockDriver(): Driver {
  const store = new Map<string, Map<string, Record<string, unknown>>>()
  let idCounter = 1

  const getStore = (model: string): Map<string, Record<string, unknown>> => {
    if (!store.has(model)) {
      store.set(model, new Map())
    }
    return store.get(model)!
  }

  return {
    name: "mock",

    async create<T>(entity: string, data: Record<string, unknown>): Promise<T> {
      const modelStore = getStore(entity)
      const id = String(idCounter++)
      const record = { id, ...data } as T
      modelStore.set(id, record as Record<string, unknown>)
      return record
    },

    async findOne<T>(entity: string, where: Where): Promise<T | null> {
      const modelStore = getStore(entity)

      for (const record of modelStore.values()) {
        let matches = true
        for (const [key, value] of Object.entries(where)) {
          if (record[key] !== value) {
            matches = false
            break
          }
        }
        if (matches) return record as T
      }

      return null
    },

    async findMany<T>(entity: string, options: { where?: Where; take?: number; skip?: number } = {}): Promise<T[]> {
      const modelStore = getStore(entity)
      let results = Array.from(modelStore.values()) as T[]

      if (options.where) {
        results = results.filter((record: any) => {
          for (const [key, value] of Object.entries(options.where!)) {
            if (record[key] !== value) return false
          }
          return true
        })
      }

      if (options.skip) {
        results = results.slice(options.skip)
      }

      if (options.take) {
        results = results.slice(0, options.take)
      }

      return results
    },

    async update<T>(entity: string, where: Where, data: Record<string, unknown>): Promise<T> {
      const modelStore = getStore(entity)

      for (const [id, record] of modelStore.entries()) {
        let matches = true
        for (const [key, value] of Object.entries(where)) {
          if (record[key] !== value) {
            matches = false
            break
          }
        }
        if (matches) {
          const updated = { ...record, ...data }
          modelStore.set(id, updated)
          return updated as T
        }
      }

      throw new Error("Record not found")
    },

    async delete(entity: string, where: Where): Promise<void> {
      const modelStore = getStore(entity)

      for (const [id, record] of modelStore.entries()) {
        let matches = true
        for (const [key, value] of Object.entries(where)) {
          if (record[key] !== value) {
            matches = false
            break
          }
        }
        if (matches) {
          modelStore.delete(id)
          return
        }
      }
    },

    async count(entity: string, where?: Where): Promise<number> {
      const modelStore = getStore(entity)

      if (!where) {
        return modelStore.size
      }

      let count = 0
      for (const record of modelStore.values()) {
        let matches = true
        for (const [key, value] of Object.entries(where)) {
          if (record[key] !== value) {
            matches = false
            break
          }
        }
        if (matches) count++
      }

      return count
    },
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("Driver Interface", () => {
  let driver: Driver

  beforeEach(() => {
    driver = createMockDriver()
  })

  describe("create()", () => {
    it("should create a record", async () => {
      const user = await driver.create<{ id: string; name: string; email: string }>(
        "User",
        { name: "John", email: "john@example.com" }
      )

      expect(user).toHaveProperty("id")
      expect(user.name).toBe("John")
      expect(user.email).toBe("john@example.com")
    })

    it("should create multiple records with unique IDs", async () => {
      const user1 = await driver.create<{ id: string }>("User", { name: "User 1" })
      const user2 = await driver.create<{ id: string }>("User", { name: "User 2" })

      expect(user1.id).not.toBe(user2.id)
    })
  })

  describe("findOne()", () => {
    it("should find a record by ID", async () => {
      const created = await driver.create<{ id: string; name: string }>("User", {
        name: "John",
      })

      const found = await driver.findOne<{ id: string; name: string }>("User", {
        id: created.id,
      })

      expect(found).not.toBeNull()
      expect(found?.name).toBe("John")
    })

    it("should return null if not found", async () => {
      const found = await driver.findOne("User", { id: "nonexistent" })
      expect(found).toBeNull()
    })

    it("should find by other fields", async () => {
      await driver.create("User", { name: "John", email: "john@example.com" })

      const found = await driver.findOne<{ name: string }>("User", {
        email: "john@example.com",
      })

      expect(found?.name).toBe("John")
    })
  })

  describe("findMany()", () => {
    beforeEach(async () => {
      await driver.create("Post", { title: "Post 1", published: true })
      await driver.create("Post", { title: "Post 2", published: false })
      await driver.create("Post", { title: "Post 3", published: true })
    })

    it("should find all records", async () => {
      const posts = await driver.findMany("Post")
      expect(posts).toHaveLength(3)
    })

    it("should filter by where clause", async () => {
      const posts = await driver.findMany("Post", {
        where: { published: true },
      })
      expect(posts).toHaveLength(2)
    })

    it("should limit results", async () => {
      const posts = await driver.findMany("Post", { take: 2 })
      expect(posts).toHaveLength(2)
    })

    it("should skip results", async () => {
      const posts = await driver.findMany("Post", { skip: 1 })
      expect(posts).toHaveLength(2)
    })
  })

  describe("update()", () => {
    it("should update a record", async () => {
      const created = await driver.create<{ id: string; name: string }>("User", {
        name: "John",
      })

      const updated = await driver.update<{ id: string; name: string }>("User", {
        id: created.id,
      }, { name: "Jane" })

      expect(updated?.name).toBe("Jane")
    })

    it("should return the updated record", async () => {
      const created = await driver.create<{ id: string }>("User", {
        name: "John",
        email: "john@example.com",
      })

      const updated = await driver.update<{ id: string; name: string; email: string }>(
        "User",
        { id: created.id },
        { name: "Jane" }
      )

      expect(updated?.email).toBe("john@example.com")
      expect(updated?.name).toBe("Jane")
    })
  })

  describe("delete()", () => {
    it("should delete a record", async () => {
      const created = await driver.create<{ id: string }>("User", { name: "John" })

      await driver.delete("User", { id: created.id })

      const found = await driver.findOne("User", { id: created.id })
      expect(found).toBeNull()
    })
  })

  describe("count()", () => {
    it("should count all records", async () => {
      await driver.create("User", { name: "User 1" })
      await driver.create("User", { name: "User 2" })
      await driver.create("User", { name: "User 3" })

      const count = await driver.count("User")
      expect(count).toBe(3)
    })

    it("should count with filter", async () => {
      await driver.create("User", { name: "John", active: true })
      await driver.create("User", { name: "Jane", active: false })
      await driver.create("User", { name: "Bob", active: true })

      const count = await driver.count("User", { active: true })
      expect(count).toBe(2)
    })
  })

  describe("driver name", () => {
    it("should have the correct name", () => {
      expect(driver.name).toBe("mock")
    })
  })
})
