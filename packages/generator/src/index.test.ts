// =============================================================================
// GENERATOR TESTS
// Tests for Prisma schema generation (primary) and OpenAPI spec generation
//
// NOTE: generateTypes and generateClient are DEPRECATED
// Nevr now uses E2E type inference from server to client automatically.
// These functions are kept for backwards compatibility only.
// =============================================================================

import { describe, it, expect, beforeAll } from "vitest"
import { generatePrismaSchema, generateTypes, generateClient } from "./index.js"
import { entity, string, text, int, bool, datetime, belongsTo, hasMany, action } from "nevr"

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
// @deprecated - Types are now auto-inferred via E2E type system
// These tests are kept for backwards compatibility only
// =============================================================================

describe("generateTypes (deprecated)", () => {
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
// @deprecated - Client is now auto-synced via createClient({ plugins: [...] })
// These tests are kept for backwards compatibility only
// =============================================================================

describe("generateClient (deprecated)", () => {
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

// =============================================================================
// OpenAPI Generator Tests
// =============================================================================

describe("generateOpenAPI", () => {
  // Import the function dynamically to avoid TypeScript issues
  let generateOpenAPI: typeof import("./index.js").generateOpenAPI

  beforeAll(async () => {
    const mod = await import("./index.js")
    generateOpenAPI = mod.generateOpenAPI
  })

  // Test entity WITH rich metadata
  const product = entity("product", {
    name: string
      .label("Product Name")
      .description("The display name shown to customers")
      .placeholder("Enter product name...")
      .example("Summer T-Shirt")
      .min(1)
      .max(200),
    price: int
      .label("Price")
      .description("Price in cents")
      .example(2999)
      .min(0),
    status: string
      .options(["draft", "active", "archived"])
      .label("Status")
      .description("Product publication status")
      .default("draft"),
    email: string.email().optional(),
  }).timestamps(false).build()

  it("generates valid OpenAPI 3.0 spec structure", () => {
    const spec = generateOpenAPI([product], {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    })

    expect(spec.openapi).toBe("3.0.3")
    expect(spec.info.title).toBe("Test API")
    expect(spec.info.version).toBe("1.0.0")
    expect(spec.paths).toBeDefined()
    expect(spec.components.schemas).toBeDefined()
    expect(spec.tags).toBeDefined()
  })

  it("generates entity schema with rich metadata", () => {
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
    })

    const productSchema = spec.components.schemas.Product as Record<string, unknown>
    expect(productSchema.type).toBe("object")

    const props = productSchema.properties as Record<string, Record<string, unknown>>

    // Check label -> title mapping
    expect(props.name.title).toBe("Product Name")

    // Check description mapping
    expect(props.name.description).toBe("The display name shown to customers")

    // Check example mapping
    expect(props.name.example).toBe("Summer T-Shirt")
    expect(props.price.example).toBe(2999)

    // Check min/max mapping
    expect(props.name.minLength).toBe(1)
    expect(props.name.maxLength).toBe(200)
    expect(props.price.minimum).toBe(0)
  })

  it("generates enum from options", () => {
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
    })

    const props = (spec.components.schemas.Product as any).properties
    expect(props.status.enum).toEqual(["draft", "active", "archived"])
    expect(props.status.type).toBe("string")
  })

  it("applies email format for email fields", () => {
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
    })

    const props = (spec.components.schemas.Product as any).properties
    expect(props.email.format).toBe("email")
  })

  it("generates CRUD paths", () => {
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
      basePath: "/api",
    })

    // List + Create
    expect(spec.paths["/api/products"]).toBeDefined()
    expect(spec.paths["/api/products"].get).toBeDefined()
    expect(spec.paths["/api/products"].post).toBeDefined()

    // Read + Update + Delete
    expect(spec.paths["/api/products/{id}"]).toBeDefined()
    expect(spec.paths["/api/products/{id}"].get).toBeDefined()
    expect(spec.paths["/api/products/{id}"].put).toBeDefined()
    expect(spec.paths["/api/products/{id}"].delete).toBeDefined()
  })

  it("generates Create and Update schemas", () => {
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
    })

    expect(spec.components.schemas.ProductCreate).toBeDefined()
    expect(spec.components.schemas.ProductUpdate).toBeDefined()

    // Create schema should have rich metadata too
    const createProps = (spec.components.schemas.ProductCreate as any).properties
    expect(createProps.name.title).toBe("Product Name")
  })

  it("includes security schemes when enabled", () => {
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
      security: true,
    })

    expect(spec.components.securitySchemes).toBeDefined()
    expect(spec.components.securitySchemes!.bearerAuth).toBeDefined()
    expect(spec.components.securitySchemes!.cookieAuth).toBeDefined()
  })

  it("excludes security schemes when disabled", () => {
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
      security: false,
    })

    expect(spec.components.securitySchemes).toBeUndefined()
  })

  it("includes servers when provided", () => {
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
      servers: [
        { url: "http://localhost:3000", description: "Development" },
        { url: "https://api.example.com", description: "Production" },
      ],
    })

    expect(spec.servers).toHaveLength(2)
    expect(spec.servers![0].url).toBe("http://localhost:3000")
  })

  it("generates tags for entities", () => {
    const spec = generateOpenAPI([product, user], {
      info: { title: "Test", version: "1.0.0" },
    })

    expect(spec.tags).toContainEqual(expect.objectContaining({ name: "Product" }))
    expect(spec.tags).toContainEqual(expect.objectContaining({ name: "User" }))
  })

  it("handles entities with authorization rules", () => {
    const protectedEntity = entity("secret", {
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

    const spec = generateOpenAPI([protectedEntity], {
      info: { title: "Test", version: "1.0.0" },
      security: true,
    })

    const createOp = (spec.paths["/api/secrets"].post as any)
    const readOp = (spec.paths["/api/secrets/{id}"].get as any)

    // Operations with authentication rules should have security requirement
    expect(createOp.security).toBeDefined()
    expect(readOp.security).toBeDefined()
  })

  it("generates Error schema", () => {
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
    })

    expect(spec.components.schemas.Error).toBeDefined()
    const errorSchema = spec.components.schemas.Error as any
    expect(errorSchema.properties.code).toBeDefined()
    expect(errorSchema.properties.message).toBeDefined()
    expect(errorSchema.properties.details).toBeDefined()
  })

  it("generates paths for entity actions", () => {
    // Entity with custom action using the action() builder
    const order = entity("order", {
      total: int,
      status: string.options(["pending", "paid", "shipped"]),
    })
      .actions({
        checkout: action("checkout")
          .post()
          .onResource()
          .rules("owner")
          .input({ paymentMethod: string })
          .meta({
            summary: "Process order checkout",
            description: "Finalize the order and process payment",
          }),
        cancel: action("cancel")
          .post()
          .onResource()
          .rules("owner", "admin"),
      })
      .timestamps(false)
      .build()

    const spec = generateOpenAPI([order], {
      info: { title: "Test", version: "1.0.0" },
      basePath: "/api",
    })

    // Check checkout action path
    expect(spec.paths["/api/orders/{id}/checkout"]).toBeDefined()
    const checkoutOp = (spec.paths["/api/orders/{id}/checkout"].post as any)
    expect(checkoutOp.summary).toBe("Process order checkout")
    expect(checkoutOp.description).toBe("Finalize the order and process payment")
    expect(checkoutOp.security).toBeDefined() // Has auth rules

    // Check cancel action path
    expect(spec.paths["/api/orders/{id}/cancel"]).toBeDefined()
    const cancelOp = (spec.paths["/api/orders/{id}/cancel"].post as any)
    expect(cancelOp.security).toBeDefined()
  })

  it("generates request body for actions with input", () => {
    const order = entity("order", {
      total: int,
    })
      .actions({
        refund: action("refund")
          .post()
          .onResource()
          .input({
            amount: int,
            reason: string.optional(),
          }),
      })
      .timestamps(false)
      .build()

    const spec = generateOpenAPI([order], {
      info: { title: "Test", version: "1.0.0" },
    })

    const refundOp = (spec.paths["/api/orders/{id}/refund"].post as any)
    expect(refundOp.requestBody).toBeDefined()
    expect(refundOp.requestBody.content["application/json"]).toBeDefined()

    const schema = refundOp.requestBody.content["application/json"].schema
    expect(schema.properties.amount).toBeDefined()
    expect(schema.properties.reason).toBeDefined()
  })

  it("generates collection-level actions (no ID required)", () => {
    const report = entity("report", {
      name: string,
    })
      .actions({
        generateAll: action("generate-all")
          .post()
          .meta({ summary: "Generate all reports" }),
      })
      .timestamps(false)
      .build()

    const spec = generateOpenAPI([report], {
      info: { title: "Test", version: "1.0.0" },
    })

    // Collection-level action (no {id})
    expect(spec.paths["/api/reports/generate-all"]).toBeDefined()
    const op = (spec.paths["/api/reports/generate-all"].post as any)
    expect(op.summary).toBe("Generate all reports")
  })

  it("generates paths for plugin routes (static routes)", () => {
    // Mock plugin with static routes
    const mockPlugin = {
      name: "CustomPlugin",
      description: "A custom plugin for testing",
      routes: [
        {
          method: "GET" as const,
          path: "/custom/status",
          handler: async () => ({ status: 200, body: { ok: true } }),
          metadata: {
            summary: "Get custom status",
            description: "Returns the status of the custom service",
            tags: ["Custom"],
          },
        },
        {
          method: "POST" as const,
          path: "/custom/action/:id",
          handler: async () => ({ status: 200, body: { success: true } }),
          metadata: {
            summary: "Execute custom action",
            requiresAuth: true,
          },
        },
      ],
    }

    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
      plugins: [mockPlugin],
    })

    // Check GET route
    expect(spec.paths["/custom/status"]).toBeDefined()
    const statusOp = (spec.paths["/custom/status"].get as any)
    expect(statusOp.summary).toBe("Get custom status")
    expect(statusOp.description).toBe("Returns the status of the custom service")

    // Check POST route with path param
    expect(spec.paths["/custom/action/{id}"]).toBeDefined()
    const actionOp = (spec.paths["/custom/action/{id}"].post as any)
    expect(actionOp.summary).toBe("Execute custom action")
    expect(actionOp.security).toBeDefined() // requiresAuth: true
    expect(actionOp.parameters).toContainEqual(
      expect.objectContaining({ name: "id", in: "path" })
    )

    // Check plugin tag
    expect(spec.tags).toContainEqual(
      expect.objectContaining({ name: "CustomPlugin" })
    )
  })

  it("handles plugins with function routes gracefully", () => {
    // Plugin with function routes (can't be resolved statically)
    const dynamicPlugin = {
      name: "DynamicPlugin",
      routes: (nevr: any) => [
        {
          method: "GET" as const,
          path: "/dynamic",
          handler: async () => ({ status: 200, body: {} }),
        },
      ],
    }

    // Should not throw, just skip function routes
    const spec = generateOpenAPI([product], {
      info: { title: "Test", version: "1.0.0" },
      plugins: [dynamicPlugin],
    })

    // Dynamic route won't be included (can't resolve without NevrInstance)
    expect(spec.paths["/dynamic"]).toBeUndefined()
  })
})


