// =============================================================================
// CLIENT TESTS
// Tests for the NEVR client system
// =============================================================================

import { describe, it, expect, vi } from "vitest"
import { createClient } from "./vanilla.js"
import { createNevrFetch } from "./fetch.js"
import { createClientStore, createSessionAtom, createSignalAtom } from "./store.js"
import { createDynamicProxy } from "./proxy.js"
import type { NevrClientPlugin, NevrFetch, ClientStore } from "./types.js"

describe("Client", () => {
  describe("createClient", () => {
    it("should create a client with default options", () => {
      const client = createClient({})

      expect(client).toBeDefined()
      expect(client.$fetch).toBeDefined()
      expect(client.$store).toBeDefined()
    })

    it("should create a client with custom baseURL", () => {
      const client = createClient({
        baseURL: "https://api.example.com",
        basePath: "/v1",
      })

      expect(client).toBeDefined()
      expect(client.$fetch).toBeDefined()
    })

    it("should merge plugins", () => {
      const mockPlugin: NevrClientPlugin = {
        id: "test-plugin",
        pathMethods: {
          "/test/action": "POST",
        },
        getActions: ($fetch, $store) => ({
          testAction: () => $fetch("/test/action", { method: "POST" }),
        }),
      }

      const client = createClient({
        plugins: [mockPlugin],
      })

      expect(client).toBeDefined()
    })
  })

  describe("createNevrFetch", () => {
    it("should create a fetch function", () => {
      const $fetch = createNevrFetch({
        baseURL: "https://api.example.com",
        basePath: "/api",
      })

      expect($fetch).toBeDefined()
      expect(typeof $fetch).toBe("function")
    })

    it("should build correct URLs", async () => {
      let capturedUrl = ""

      const $fetch = createNevrFetch({
        baseURL: "https://api.example.com",
        basePath: "/api",
        defaultOptions: {
          customFetch: async (input: RequestInfo | URL) => {
            const url = input.toString()
            capturedUrl = url
            return new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          },
        },
      })

      await $fetch("/users")

      expect(capturedUrl).toBe("https://api.example.com/api/users")
    })

    it("should handle query parameters", async () => {
      let capturedUrl = ""

      const $fetch = createNevrFetch({
        baseURL: "https://api.example.com",
        basePath: "/api",
        defaultOptions: {
          customFetch: async (input: RequestInfo | URL) => {
            const url = input.toString()
            capturedUrl = url
            return new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          },
        },
      })

      await $fetch("/users", {
        query: { page: 1, limit: 10 },
      })

      expect(capturedUrl).toBe("https://api.example.com/api/users?page=1&limit=10")
    })

    it("should return data on success", async () => {
      const mockData = { id: 1, name: "Test" }

      const $fetch = createNevrFetch({
        baseURL: "https://api.example.com",
        basePath: "/api",
        defaultOptions: {
          customFetch: async (input: RequestInfo | URL) => {
            return new Response(JSON.stringify(mockData), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          },
        },
      })

      const result = await $fetch("/users/1")

      expect(result.data).toEqual(mockData)
      expect(result.error).toBeNull()
    })

    it("should return error on failure", async () => {
      const $fetch = createNevrFetch({
        baseURL: "https://api.example.com",
        basePath: "/api",
        defaultOptions: {
          customFetch: async (input: RequestInfo | URL) => {
            return new Response(JSON.stringify({ message: "Not found" }), {
              status: 404,
              statusText: "Not Found",
              headers: { "Content-Type": "application/json" },
            })
          },
        },
      })

      const result = await $fetch("/users/999")

      expect(result.data).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
      expect(result.error?.message).toBe("Not found")
    })
  })

  describe("createClientStore", () => {
    it("should create a store with atoms", () => {
      const store = createClientStore()

      expect(store).toBeDefined()
      expect(store.atoms).toBeDefined()
      expect(typeof store.notify).toBe("function")
      expect(typeof store.listen).toBe("function")
    })

    it("should notify listeners", () => {
      const store = createClientStore()
      const listener = vi.fn()

      store.listen("test-signal", listener)
      store.notify("test-signal")

      expect(listener).toHaveBeenCalled()
    })
  })

  describe("createSessionAtom", () => {
    it("should create a session atom with initial state", () => {
      const atom = createSessionAtom()

      expect(atom.get()).toEqual({
        data: null,
        error: null,
        isPending: true,
      })
    })
  })

  describe("createSignalAtom", () => {
    it("should create a signal atom", () => {
      const atom = createSignalAtom()

      expect(atom.get()).toBe(false)
    })
  })

  describe("createDynamicProxy", () => {
    it("should create a proxy that converts paths to API calls", async () => {
      const mockResponse = { data: { id: 1 }, error: null }
      const mockFetch = vi.fn().mockResolvedValue(mockResponse)

      const proxy = createDynamicProxy(
        {},
        mockFetch as unknown as NevrFetch,
        {},
        {},
        []
      )

      // Access a nested path
      const result = await (proxy as any).users.list()

      expect(mockFetch).toHaveBeenCalledWith(
        "/users/list",
        expect.any(Object)
      )
    })

    it("should convert camelCase to kebab-case", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })

      const proxy = createDynamicProxy(
        {},
        mockFetch as unknown as NevrFetch,
        {},
        {},
        []
      )

      await (proxy as any).myNamespace.myMethod()

      expect(mockFetch).toHaveBeenCalledWith(
        "/my-namespace/my-method",
        expect.any(Object)
      )
    })

    it("should use POST for paths in pathMethods", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ data: null, error: null })

      const proxy = createDynamicProxy(
        {},
        mockFetch as unknown as NevrFetch,
        { "/auth/sign-in": "POST" },
        {},
        []
      )

      await (proxy as any).auth.signIn({ email: "test@test.com" })

      expect(mockFetch).toHaveBeenCalledWith(
        "/auth/sign-in",
        expect.objectContaining({
          method: "POST",
        })
      )
    })

    it("should return existing properties from routes object", () => {
      const customAction = vi.fn()

      const proxy = createDynamicProxy(
        { customAction },
        vi.fn() as unknown as NevrFetch,
        {},
        {},
        []
      )

      expect((proxy as any).customAction).toBe(customAction)
    })
  })
})
