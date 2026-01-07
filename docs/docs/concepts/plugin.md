# Plugins

Plugins are the mechanism to extend Nevr's core functionality. They can intercept requests, modify schemas, add new routes, or inject behavior into entities.

## How Plugins Work

Plugins hook into the Nevr lifecycle. They can:
- Add entities (e.g., `user`, `session` for auth).
- Add fields to every entity (e.g., `createdAt`, `updatedAt`).
- Add global routes (e.g., `/api/auth/sign-in`).
- Wrap existing routes with middleware (e.g., checking permissions).

## Built-in Plugins

### Auth Plugin

Self-contained authentication with sessions and user management.

```typescript
import { nevr } from "nevr"
import { auth } from "nevr/plugins/auth"
import { prisma } from "nevr/drivers/prisma"

const api = nevr({
  entities: [],
  driver: prisma(db),
  plugins: [
    auth({
      emailAndPassword: {enabled: true},   // Enable email/password auth
    })
  ]
})
```

Set `NEVR_AUTH_SECRET` in your environment:

```bash
NEVR_AUTH_SECRET="your-random-secret-key"
```

The auth plugin automatically:
- Creates `user` and `session` entities
- Adds sign-up, sign-in, sign-out routes
- Populates `req.user` for authorization rules
- Handles password hashing and session management

### Timestamp Plugin

Automatically adds `createdAt` and `updatedAt` fields to your entities (enabled by default).

```typescript
import { timestamps } from "nevr/plugins/timestamps"

const api = nevr({
  // ...
  plugins: [timestamps()]
})
```

Disable per-entity with `.timestamps(false)`.

## Creating a Plugin

You can create your own plugins to encapsulate reusable logic.

```typescript
import type { createPlugin } from "nevr"

const myPlugin: createPlugin = {
 id: "my-plugin",
 name: "My Plugin",
 version: "1.0.0",

 endpoints: {
    test:endpoint("/test", {
      method: "GET",
      handler: async () => ({ message: "Hello from my plugin!" }),
    }),
  },

  lifecycle: {
    onInit: async (nevr) => {
      // Initialize plugin
    }
  },
  
}
```
