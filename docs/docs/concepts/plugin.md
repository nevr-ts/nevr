# Plugins

Plugins are the mechanism to extend Nevr's core functionality. They can intercept requests, modify schemas, add new routes, or inject behavior into entities.

## How Plugins Work

Plugins hook into the Nevr lifecycle. They can:
- Add fields to every entity (e.g., `createdAt`, `updatedAt`).
- Add global routes (e.g., `/auth/login`).
- Wrap existing routes with middleware (e.g., checking permissions).

## Common Plugins

### Timestamp Plugin

Automatically adds `createdAt` and `updatedAt` fields to your entities.

```typescript
import { timestamps } from "nevr/plugins/timestamps"

const api = nevr({
  // ...
  plugins: [timestamps()]
})
```

### Auth Plugin (Better Auth)

Provides full authentication flows.

```typescript
import { auth } from "nevr/plugins/auth"

const api = nevr({
  // ...
  plugins: [auth({ ...config })]
})
```

## Creating a Plugin

You can create your own plugins to encapsulate reusable logic.

```typescript
const myPlugin = {
  name: "my-plugin",
  setup(nevr) {
    // Hook into Nevr here
  }
}
```
