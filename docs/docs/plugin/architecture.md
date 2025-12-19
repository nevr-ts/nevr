# Plugin Architecture

Nevr's plugin system is designed to be **type-safe**, **extensible**, and **schema-first**. Unlike traditional middleware-based plugins, Nevr plugins can define their own database entities, extend existing ones, and provide full-stack features including routes and logic.

## Core Concepts

### 1. Schema-First Design
Plugins in Nevr are not just logic; they are data. A plugin can:
- **Define new entities** (e.g., `stripe_customer`, `audit_log`)
- **Extend existing entities** (e.g., add `avatarUrl` to `user`)
- **Define relationships** (e.g., `user` has many `posts`)

This allows plugins to seamlessly integrate with your application's data model.

### 2. Type-Safe Extension
When you use a plugin, you can customize it. Nevr provides a structured way to:
- Add fields to plugin entities
- Rename or remove fields
- Add completely new entities under the plugin's namespace

All of this is fully typed, ensuring your generated client matches your customized schema.

### 3. Dependency Injection
Plugins can depend on other plugins. For example, the `payments` plugin depends on the `auth` plugin to link customers to users. Nevr resolves these dependencies automatically.

## The Plugin Contract

Every plugin in Nevr follows a strict contract defined by the `NevrPlugin` interface.

```typescript
export interface NevrPlugin {
  meta: {
    id: string          // Unique ID (e.g., "auth")
    name: string        // Human readable name
    version: string     // Semantic version
    dependencies?: string[] // Required plugins
  }
  
  schema?: {
    entities?: Record<string, EntityDef> // New tables
    extend?: Record<string, FieldDef>    // Fields added to others
  }
  
  routes?: Route[]      // API endpoints
  middleware?: Middleware[] // Request processing
  
  lifecycle?: {
    onInit?: (nevr: NevrInstance) => Promise<void>
    onRequest?: (req: NevrRequest) => Promise<void>
  }
}
```

## Using Plugins

For complex applications, we recommend configuring plugins in separate files (e.g., `src/plugins/auth.ts`) and importing them into your main config.

**`src/plugins/payments.ts`**
```typescript
import { payments } from "nevr/plugins/payments"

export const paymentsPlugin = payments({
  provider: "stripe",
  extend: {
    entities: {
      customer: {
        fields: {
          internalNotes: { add: { type: "text" } }
        }
      }
    }
  }
})
```

**`src/config.ts`**
```typescript
import { nevr } from "nevr"
import { authPlugin } from "./plugins/auth"
import { paymentsPlugin } from "./plugins/payments"

export const api = nevr({
  plugins: [
    authPlugin,
    paymentsPlugin
  ]
})
```

## Referencing Plugin Entities

You can create relationships between your entities and plugin entities using the `plugin()` helper.

```typescript
import { entity, belongsTo, plugin } from "nevr"

export const subscription = entity("subscription", {
  // Reference the 'user' entity from the 'auth' plugin
  user: belongsTo(() => plugin("auth").user),
  
  // Reference the 'customer' entity from the 'payments' plugin
  customer: belongsTo(() => plugin("payments").customer)
})
```
