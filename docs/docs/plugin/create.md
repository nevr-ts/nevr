# Creating Plugins

Nevr provides a type-safe `definePlugin` helper to make creating plugins easy. This guide will walk you through building a reusable plugin.

## 1. Basic Structure

Start by importing `definePlugin` and defining your options interface.

```typescript
import { definePlugin } from "nevr"

interface MyPluginOptions {
  apiKey: string
  enableFeatureX?: boolean
}

export const myPlugin = definePlugin<MyPluginOptions>({
  meta: {
    id: "my-plugin",
    name: "My Awesome Plugin",
    version: "1.0.0",
  },
  
  defaults: {
    enableFeatureX: true
  },
  
  validate: (options) => {
    if (!options.apiKey) return ["apiKey is required"]
  },
  
  factory: (options, extension) => {
    // Plugin logic goes here
    return {
      // ...
    }
  }
})
```

## 2. Defining Schema

Plugins can define their own entities and extend existing ones.

```typescript
factory: (options, extension) => {
  return {
    schema: {
      // Define new entities
      entities: {
        auditLog: {
          description: "System audit logs",
          fields: {
            action: { type: "string", required: true },
            details: { type: "json" },
            ipAddress: { type: "string" }
          }
        }
      },
      
      // Extend existing entities (e.g., User)
      extend: {
        user: {
          lastLoginAt: { 
            type: "datetime",
            description: "Track last login time"
          }
        }
      }
    }
  }
}
```

## 3. Adding Routes

Plugins can provide their own API endpoints.

```typescript
factory: (options) => {
  return {
    routes: (nevr) => [
      {
        method: "GET",
        path: "/my-plugin/status",
        handler: async (req) => {
          return {
            status: 200,
            body: { status: "active", featureX: options.enableFeatureX }
          }
        }
      }
    ]
  }
}
```

## 4. Lifecycle Hooks

Use hooks to run code during application startup or request processing.

```typescript
factory: (options) => {
  return {
    lifecycle: {
      onInit: async (nevr) => {
        console.log("My Plugin initialized!")
      },
      
      onRequest: async (req, nevr) => {
        // Global middleware logic
        req.context.myPluginData = "some-value"
      }
    }
  }
}
```

## 5. Handling Extensions

The `extension` argument in the factory allows you to see how the user customized your plugin. Nevr handles the schema merging automatically, but you might want to react to extensions in your logic.

```typescript
factory: (options, extension) => {
  if (extension?.entities?.auditLog?.remove) {
    console.warn("Audit logging has been disabled by the user")
  }
  
  return {
    // ...
  }
}
```

## Complete Example: Simple Audit Plugin

```typescript
import { definePlugin } from "nevr"

export const auditLog = definePlugin({
  meta: {
    id: "audit",
    name: "Audit Logger",
    version: "1.0.0"
  },
  
  factory: () => ({
    schema: {
      entities: {
        log: {
          fields: {
            method: { type: "string", required: true },
            path: { type: "string", required: true },
            duration: { type: "int", required: true }
          }
        }
      }
    },
    
    lifecycle: {
      onRequest: async (req, nevr) => {
        const start = Date.now()
        
        // Hook into response to log duration
        // (Note: Real implementation would use a proper middleware/hook system)
        const originalEnd = req.rawResponse?.end
        if (originalEnd) {
           // ... logic to capture end time
        }
      }
    }
  })
})
```
