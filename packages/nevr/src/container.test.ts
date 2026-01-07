// =============================================================================
// SERVICE CONTAINER TESTS (Pillar 3: Functional DI)
// Tests for service registration, resolution, lifecycle, and scoped containers
// =============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  ServiceContainer,
  ScopedContainer,
  createScope,
  createService,
  lazyService,
  getGlobalContainer,
  setGlobalContainer,
  clearGlobalContainer,
} from "./container.js"
import type { Driver } from "./types.js"

// -----------------------------------------------------------------------------
// Mock Driver
// -----------------------------------------------------------------------------

function createMockDriver(): Driver {
  return {
    name: "mock",
    create: vi.fn().mockResolvedValue({ id: "1" }),
    findOne: vi.fn().mockResolvedValue({ id: "1" }),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: "1" }),
    delete: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
  }
}

// -----------------------------------------------------------------------------
// Service Container Tests
// -----------------------------------------------------------------------------

describe("ServiceContainer", () => {
  let container: ServiceContainer
  let mockDriver: Driver

  beforeEach(() => {
    mockDriver = createMockDriver()
    container = new ServiceContainer()
    container.setDriver(mockDriver)
    clearGlobalContainer()
  })

  describe("Basic Registration and Resolution", () => {
    it("should register and resolve a simple service", () => {
      container.register("config", () => ({ apiKey: "test-key" }))

      const config = container.resolve<{ apiKey: string }>("config")
      expect(config.apiKey).toBe("test-key")
    })

    it("should register and resolve a service with dependencies", () => {
      container.register("config", () => ({ baseUrl: "https://api.example.com" }))
      container.register("httpClient", (ctx) => {
        const config = ctx.resolve<{ baseUrl: string }>("config")
        return { baseUrl: config.baseUrl, fetch: vi.fn() }
      })

      const client = container.resolve<{ baseUrl: string }>("httpClient")
      expect(client.baseUrl).toBe("https://api.example.com")
    })

    it("should throw for unregistered service", () => {
      expect(() => container.resolve("nonexistent")).toThrow(/not found/)
    })

    it("should check if service exists", () => {
      container.register("existing", () => ({}))

      expect(container.has("existing")).toBe(true)
      expect(container.has("nonexistent")).toBe(false)
    })

    it("should register instance directly", () => {
      const myInstance = { value: 42 }
      container.registerInstance("myInstance", myInstance)

      const resolved = container.resolve<{ value: number }>("myInstance")
      expect(resolved.value).toBe(42)
      expect(resolved).toBe(myInstance) // Same reference
    })
  })

  describe("Lifecycle Management", () => {
    it("should return same instance for singleton (default)", () => {
      let callCount = 0
      container.register("counter", () => {
        callCount++
        return { count: callCount }
      })

      const first = container.resolve<{ count: number }>("counter")
      const second = container.resolve<{ count: number }>("counter")

      expect(first).toBe(second) // Same reference
      expect(callCount).toBe(1) // Factory called once
    })

    it("should return new instance for transient", () => {
      let callCount = 0
      container.register("counter", () => {
        callCount++
        return { count: callCount }
      }, { lifecycle: "transient" })

      const first = container.resolve<{ count: number }>("counter")
      const second = container.resolve<{ count: number }>("counter")

      expect(first).not.toBe(second) // Different references
      expect(first.count).toBe(1)
      expect(second.count).toBe(2)
      expect(callCount).toBe(2) // Factory called twice
    })

    it("should support explicit singleton lifecycle", () => {
      container.register("singleton", () => ({ id: Math.random() }), { lifecycle: "singleton" })

      const first = container.resolve<{ id: number }>("singleton")
      const second = container.resolve<{ id: number }>("singleton")

      expect(first.id).toBe(second.id)
    })
  })

  describe("Async Resolution", () => {
    it("should resolve async service factory", async () => {
      container.register("asyncService", async () => {
        await new Promise((r) => setTimeout(r, 10))
        return { data: "loaded" }
      })

      const service = await container.resolveAsync<{ data: string }>("asyncService")
      expect(service.data).toBe("loaded")
    })

    it("should cache async singleton after first resolution", async () => {
      let callCount = 0
      container.register("asyncSingleton", async () => {
        callCount++
        await new Promise((r) => setTimeout(r, 5))
        return { count: callCount }
      })

      const first = await container.resolveAsync<{ count: number }>("asyncSingleton")
      const second = await container.resolveAsync<{ count: number }>("asyncSingleton")

      expect(first).toBe(second)
      expect(callCount).toBe(1)
    })

    it("should resolve sync service via resolveAsync", async () => {
      container.register("syncService", () => ({ value: 123 }))

      const service = await container.resolveAsync<{ value: number }>("syncService")
      expect(service.value).toBe(123)
    })
  })

  describe("Tags", () => {
    it("should register services with tags and return service IDs", () => {
      container.register("emailNotifier", () => ({ type: "email" }), { tags: ["notifier"] })
      container.register("smsNotifier", () => ({ type: "sms" }), { tags: ["notifier"] })
      container.register("logger", () => ({ type: "logger" }), { tags: ["utility"] })

      // getByTag returns service IDs, not instances
      const notifierIds = container.getByTag("notifier")
      expect(notifierIds).toHaveLength(2)
      expect(notifierIds).toContain("emailNotifier")
      expect(notifierIds).toContain("smsNotifier")

      // Resolve services by IDs to get instances
      const emailService = container.resolve<{ type: string }>("emailNotifier")
      expect(emailService.type).toBe("email")
    })

    it("should return empty array for unknown tag", () => {
      const services = container.getByTag("unknown")
      expect(services).toEqual([])
    })
  })

  describe("Service IDs and Metadata", () => {
    it("should list all registered service IDs", () => {
      container.register("service1", () => ({}))
      container.register("service2", () => ({}))
      container.register("service3", () => ({}))

      const ids = container.getServiceIds()
      expect(ids).toContain("service1")
      expect(ids).toContain("service2")
      expect(ids).toContain("service3")
    })
  })

  describe("Circular Dependency Detection", () => {
    it("should detect circular dependencies", () => {
      container.register("serviceA", (ctx) => {
        ctx.resolve("serviceB")
        return { name: "A" }
      })
      container.register("serviceB", (ctx) => {
        ctx.resolve("serviceA")
        return { name: "B" }
      })

      expect(() => container.resolve("serviceA")).toThrow(/[Cc]ircular/)
    })
  })

  describe("Driver Access", () => {
    it("should provide driver to service factories", () => {
      container.register("dbService", (ctx) => {
        return { driver: ctx.driver }
      })

      const service = container.resolve<{ driver: Driver }>("dbService")
      expect(service.driver).toBe(mockDriver)
    })
  })
})

