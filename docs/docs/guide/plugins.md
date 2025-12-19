# Plugins (Feature Layer)

Plugins let you add fields, hooks, middleware, and routes without changing your app code.

## Capabilities

- Extend entities: add fields globally or per-entity
- Lifecycle hooks: `beforeCreate`, `afterUpdate`, etc.
- Request middleware: run before/after requests
- Custom routes: mount additional endpoints

## Authoring a Plugin

```ts
import type { Plugin } from "nevr"

export const auditLog: Plugin = {
  name: "audit-log",
  description: "Console logs CRUD operations",
  hooks: {
    afterCreate: async (ctx) => {
      console.log(`[AUDIT] created ${ctx.entity} by ${ctx.user?.id}`)
    },
  },
}

// nevr instance
// plugins: [auditLog]
```

## Built‑in Plugins

### Timestamps

Add `createdAt`/`updatedAt` (on by default). You can also disable per-entity via `.noTimestamps()`.

```ts
import { timestamps } from "nevr/plugins/timestamps"

const api = nevr({ entities, driver, plugins: [timestamps()] })
```

### Auth (integration-ready)

Use the Express/Hono helpers for development (`devAuth`) or JWT (`jwtAuth`). For full auth suites (e.g., Better Auth), wrap your verifier and keep Nevr decoupled.

```ts
import { expressAdapter, expressJwtAuth } from "nevr/adapters/express"
// const verify = async (token: string) => ({ id: "u_1", role: "admin" })
// app.use("/api", expressAdapter(api, { getUser: expressJwtAuth(verify) }))
```
