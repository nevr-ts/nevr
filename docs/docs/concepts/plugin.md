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
// nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"

export const config = defineConfig({
  database: "sqlite",
  entities: [],
  plugins: [
    auth({
      emailAndPassword: { enabled: true },
    }),
  ],
})

export default config
```

Set `NEVR_AUTH_SECRET` in your `.env` file (minimum 32 characters):

```bash
NEVR_AUTH_SECRET="your-random-secret-key-at-least-32-chars"
```

The plugin reads from `NEVR_AUTH_SECRET` (or `AUTH_SECRET`) automatically — no need to pass `secret` in the plugin options.

The auth plugin automatically:
- Creates `user` and `session` entities
- Adds sign-up, sign-in, sign-out routes
- Populates `req.user` for authorization rules
- Handles password hashing and session management

### Timestamp Plugin

Automatically adds `createdAt` and `updatedAt` fields to your entities (enabled by default).

```typescript
// Add to your nevr.config.ts plugins array
import { timestamps } from "nevr/plugins/timestamps"

plugins: [timestamps()]
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