// -----------------------------------------------------------------------------
// Scoped Container Tests
// -----------------------------------------------------------------------------

describe("ScopedContainer", () => {
  let parentContainer: ServiceContainer
  let mockDriver: Driver

  beforeEach(() => {
    mockDriver = createMockDriver()
    parentContainer = new ServiceContainer()
    parentContainer.setDriver(mockDriver)
  })

  it("should create scoped container from parent", () => {
    const scope = createScope(parentContainer)
    expect(scope).toBeInstanceOf(ScopedContainer)
  })

  it("should resolve services from parent", () => {
    parentContainer.register("parentService", () => ({ from: "parent" }))

    const scope = createScope(parentContainer)
    const service = scope.resolve<{ from: string }>("parentService")

    expect(service.from).toBe("parent")
  })

  it("should override parent services with scoped values", () => {
    parentContainer.register("user", () => ({ id: "parent-user" }))

    const scope = createScope(parentContainer)
    scope.set("user", { id: "scoped-user" })

    const user = scope.resolve<{ id: string }>("user")
    expect(user.id).toBe("scoped-user")

    // Parent should be unchanged
    const parentUser = parentContainer.resolve<{ id: string }>("user")
    expect(parentUser.id).toBe("parent-user")
  })

  it("should support per-request values like currentUser", () => {
    const scope = createScope(parentContainer)
    scope.set("currentUser", { id: "user-123", email: "test@example.com" })

    const user = scope.resolve<{ id: string; email: string }>("currentUser")
    expect(user.id).toBe("user-123")
    expect(user.email).toBe("test@example.com")
  })

  it("should check has() in both scope and parent", () => {
    parentContainer.register("parentOnly", () => ({}))

    const scope = createScope(parentContainer)
    scope.set("scopeOnly", {})

    expect(scope.has("parentOnly")).toBe(true)
    expect(scope.has("scopeOnly")).toBe(true)
    expect(scope.has("neither")).toBe(false)
  })

  it("should provide context for service resolution", () => {
    parentContainer.register("config", () => ({ env: "test" }))

    const scope = createScope(parentContainer)
    scope.setDriver(mockDriver)

    const ctx = scope.getContext()
    expect(ctx.resolve<{ env: string }>("config").env).toBe("test")
    expect(ctx.driver).toBe(mockDriver)
  })
})

