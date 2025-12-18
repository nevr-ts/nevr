// =============================================================================
// GENERATOR TESTS
// Tests for Prisma schema, types, and client generation
// =============================================================================

import { describe, it, expect } from "vitest"
import { generatePrismaSchema, generateTypes, generateClient } from "./index.js"
import { entity, string, text, int, bool, datetime, belongsTo, hasMany } from "@zapi-ts/core"

// =============================================================================
// Test Entities
// Note: timestamps are enabled by default in entity()
// =============================================================================

const user = entity("user", {
  email: string.unique(),
  name: string.min(1).max(100),
  role: string.default("member"),
}).build()

const project = entity("project", {
  name: string,
  description: text.optional(),
  archived: bool.default(false),
  owner: belongsTo(() => user),
})
  .ownedBy("owner")
  .build()

// Task has MULTIPLE relations to user (assignee and createdBy)
const task = entity("task", {
  title: string,
  status: string.default("todo"),
  priority: int.default(0),
  dueDate: datetime.optional(),
  project: belongsTo(() => project),
  assignee: belongsTo(() => user),
  createdBy: belongsTo(() => user),
})
  .ownedBy("createdBy")
  .build()

const entities = [user, project, task]

// =============================================================================
// Prisma Schema Tests
// =============================================================================

describe("generatePrismaSchema", () => {
  const schema = generatePrismaSchema(entities)

  it("generates valid Prisma header", () => {
    expect(schema).toContain("generator client")
    expect(schema).toContain('provider = "prisma-client-js"')
    expect(schema).toContain("datasource db")
  })

  it("generates User model", () => {
    expect(schema).toContain("model User {")
    expect(schema).toContain("id            String   @id @default(uuid())")
    expect(schema).toContain("email        String @unique")
    expect(schema).toContain('role         String @default("member")')
    expect(schema).toContain("createdAt     DateTime @default(now())")
    expect(schema).toContain("updatedAt     DateTime @updatedAt")
  })

  it("generates Project model with foreign key", () => {
    expect(schema).toContain("model Project {")
    expect(schema).toContain("ownerId      String")
    expect(schema).toContain("owner        User?")
    expect(schema).toContain("@@index([ownerId])")
  })

  it("generates Task model with multiple relations to User", () => {
    expect(schema).toContain("model Task {")
    expect(schema).toContain("assigneeId   String")
    expect(schema).toContain("createdById  String")
    // Multiple relations to same entity should have relation names
    expect(schema).toContain('"assignee"')
    expect(schema).toContain('"createdBy"')
  })

  it("generates inverse relations on User", () => {
    // User should have hasMany back-references for tasks
    expect(schema).toMatch(/tasks_assignee\s+Task\[\]/)
    expect(schema).toMatch(/tasks_createdBy\s+Task\[\]/)
  })

  it("supports different database providers", () => {
    const pgSchema = generatePrismaSchema(entities, { provider: "postgresql" })
    expect(pgSchema).toContain('provider = "postgresql"')
    
    const mysqlSchema = generatePrismaSchema(entities, { provider: "mysql" })
    expect(mysqlSchema).toContain('provider = "mysql"')
  })
})

// =============================================================================
// TypeScript Types Tests
// =============================================================================

describe("generateTypes", () => {
  const types = generateTypes(entities)

  it("generates User interface", () => {
    expect(types).toContain("export interface User {")
    expect(types).toContain("id: string")
    expect(types).toContain("email: string")
    expect(types).toContain("name: string")
    expect(types).toContain("createdAt: Date")
  })

  it("generates Create input types", () => {
    expect(types).toContain("export interface UserCreate {")
    expect(types).toContain("export interface ProjectCreate {")
    expect(types).toContain("export interface TaskCreate {")
  })

  it("generates Update input types", () => {
    expect(types).toContain("export interface UserUpdate {")
    expect(types).toContain("export interface ProjectUpdate {")
    expect(types).toContain("export interface TaskUpdate {")
  })

  it("handles optional fields", () => {
    expect(types).toContain("description?: string")
    expect(types).toContain("dueDate?: Date")
  })

  it("handles defaults as optional in Create", () => {
    // Fields with defaults should be optional in Create
    expect(types).toMatch(/UserCreate[\s\S]*role\?: string/)
    expect(types).toMatch(/TaskCreate[\s\S]*status\?: string/)
  })

  it("skips owner field in Create", () => {
    // Owner field should be auto-set, not in Create input
    const projectCreate = types.match(/export interface ProjectCreate \{[\s\S]*?\}/)?.[0] || ""
    expect(projectCreate).not.toContain("ownerId")
  })
})

// =============================================================================
// API Client Tests
// =============================================================================

describe("generateClient", () => {
  const client = generateClient(entities)

  it("generates client factory", () => {
    expect(client).toContain("export function createClient(config: ClientConfig)")
  })

  it("generates CRUD methods for each entity", () => {
    // Users
    expect(client).toContain("users: {")
    expect(client).toContain('request<ListResponse<User>>(config, "GET", "/users"')
    expect(client).toContain('request<User>(config, "POST", "/users"')
    
    // Projects
    expect(client).toContain("projects: {")
    
    // Tasks
    expect(client).toContain("tasks: {")
  })

  it("imports from types file", () => {
    expect(client).toContain('import type {')
    expect(client).toContain("User,")
    expect(client).toContain("UserCreate,")
    expect(client).toContain("UserUpdate,")
  })

  it("includes list options support", () => {
    expect(client).toContain("interface ListOptions")
    expect(client).toContain("filter?: Record<string, string | number | boolean>")
    expect(client).toContain("sort?: string")
    expect(client).toContain("limit?: number")
    expect(client).toContain("offset?: number")
  })

  it("includes pagination in list response", () => {
    expect(client).toContain("interface ListResponse<T>")
    expect(client).toContain("pagination: {")
    expect(client).toContain("total: number")
  })

  it("includes error handling", () => {
    expect(client).toContain("interface ApiError")
    expect(client).toContain("onError?: (error: ApiError) => void")
  })
})
