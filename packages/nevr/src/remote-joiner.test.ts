// =============================================================================
// REMOTE JOINER TESTS (Pillar 2: Link Engine)
// Tests for API-level stitching of cross-service data
// =============================================================================

import { describe, it, expect, vi } from "vitest"
import {
  RemoteJoiner,
  createRemoteJoiner,
  hasRemoteRelations,
  getRemoteRelationFields,
  splitIncludes,
} from "./remote-joiner.js"
import { entity } from "./entity.js"
import { string, int, belongsTo } from "./fields.js"
import { ServiceContainer } from "./container.js"
import type { Entity, Driver } from "./types.js"

// -----------------------------------------------------------------------------
// Mock Driver
// -----------------------------------------------------------------------------

function createMockDriver(): Driver {
  return {
    name: "test",
    create: vi.fn().mockResolvedValue({ id: "1" }),
    findOne: vi.fn().mockResolvedValue({ id: "1" }),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: "1" }),
    delete: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
  }
}

// -----------------------------------------------------------------------------
// Test Entities
// -----------------------------------------------------------------------------

const Subscription = entity("subscription", {
  planName: string,
  price: int,
}).build()

const User = entity("user", {
  email: string,
}).build()

// Entity with remote relation
const Post = entity("post", {
  title: string,
  authorId: string,
  // Local relation
  author: belongsTo(() => User),
}).build()

// Entity with remote relation to external service
function createPostWithRemoteSubscription(): Entity {
  return entity("post", {
    title: string,
    subscriptionId: string,
    // Remote relation - joined at API level
    subscription: belongsTo(() => Subscription).remote("stripeService"),
  }).build()
}

// -----------------------------------------------------------------------------
// Helper Function Tests
// -----------------------------------------------------------------------------

describe("Remote Joiner Helpers", () => {
  describe("hasRemoteRelations()", () => {
    it("should return false for entity without remote relations", () => {
      expect(hasRemoteRelations(Post)).toBe(false)
    })

    it("should return true for entity with remote relations", () => {
      const PostWithRemote = createPostWithRemoteSubscription()
      expect(hasRemoteRelations(PostWithRemote)).toBe(true)
    })

    it("should return false for entity without any relations", () => {
      const Simple = entity("simple", { name: string }).build()
      expect(hasRemoteRelations(Simple)).toBe(false)
    })
  })

  describe("getRemoteRelationFields()", () => {
    it("should return empty array for entity without remote relations", () => {
      expect(getRemoteRelationFields(Post)).toEqual([])
    })

    it("should return remote field names", () => {
      const PostWithRemote = createPostWithRemoteSubscription()
      const fields = getRemoteRelationFields(PostWithRemote)
      expect(fields).toContain("subscription")
    })
  })

  describe("splitIncludes()", () => {
    it("should split includes into local and remote", () => {
      const PostWithRemote = createPostWithRemoteSubscription()

      const { local, remote } = splitIncludes(PostWithRemote, {
        subscription: true,
      })

      expect(local).toEqual({})
      expect(remote).toEqual({ subscription: true })
    })

    it("should keep local relations in local", () => {
      const { local, remote } = splitIncludes(Post, {
        author: true,
      })

      expect(local).toEqual({ author: true })
      expect(remote).toEqual({})
    })

    it("should handle mixed includes", () => {
      // Create entity with both local and remote relations
      const MixedEntity: Entity = {
        name: "mixed",
        config: {
          fields: {
            localRelation: {
              hasDefault: false,
              type: "string",
              optional: false,
              unique: false,
              relation: {
                type: "belongsTo",
                entity: () => User,
                foreignKey: "localId",
                references: "id",
                remote: false,
              },
            },
            remoteRelation: {
              hasDefault: false,
              type: "string",
              optional: false,
              unique: false,
              relation: {
                type: "belongsTo",
                entity: () => Subscription,
                foreignKey: "remoteId",
                references: "id",
                remote: true,
                remoteService: "externalService",
              },
            },
          },
          rules: {},
          timestamps: true,
        },
      }

      const { local, remote } = splitIncludes(MixedEntity, {
        localRelation: true,
        remoteRelation: { select: ["planName"] },
      })

      expect(local).toEqual({ localRelation: true })
      expect(remote).toEqual({ remoteRelation: { select: ["planName"] } })
    })
  })
})

// -----------------------------------------------------------------------------
// RemoteJoiner Class Tests
// -----------------------------------------------------------------------------

