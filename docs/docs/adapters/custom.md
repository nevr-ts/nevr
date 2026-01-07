# Custom Adapters

Build adapters for any HTTP framework.

## Adapter Interface

```typescript
interface Adapter {
  // Convert framework request to NevrRequest
  toNevrRequest(req: any): NevrRequest

  // Convert NevrResponse to framework response
  fromNevrResponse(res: NevrResponse, frameworkRes: any): void
}
```

## NevrRequest

```typescript
interface NevrRequest {
  method: string
  path: string
  headers: Record<string, string>
  query: Record<string, any>
  body: any
  params: Record<string, string>
}
```

## NevrResponse

```typescript
interface NevrResponse {
  status: number
  body: any
  headers?: Record<string, string>
}
```

## Creating Custom Adapter

```typescript
import { createAdapterFactory } from "nevr/adapters"

export function createFastifyAdapter(nevr) {
  return async (request, reply) => {
    // Convert to NevrRequest
    const nevrReq: NevrRequest = {
      method: request.method,
      path: request.url,
      headers: request.headers,
      query: request.query,
      body: request.body,
      params: request.params,
    }

    // Process through Nevr
    const nevrRes = await nevr.handleRequest(nevrReq)

    // Send response
    reply
      .status(nevrRes.status)
      .headers(nevrRes.headers || {})
      .send(nevrRes.body)
  }
}
```

## Usage

```typescript
import Fastify from "fastify"
import { createFastifyAdapter } from "./fastify-adapter"
import { api } from "./config"

const fastify = Fastify()

fastify.all("/api/*", createFastifyAdapter(api))

fastify.listen({ port: 3000 })
```

## Example: Koa Adapter

```typescript
export function createKoaAdapter(nevr) {
  return async (ctx) => {
    const nevrReq = {
      method: ctx.method,
      path: ctx.path,
      headers: ctx.headers,
      query: ctx.query,
      body: ctx.request.body,
      params: ctx.params,
    }

    const nevrRes = await nevr.handleRequest(nevrReq)

    ctx.status = nevrRes.status
    ctx.body = nevrRes.body
    if (nevrRes.headers) {
      Object.entries(nevrRes.headers).forEach(([k, v]) => {
        ctx.set(k, v)
      })
    }
  }
}
```

## Next Steps

- [Express Adapter](/adapters/express)
- [Hono Adapter](/adapters/hono)
