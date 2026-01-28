# Plugins (Feature Layer)

Plugins let you add entities, fields, hooks, middleware, and routes without changing your app code.

## Capabilities

- Add entities: plugins can provide their own entities (e.g., `user`, `session`)
- Extend entities: add fields globally or per-entity
- Lifecycle hooks: `beforeCreate`, `afterUpdate`, etc.
- Request middleware: run before/after requests
- Custom routes: mount additional endpoints

## Built-in Plugins

### Auth Plugin (Self-Contained)

Full authentication with email/password, sessions, and user management. No external dependencies.

Add it to your config:

```ts
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"

export const config = defineConfig({
  database: "sqlite",
  entities: [],
  plugins: [
    auth({
      mode: "session",          // "session" | "bearer"
      emailAndPassword: true,   // Enable email/password auth
    })
  ],
})

export default config
```

Then your server picks it up automatically:

```ts
// src/server.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
```

Set the secret in your environment:

```bash
AUTH_SECRET="your-random-secret-key"
```

**What the auth plugin provides:**

| Feature | Description |
|---------|-------------|
| `user` entity | Stores users (email, password hash, name) |
| `session` entity | Stores active sessions |
| `/api/auth/sign-up` | Create new account |
| `/api/auth/sign-in` | Sign in with email/password |
| `/api/auth/sign-out` | End session |
| `/api/auth/session` | Get current user |
| `req.user` | Populated on every request |

**Auth modes:**

- `"session"` — Uses HTTP-only cookies (best for web apps)
- `"bearer"` — Returns JWT token (best for mobile/API)

### Timestamps

Add `createdAt`/`updatedAt` (on by default). Disable per-entity via `.noTimestamps()`.

```ts
// In nevr.config.ts:
import { timestamps } from "nevr/plugins/timestamps"

export const config = defineConfig({
  database: "sqlite",
  entities: [...],
  plugins: [timestamps()],
})

// In server.ts — nevr({ ...config, driver }) picks up the plugin automatically.
```

## Authoring a Plugin

```ts
import type { NevrPlugin } from "nevr"

export const auditLog: NevrPlugin = {
  meta: {
    id: "audit-log",
    name: "Audit Log",
    version: "1.0.0"
  },
  hooks: {
    afterCreate: async (ctx) => {
      console.log(`[AUDIT] created ${ctx.entity} by ${ctx.user?.id}`)
    },
  },
}

// Usage: plugins: [auditLog]
```