describe("RemoteJoiner", () => {
  describe("createRemoteJoiner()", () => {
    it("should create joiner with default options", () => {
      const joiner = createRemoteJoiner()
      expect(joiner).toBeInstanceOf(RemoteJoiner)
    })

    it("should create joiner with custom options", () => {
      const joiner = createRemoteJoiner({
        batchSize: 50,
        timeout: 10000,
        cache: false,
      })
      expect(joiner).toBeInstanceOf(RemoteJoiner)
    })
  })

  describe("stitch()", () => {
    it("should return records unchanged if no remote relations in include", async () => {
      const joiner = createRemoteJoiner()
      const mockDriver = createMockDriver()
      const container = new ServiceContainer()
      container.setDriver(mockDriver)

      const records = [
        { id: "1", title: "Post 1", authorId: "user1" },
        { id: "2", title: "Post 2", authorId: "user2" },
      ]

      // Post has no remote relations
      const result = await joiner.stitch(
        records,
        Post,
        { author: true }, // Local relation
        { entities: new Map([["post", Post]]), container, driver: mockDriver }
      )

      expect(result).toEqual(records)
    })

    it("should return empty array for empty records", async () => {
      const joiner = createRemoteJoiner()
      const mockDriver = createMockDriver()
      const container = new ServiceContainer()
      container.setDriver(mockDriver)

      const PostWithRemote = createPostWithRemoteSubscription()

      const result = await joiner.stitch(
        [],
        PostWithRemote,
        { subscription: true },
        { entities: new Map(), container, driver: mockDriver }
      )

      expect(result).toEqual([])
    })

    it("should stitch remote data from driver when no remoteService specified", async () => {
      const joiner = createRemoteJoiner()
      const mockDriver = createMockDriver()

      // Create entity with remote relation but no remoteService
      const PostWithRemoteNoService: Entity = {
        name: "post",
        config: {
          fields: {
            title: { hasDefault: false, type: "string", optional: false, unique: false },
            subscriptionId: { hasDefault: false, type: "string", optional: false, unique: false },
            subscription: {
              hasDefault: false,
              type: "string",
              optional: true,
              unique: false,
              relation: {
                type: "belongsTo",
                entity: () => Subscription,
                foreignKey: "subscriptionId",
                references: "id",
                remote: true,
                // No remoteService - will use driver
              },
            },
          },
          rules: {},
          timestamps: true,
        },
      }

        // Mock driver to return subscription data
        ; (mockDriver.findMany as any).mockResolvedValue([
          { id: "sub1", planName: "Pro", price: 99 },
          { id: "sub2", planName: "Basic", price: 9 },
        ])

      const container = new ServiceContainer()
      container.setDriver(mockDriver)

      const records = [
        { id: "1", title: "Post 1", subscriptionId: "sub1" },
        { id: "2", title: "Post 2", subscriptionId: "sub2" },
      ]

      const result = await joiner.stitch(
        records,
        PostWithRemoteNoService,
        { subscription: true },
        { entities: new Map(), container, driver: mockDriver }
      )

      expect(result[0].subscription).toEqual({ id: "sub1", planName: "Pro", price: 99 })
      expect(result[1].subscription).toEqual({ id: "sub2", planName: "Basic", price: 9 })
    })

    it("should stitch remote data from service when remoteService specified", async () => {
      const joiner = createRemoteJoiner()
      const mockDriver = createMockDriver()
      const container = new ServiceContainer()
      container.setDriver(mockDriver)

      // Mock remote service
      const mockStripeService = {
        fetchByIds: vi.fn().mockResolvedValue([
          { id: "sub1", planName: "Enterprise", price: 299 },
        ]),
      }
      container.registerInstance("stripeService", mockStripeService)

      const PostWithRemote = createPostWithRemoteSubscription()

      const records = [
        { id: "1", title: "Post 1", subscriptionId: "sub1" },
      ]

      const result = await joiner.stitch(
        records,
        PostWithRemote,
        { subscription: true },
        { entities: new Map(), container, driver: mockDriver }
      )

      expect(mockStripeService.fetchByIds).toHaveBeenCalledWith(
        "subscription",
        ["sub1"],
        { include: true }
      )
      expect(result[0].subscription).toEqual({ id: "sub1", planName: "Enterprise", price: 299 })
    })

    it("should set null for missing remote records", async () => {
      const joiner = createRemoteJoiner()
      const mockDriver = createMockDriver()

      // Create entity with remote relation but no remoteService
      const PostWithRemoteNoService: Entity = {
        name: "post",
        config: {
          fields: {
            title: { hasDefault: false, type: "string", optional: false, unique: false },
            subscriptionId: { hasDefault: false, type: "string", optional: false, unique: false },
            subscription: {
              hasDefault: false,
              type: "string",
              optional: true,
              unique: false,
              relation: {
                type: "belongsTo",
                entity: () => Subscription,
                foreignKey: "subscriptionId",
                references: "id",
                remote: true,
              },
            },
          },
          rules: {},
          timestamps: true,
        },
      }

        // Mock driver to return only one subscription
        ; (mockDriver.findMany as any).mockResolvedValue([
          { id: "sub1", planName: "Pro", price: 99 },
        ])

      const container = new ServiceContainer()
      container.setDriver(mockDriver)

      const records = [
        { id: "1", title: "Post 1", subscriptionId: "sub1" },
        { id: "2", title: "Post 2", subscriptionId: "sub999" }, // Non-existent
      ]

      const result = await joiner.stitch(
        records,
        PostWithRemoteNoService,
        { subscription: true },
        { entities: new Map(), container, driver: mockDriver }
      )

      expect(result[0].subscription).toEqual({ id: "sub1", planName: "Pro", price: 99 })
      expect(result[1].subscription).toBeNull()
    })

    it("should handle service errors gracefully", async () => {
      const joiner = createRemoteJoiner()
      const mockDriver = createMockDriver()
      const container = new ServiceContainer()
      container.setDriver(mockDriver)

      // Mock remote service that throws
      const mockStripeService = {
        fetchByIds: vi.fn().mockRejectedValue(new Error("Service unavailable")),
      }
      container.registerInstance("stripeService", mockStripeService)

      const PostWithRemote = createPostWithRemoteSubscription()

      const records = [
        { id: "1", title: "Post 1", subscriptionId: "sub1" },
      ]

      // Should not throw, just return null for remote data
      const result = await joiner.stitch(
        records,
        PostWithRemote,
        { subscription: true },
        { entities: new Map(), container, driver: mockDriver }
      )

      expect(result[0].subscription).toBeNull()
    })

    it("should skip records without foreign key value", async () => {
      const joiner = createRemoteJoiner()
      const mockDriver = createMockDriver()

      const PostWithRemoteNoService: Entity = {
        name: "post",
        config: {
          fields: {
            title: { hasDefault: false, type: "string", optional: false, unique: false },
            subscriptionId: { hasDefault: false, type: "string", optional: true, unique: false },
            subscription: {
              hasDefault: false,
              type: "string",
              optional: true,
              unique: false,
              relation: {
                type: "belongsTo",
                entity: () => Subscription,
                foreignKey: "subscriptionId",
                references: "id",
                remote: true,
              },
            },
          },
          rules: {},
          timestamps: true,
        },
      }

        ; (mockDriver.findMany as any).mockResolvedValue([])

      const container = new ServiceContainer()
      container.setDriver(mockDriver)

      const records = [
        { id: "1", title: "Post 1", subscriptionId: null },
        { id: "2", title: "Post 2" }, // No subscriptionId at all
      ]

      const result = await joiner.stitch(
        records,
        PostWithRemoteNoService,
        { subscription: true },
        { entities: new Map(), container, driver: mockDriver }
      )

      // Should not have called findMany since no valid IDs
      expect(mockDriver.findMany).not.toHaveBeenCalled()
      expect(result[0].subscription).toBeUndefined()
      expect(result[1].subscription).toBeUndefined()
    })
  })
})

