# Adapters

Adapters in Nevr are responsible for the **HTTP Layer**. They allow Nevr to run inside your favorite web framework.

## Role of an Adapter

1.  **Routing**: Mapping HTTP requests (GET, POST, PUT, DELETE) to Nevr's internal router.
2.  **Context Parsing**: Extracting headers, query parameters, and body content.
3.  **Response Formatting**: Sending the result back to the client in a standard format.

### Request Lifecycle
1.  **Incoming Request**: Adapter receives native framework request.
2.  **Conversion**: Converts to `NevrRequest` using `toNevrRequest()`. 
3.  **Handling**: Nevr core processes the request.
4.  **Response**: Adapter converts `NevrResponse` back to native format.

## Internal Context (`AdapterContext`)
Adapters expose helpers for deep integration:

- `getUser()`: Retrieve the authenticated user from the native request.
- `toNevrRequest()`: Convert raw request for manual handling.
- `fromNevrResponse()`: Helper to send responses manually.

## Available Adapters

### Express Adapter

Use Nevr with the most popular Node.js framework.

```typescript
import { expressAdapter } from "nevr/adapters/express"
import express from "express"

const app = express()
app.use("/api", expressAdapter(nevrInstance))
```

### Hono Adapter

Use Nevr with Hono for high-performance edge deployments (Cloudflare Workers, Bun, Deno).

```typescript
import { honoAdapter } from "nevr/adapters/hono"
import { Hono } from "hono"

const app = new Hono()
app.route("/api", honoAdapter(nevrInstance))
```

### Node.js HTTP Adapter

A raw adapter for the standard `http` module (useful for testing or zero-dependency setups).

```typescript
import { nodeAdapter } from "nevr/adapters/node"
import { createServer } from "http"

const server = createServer(nodeAdapter(nevrInstance))
```

## Creating Custom Adapters
Nevr provides a `createAdapterFactory` helper to simplify building adapters for new frameworks.

```typescript
export const myFrameworkAdapter = createAdapterFactory({
  config: { ... },
  methods: {
    getMethod: (req) => req.method,
    getPath: (req) => req.url,
    // ... implement other abstract methods
  },
  createHandler: (handleRequest) => {
    return (req, res) => handleRequest(req, res)
  }
})
```
