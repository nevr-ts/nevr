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

```ts
import { nevr } from "nevr"
import { auth } from "nevr/plugins/auth"
import { prisma } from "nevr/drivers/prisma"

const api = nevr({
  entities: [],
  driver: prisma(db),
  plugins: [
    auth({
      mode: "session",          // "session" | "bearer"
      emailAndPassword: true,   // Enable email/password auth
    })
  ]
})
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
import { timestamps } from "nevr/plugins/timestamps"

const api = nevr({ entities, driver, plugins: [timestamps()] })
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
