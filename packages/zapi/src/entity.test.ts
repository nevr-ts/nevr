// =============================================================================
// NEVR CORE TESTS
// Tests for entity DSL, fields, and core functionality
// =============================================================================

import { describe, it, expect, beforeEach } from "vitest"
import { entity } from "./entity"
import {
  string,
  text,
  int,
  float,
  boolean,
  datetime,
  json,
  belongsTo,
  hasMany,
  hasOne,
  FieldBuilder,
} from "./fields"
import type { Entity, FieldDef } from "./types"

// -----------------------------------------------------------------------------
// Entity DSL Tests
// -----------------------------------------------------------------------------

describe("Entity DSL", () => {
  describe("entity()", () => {
    it("should create a basic entity", () => {
      const User = entity("user", {
        name: string,
        email: string.unique(),
      }).build()

      expect(User.name).toBe("user")
      expect(User.config.fields).toHaveProperty("name")
      expect(User.config.fields).toHaveProperty("email")
    })

    it("should apply rules correctly", () => {
      const Post = entity("post", {
        title: string,
      }).rules({
        create: ["authenticated"],
        read: ["everyone"],
      }).build()

      expect(Post.config.rules.create).toEqual(["authenticated"])
      expect(Post.config.rules.read).toEqual(["everyone"])
    })

    it("should set owner field with ownedBy", () => {
      const User = entity("user", {
        name: string,
      }).build()

      const Post = entity("post", {
        title: string,
        author: belongsTo(() => User),
      }).ownedBy("author").build()

      expect(Post.config.ownerField).toBeDefined()
    })

    it("should disable timestamps with noTimestamps", () => {
      const Post = entity("post", {
        title: string,
      }).noTimestamps().build()

      expect(Post.config.timestamps).toBe(false)
    })

    it("should enable timestamps by default", () => {
      const Post = entity("post", {
        title: string,
      }).build()

      expect(Post.config.timestamps).toBe(true)
    })

    it("should chain multiple configurations", () => {
      const User = entity("user", {
        name: string,
      }).build()

      const Post = entity("post", {
        title: string,
        content: text,
        author: belongsTo(() => User),
      })
        .rules({ create: ["authenticated"] })
        .ownedBy("author")
        .build()

      expect(Post.name).toBe("post")
      expect(Post.config.rules.create).toEqual(["authenticated"])
      expect(Post.config.ownerField).toBeDefined()
      expect(Post.config.timestamps).toBe(true)
    })
  })
})

// -----------------------------------------------------------------------------
// Field Types Tests
// -----------------------------------------------------------------------------

describe("Field Types", () => {
  describe("string", () => {
    it("should be a FieldBuilder instance", () => {
      expect(string).toBeInstanceOf(FieldBuilder)
    })

    it("should have string type", () => {
      const field = string._build()
      expect(field.type).toBe("string")
      expect(field.optional).toBe(false)
    })

    it("should support optional modifier", () => {
      const field = string.optional()._build()
      expect(field.optional).toBe(true)
    })

    it("should support unique modifier", () => {
      const field = string.unique()._build()
      expect(field.unique).toBe(true)
    })

    it("should support default value", () => {
      const field = string.default("hello")._build()
      expect(field.default).toBe("hello")
    })

    it("should support min/max length", () => {
      const field = string.min(5).max(100)._build()
      expect(field.min).toBe(5)
      expect(field.max).toBe(100)
    })

    it("should chain multiple modifiers", () => {
      const field = string.optional().unique().min(3).max(50)._build()
      expect(field.optional).toBe(true)
      expect(field.unique).toBe(true)
      expect(field.min).toBe(3)
      expect(field.max).toBe(50)
    })
  })

  describe("text", () => {
    it("should have text type", () => {
      const field = text._build()
      expect(field.type).toBe("text")
    })
  })

  describe("int", () => {
    it("should have int type", () => {
      const field = int._build()
      expect(field.type).toBe("int")
    })

    it("should support min/max values", () => {
      const field = int.min(0).max(100)._build()
      expect(field.min).toBe(0)
      expect(field.max).toBe(100)
    })

    it("should support default value", () => {
      const field = int.default(0)._build()
      expect(field.default).toBe(0)
    })
  })

  describe("float", () => {
    it("should have float type", () => {
      const field = float._build()
      expect(field.type).toBe("float")
    })
  })

  describe("boolean", () => {
    it("should have boolean type", () => {
      const field = boolean._build()
      expect(field.type).toBe("boolean")
    })

    it("should support default value", () => {
      const field = boolean.default(true)._build()
      expect(field.default).toBe(true)
    })
  })

  describe("datetime", () => {
    it("should have datetime type", () => {
      const field = datetime._build()
      expect(field.type).toBe("datetime")
    })
  })

  describe("json", () => {
    it("should have json type", () => {
      const field = json._build()
      expect(field.type).toBe("json")
    })

    it("should support default value", () => {
      const defaultObj = { key: "value" }
      const field = json.default(defaultObj)._build()
      expect(field.default).toEqual(defaultObj)
    })
  })
})

