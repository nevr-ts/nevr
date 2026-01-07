# Creating Plugins

Nevr's plugin system is designed to be **simple by default** but **powerful when needed**.

## Quickstart

Use `createPlugin` with `endpoints{}` to build your plugin:

```typescript
import { createPlugin, endpoint } from "nevr"

const myPlugin = createPlugin({
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  
  // Endpoints (auto-wired to client)
  endpoints: {
    ping: endpoint("/ping", {
      method: "GET",
      handler: async () => ({ message: "pong" }),
    }),
  },
  
  // Lifecycle hooks
  lifecycle: {
    onInit: () => console.log("Plugin initialized!"),
  },
})

// Usage
const api = nevr({ plugins: [myPlugin] })
```

---

## Configurable Plugins (Factory Pattern)

For plugins that need user-provided options:

```typescript
interface MyOptions {
  apiKey: string
  enabled?: boolean
}

const myPlugin = createPlugin<MyOptions>({
  id: "my-service",
  name: "My Service",
  version: "1.0.0",

  defaults: { enabled: true },

  validate: (opts) => {
    if (!opts.apiKey) return ["apiKey is required"]
  },

  factory: (options) => ({
    endpoints: {
      status: endpoint("/status", {
        method: "GET",
        handler: async () => ({ connected: options.enabled }),
      }),
    },
  }),
})

// Usage
nevr({ plugins: [myPlugin({ apiKey: "secret_123" })] })
```

---

## Plugin Capabilities

### 1. Schema & Entities

Add new database entities or extend existing ones:

```typescript
import { schemaFromEntities } from "nevr"
import { subscription } from "./entities"

factory: (options) => ({
  // Import entities from separate files (recommended)
  schema: schemaFromEntities([subscription]),
  
  // Or extend existing entities from other plugins
  schema: {
    extend: {
      user: {
        phone: { type: "string", optional: true },
      },
    },
  },
})
```

### 2. Entity Hooks

Intercept database CRUD operations to add custom logic. Hooks run before or after create, update, and delete operations.

```typescript
entityHooks: {
  user: {
    create: {
      before: async (ctx) => {
        // Normalize email before saving
        ctx.data.email = ctx.data.email.toLowerCase()
        return ctx
      },
      after: async (ctx) => {
        // Send welcome email after user is created
        await sendWelcomeEmail(ctx.result.email)
      },
    },
  },
}
```

### 3. Request Interceptors

Run middleware logic before or after API requests. Use matchers to target specific paths.

```typescript
interceptors: {
  before: [
    {
      // Match requests to admin endpoints
      matcher: (ctx) => ctx.path.startsWith("/admin"),
      handler: async (ctx, next) => {
        if (!ctx.user?.isAdmin) throw new Error("Forbidden")
        return next()
      },
    },
  ],
}
```

---

## Reference: `createPlugin` Options

| Property | Type | Required | Description |
|:--|:--|:--|:--|
| `id` | `string` | ✅ | Unique identifier for the plugin (e.g., `"my-plugin"`) |
| `name` | `string` | - | Human-readable display name |
| `version` | `string` | - | Semantic version (e.g., `"1.0.0"`) |
| `basePath` | `string` | - | Base URL path for all endpoints (default: `/{id}`) |
| `dependencies` | `string[]` | - | Plugin IDs that must be loaded first |
| `schema` | `PluginSchema` | - | Entity definitions or field extensions |
| `endpoints` | `Record<string, EndpointDefinition>` | - | API endpoints exposed by the plugin |
| `lifecycle` | `LifecycleHooks` | - | Hooks for plugin init, shutdown, etc. |
| `interceptors` | `RequestInterceptors` | - | Before/after request middleware |
| `entityHooks` | `EntityHooks` | - | Hooks for database CRUD operations |
| `defaults` | `Partial<TOptions>` | - | Default values for plugin options |
| `validate` | `(opts) => string[]` | - | Validation function for options |
| `factory` | `(opts) => PluginContent` | - | Factory function for dynamic content |

---

## Reference: `endpoint()` Helper

The `endpoint()` helper creates typed endpoint definitions:

```typescript
endpoint("/path", {
  method: "POST",
  input: { email: string, password: string },
  handler: async (ctx) => { ... },
})
```

| Property | Type | Required | Description |
|:--|:--|:--|:--|
| `method` | `"GET" \| "POST" \| "PUT" \| "DELETE"` | ✅ | HTTP method |
| `input` | `Record<string, FieldDef>` | - | Input schema for request validation |
| `handler` | `(ctx) => Promise<any>` | ✅ | Request handler function |
| `rules` | `RuleDef[]` | - | Authorization rules (e.g., `"authenticated"`) |
| `meta` | `EndpointMeta` | - | OpenAPI metadata (summary, tags, etc.) |

---

## Reference: Lifecycle Hooks

Lifecycle hooks let you run code at specific points in the plugin/server lifecycle:

| Hook | When It Runs | Use Case |
|:--|:--|:--|
| `onRegister` | Plugin is added to Nevr | Check dependencies, initial setup |
| `onInit` | Nevr instance is fully ready | Connect to external services, seed data |
| `onShutdown` | Server is stopping | Cleanup connections, flush logs |
| `onRequest` | Every incoming request | Global logging, metrics |
| `onError` | Any error occurs | Error tracking, notifications |
| `onHotReload` | Config changes at runtime | Refresh cached data |

```typescript
lifecycle: {
  onInit: async (nevr) => {
    console.log("Plugin ready, entities:", Object.keys(nevr.entities))
  },
  onShutdown: async () => {
    await closeConnections()
  },
}
```

---

## Reference: Entity Hooks

Entity hooks intercept database operations. Use them for validation, transformation, side effects, or audit logging.

| Operation | Available Hooks | Description |
|:--|:--|:--|
| `create` | `before`, `after` | New record being created |
| `update` | `before`, `after` | Existing record being modified |
| `delete` | `before`, `after` | Record being deleted |

**Hook Context (`ctx`):**

| Property | Type | Description |
|:--|:--|:--|
| `data` | `object` | Input data (modifiable in `before`) |
| `existingData` | `object` | Current record (for update/delete) |
| `result` | `object` | Created/updated record (in `after`) |
| `user` | `User \| null` | Current authenticated user |
| `driver` | `Driver` | Database driver for queries |

---

## Reference: Request Interceptors

Interceptors are middleware that run before or after request handlers. Use matchers to target specific requests.

| Property | Type | Description |
|:--|:--|:--|
| `before` | `Interceptor[]` | Runs before the endpoint handler |
| `after` | `Interceptor[]` | Runs after the endpoint handler |

**Interceptor Structure:**

| Property | Type | Description |
|:--|:--|:--|
| `matcher` | `string \| RegExp \| Function` | Determines which requests to intercept |
| `handler` | `(ctx, next) => Promise<any>` | Middleware function |

**Matcher Examples:**

```typescript
// String: exact path match
matcher: "/admin/users"

// RegExp: pattern match
matcher: /^\/api\/v[0-9]+/

// Function: custom logic
matcher: (ctx) => ctx.method === "DELETE"
```

---

## Best Practices

1. **Unique IDs**: Use `scope/plugin-name` format (e.g., `"acme/analytics"`)
2. **Type Safety**: Export your Options interface for consumers
3. **Validation**: Use `validate` hook to check required config early
4. **No Globals**: Store state in plugin closure, not global variables
5. **Dependencies**: Declare dependencies explicitly

---