// -----------------------------------------------------------------------------
// Integration Patterns Tests
// -----------------------------------------------------------------------------

describe("Remote Joiner Integration Patterns", () => {
  it("should support e-commerce pattern with Stripe subscriptions", async () => {
    const joiner = createRemoteJoiner()
    const mockDriver = createMockDriver()
    const container = new ServiceContainer()
    container.setDriver(mockDriver)

    // Mock Stripe service
    const stripeService = {
      fetchByIds: vi.fn().mockResolvedValue([
        { id: "sub_123", planName: "Pro", status: "active", price: 2999 },
      ]),
    }
    container.registerInstance("stripeService", stripeService)

    const Customer: Entity = {
      name: "customer",
      config: {
        fields: {
          email: { hasDefault: false, type: "string", optional: false, unique: true },
          stripeSubscriptionId: { hasDefault: false, type: "string", optional: true, unique: false },
          subscription: {
            hasDefault: false,
            type: "string",
            optional: true,
            unique: false,
            relation: {
              type: "belongsTo",
              entity: () => Subscription,
              foreignKey: "stripeSubscriptionId",
              references: "id",
              remote: true,
              remoteService: "stripeService",
            },
          },
        },
        rules: {},
        timestamps: true,
      },
    }

    const customers = [
      { id: "cust_1", email: "john@example.com", stripeSubscriptionId: "sub_123" },
    ]

    const result = await joiner.stitch(
      customers,
      Customer,
      { subscription: true },
      { entities: new Map(), container, driver: mockDriver }
    )

    expect(result[0].subscription).toEqual({
      id: "sub_123",
      planName: "Pro",
      status: "active",
      price: 2999,
    })
  })
})
