import { describe, it, expect, vi } from "vitest"
import { createAdapterFactory } from "./escape-hatch.js"
import type { NevrInstance, NevrRequest, NevrResponse } from "../types.js"

describe("HTTP Escape Hatch", () => {
    it("should expose the native request object via req.native", async () => {
        // 1. Mock Native Request
        const mockNativeReq = {
            url: "/test",
            method: "GET",
            headers: { "content-type": "application/json" },
            raw_stream: "FAKE_STREAM_DATA" // Simulate a raw property we want to access
        }

        const mockNativeRes = {
            send: vi.fn()
        }

        // 2. Mock Nevr Instance
        // We capture the NevrRequest passed to handleRequest to verify it
        let capturedReq: NevrRequest | undefined
        const mockNevr: NevrInstance = {
            handleRequest: async (req: any) => {
                capturedReq = req
                return { status: 200, body: { ok: true } }
            },
            // ... partial mock
        } as any

        // 3. Create Adapter
        const factory = createAdapterFactory<typeof mockNativeReq, typeof mockNativeRes, any>({
            config: { adapterId: "test-adapter" },
            methods: {
                getMethod: (r) => r.method,
                getPath: (r) => r.url,
                getQuery: () => ({}),
                getBody: () => ({}),
                getHeaders: (r) => r.headers as any,
                getUser: () => null,
                sendResponse: (res, response) => res.send(response)
            },
            createHandler: (handle) => ((req: any, res: any) => handle(req, res))
        })

        const adapter = factory(mockNevr)
        const handler = adapter.createHandler(mockNevr) // The arg here doesn't matter for the test setup logic used by createAdapterFactory

        // 4. Execute
        await handler(mockNativeReq, mockNativeRes)

        // 5. Assert Escape Hatch
        expect(capturedReq).toBeDefined()
        expect(capturedReq?.native).toBeDefined()
        expect(capturedReq?.native).toBe(mockNativeReq) // Strict equality check

        // Verify we can access the custom property
        const raw = capturedReq?.native as typeof mockNativeReq
        expect(raw.raw_stream).toBe("FAKE_STREAM_DATA")
    })
})