// -----------------------------------------------------------------------------
// Relation Tests
// -----------------------------------------------------------------------------

describe("Relations", () => {
  const User = entity("user", {
    name: string,
    email: string.unique(),
  }).build()

  describe("belongsTo()", () => {
    it("should create a belongsTo relation", () => {
      const Post = entity("post", {
        title: string,
        author: belongsTo(() => User),
      }).build()

      const authorField = Post.config.fields.author
      expect(authorField.relation).toBeDefined()
      expect(authorField.relation?.type).toBe("belongsTo")
    })
  })

  describe("hasMany()", () => {
    it("should create a hasMany relation", () => {
      const UserWithPosts = entity("user", {
        name: string,
        posts: hasMany(() => User),
      }).build()

      const postsField = UserWithPosts.config.fields.posts
      expect(postsField.relation?.type).toBe("hasMany")
    })
  })

  describe("hasOne()", () => {
    it("should create a hasOne relation", () => {
      const Profile = entity("profile", {
        bio: text,
      }).build()

      const UserWithProfile = entity("user", {
        name: string,
        profile: hasOne(() => Profile),
      }).build()

      const profileField = UserWithProfile.config.fields.profile
      expect(profileField.relation?.type).toBe("hasOne")
    })
  })
})

// -----------------------------------------------------------------------------
// Complex Entity Tests
// -----------------------------------------------------------------------------

describe("Complex Entities", () => {
  it("should create a complete blog schema", () => {
    const User = entity("user", {
      name: string.min(2).max(100),
      email: string.unique(),
      role: string.default("user"),
      isActive: boolean.default(true),
    })
      .rules({
        create: ["everyone"],
        read: ["everyone"],
        update: ["owner", "admin"],
        delete: ["admin"],
      })
      .build()

    const Post = entity("post", {
      title: string.min(5).max(200),
      content: text,
      published: boolean.default(false),
      views: int.default(0),
      metadata: json.optional(),
      author: belongsTo(() => User),
    })
      .rules({
        create: ["authenticated"],
        read: ["everyone"],
        update: ["owner"],
        delete: ["owner", "admin"],
      })
      .ownedBy("author")
      .build()

    // User assertions
    expect(User.name).toBe("user")
    expect(User.config.fields.email.unique).toBe(true)
    expect(User.config.fields.role.default).toBe("user")
    expect(User.config.timestamps).toBe(true)

    // Post assertions
    expect(Post.name).toBe("post")
    expect(Post.config.fields.title.min).toBe(5)
    expect(Post.config.fields.published.default).toBe(false)
    expect(Post.config.fields.author.relation?.type).toBe("belongsTo")
    expect(Post.config.ownerField).toBeDefined()
    expect(Post.config.rules.create).toEqual(["authenticated"])
  })
})