// -----------------------------------------------------------------------------
// Global Container Tests
// -----------------------------------------------------------------------------

describe("Global Container", () => {
  beforeEach(() => {
    clearGlobalContainer()
  })

  it("should get/set global container", () => {
    const container = new ServiceContainer()
    container.setDriver(createMockDriver())
    container.register("global", () => ({ isGlobal: true }))

    setGlobalContainer(container)
    const retrieved = getGlobalContainer()

    expect(retrieved).toBe(container)
    expect(retrieved.resolve<{ isGlobal: boolean }>("global").isGlobal).toBe(true)
  })

  it("should create new container after clear", () => {
    const container = new ServiceContainer()
    container.setDriver(createMockDriver())
    container.register("testService", () => ({ value: 1 }))
    setGlobalContainer(container)

    clearGlobalContainer()

    // getGlobalContainer creates a new empty container
    const newContainer = getGlobalContainer()
    expect(newContainer).not.toBe(container)
    expect(newContainer.has("testService")).toBe(false)
  })

  it("should lazily create global container if not set", () => {
    // After clear, getGlobalContainer should create a new one
    const container1 = getGlobalContainer()
    const container2 = getGlobalContainer()

    expect(container1).toBe(container2) // Same instance
  })
})

// -----------------------------------------------------------------------------
// Helper Functions Tests
// -----------------------------------------------------------------------------

describe("Service Helper Functions", () => {
  describe("createService()", () => {
    it("should create service factory with dependencies", async () => {
      const container = new ServiceContainer()
      container.setDriver(createMockDriver())

      // Register dependencies
      container.register("config", () => ({ smtpHost: "smtp.example.com" }))
      container.register("logger", () => ({ log: vi.fn() }))

      // Create service with dependencies
      const emailServiceFactory = createService<
        { send: () => void; host: string },
        { config: { smtpHost: string }; logger: { log: () => void } }
      >(
        ["config", "logger"],
        (deps, ctx) => ({
          send: vi.fn(),
          host: deps.config.smtpHost,
        })
      )

      // Register and resolve
      container.register("emailService", emailServiceFactory)
      const emailService = await container.resolveAsync<{ host: string }>("emailService")

      expect(emailService.host).toBe("smtp.example.com")
    })
  })

  describe("lazyService()", () => {
    it("should create lazy service factory", async () => {
      const container = new ServiceContainer()
      container.setDriver(createMockDriver())

      let initialized = false

      // lazyService wraps a factory for lazy initialization
      const lazyFactory = lazyService(() => {
        initialized = true
        return { ready: true }
      })

      // Register with the lazy factory
      container.register("lazyService", lazyFactory)

      expect(initialized).toBe(false)

      // Resolution triggers the lazy factory
      const service = await container.resolveAsync<{ ready: boolean }>("lazyService")
      expect(initialized).toBe(true)
      expect(service.ready).toBe(true)
    })
  })
})
