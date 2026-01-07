# Plugin Development Guide

Advanced guide for creating Nevr plugins.

## Plugin Architecture

Plugins extend Nevr with:
- **Schema**: Entities and fields
- **Routes**: Custom API endpoints
- **Middleware**: Request processing
- **Hooks**: Lifecycle events
- **Services**: Dependency injection

---

## Creating a Plugin

### Using definePlugin()

```typescript
import { createPlugin } from "nevr"

export const myPlugin = createPlugin({
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0"

  factory: (options) => ({
    schema: {
      entities: {
        myEntity: {
          fields: {
            name: { type: "string", required: true }
          }
        }
      }
    },
    endpoints: {
      ping: endpoint("/ping", {
      method: "GET",
      handler: async () => ({ message: "pong" }),
    }),
    },
  })
})
```



## Plugin Resolution Functions

### resolveAllPlugins()

Resolve all registered plugins:

```typescript
import { resolveAllPlugins } from "nevr"

const resolved = resolveAllPlugins()
// Returns: ResolvedPlugin[]
```

### initializeAllPlugins()

Initialize all plugins (call init hooks):

```typescript
import { initializeAllPlugins } from "nevr"

await initializeAllPlugins(nevrInstance)
```

### mergeResolvedPlugins()

Merge multiple resolved plugins:

```typescript
import { mergeResolvedPlugins } from "nevr"

const merged = mergeResolvedPlugins(resolvedPlugins)
// { entities, entityMeta, routes, middleware }
```

---

## Entity References

### plugin()

Reference plugin entities:

```typescript
import { plugin } from "nevr"

const user = entity("post", {
  author: belongsTo(plugin("auth").user)
})
```

### parseEntityRef() / resolveEntityRef()

Parse and resolve entity references:

```typescript
import { parseEntityRef, resolveEntityRef } from "nevr"

const ref = parseEntityRef("auth.user")
// { pluginId: "auth", entityName: "user" }

const entity = resolveEntityRef("auth.user", localEntitiesMap)
```

---

## Plugin Registry

| Function | Description |
|----------|-------------|
| `registerPluginFactory(id, factory)` | Register factory |
| `getPluginFactory(id)` | Get factory by ID |
| `createFromFactory(id, options)` | Create instance |
| `registerPluginInstance(id, plugin)` | Register instance |
| `getPluginInstance(id)` | Get instance |
| `validatePlugin(plugin)` | Validate structure |
| `getAllPlugins()` | Get all instances |
| `clearPluginRegistry()` | Clear registry |

---

## See Also

- [Plugin Concepts](/concepts/plugin)
- [Auth Plugin](/plugins/auth)
- [Service Container](/services/container)
