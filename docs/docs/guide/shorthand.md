# Schema Shorthand API

The shorthand API provides a fluent interface for building plugin schemas. Add entities, extend existing ones, and define fields with simple helper functions.

## schema() Builder

The `schema()` function returns a builder for composing plugin schemas:

```typescript
import { schema, string, datetime, int } from "nevr"

const paymentSchema = schema()
  .add({
    name: "subscription",
    fields: {
      userId: string,
      plan: string.default("free"),
      expiresAt: datetime.optional(),
    },
  })
  .extend({
    entity: "user",
    fields: {
      stripeCustomerId: { type: "string", input: false },
    },
  })
  .build()
```

## Adding Entities

### add()

Create a new entity:

```typescript
schema()
  .add({
    name: "invoice",
    fields: {
      amount: int,
      currency: string.default("usd"),
      paidAt: datetime.optional(),
      customerId: string,
    },
    description: "Payment invoices",
    internal: false,    // Generate CRUD routes
    routePath: "/invoices",
  })
```

### AddEntityOptions

```typescript
interface AddEntityOptions {
  name: string                              // Entity name
  fields: Record<string, FieldBuilder>      // Field definitions
  description?: string                      // For documentation
  internal?: boolean                        // If true, no routes generated
  routePath?: string                        // Custom route path
  required?: boolean                        // If true, can't be removed
}
```

## Extending Entities

### extend()

Add fields to existing entities (useful in plugins):

```typescript
schema()
  .extend({
    entity: "user",
    fields: {
      role: { type: "string", input: false, default: "user" },
      stripeCustomerId: { type: "string", input: false, required: false },
      emailVerified: { type: "boolean", input: false, default: false },
    },
  })
```

### ExtendEntityOptions

```typescript
interface ExtendEntityOptions {
  entity: string                            // Target entity name
  fields: Record<string, FieldBuilder>      // Fields to add
}
```

## Removing Entities and Fields

### remove()

Remove an entity (if not required/locked):

```typescript
schema()
  .add({ name: "tempEntity", fields: { ... } })
  .remove({ entity: "tempEntity" })
```

### removeField()

Remove a specific field from an entity:

```typescript
schema()
  .extend({
    entity: "user",
    fields: {
      legacyField: string,
      newField: string,
    },
  })
  .removeField({ entity: "user", field: "legacyField" })
```

## Field Helpers

### Protected Fields (input: false)

Protected fields can only be set by server-side code:

```typescript
import { protectedField } from "nevr/plugins/core/shorthand"

const fields = {
  role: protectedField("string", { default: "user" }),
  createdBy: protectedField("string"),
  verifiedAt: protectedField("datetime", { required: false }),
}
```

Client can't set these fields:

```typescript
// POST /users
{
  "email": "john@example.com",
  "role": "admin"  // Ignored! Protected field
}
```

### Hidden Fields (returned: false)

Hidden fields are never sent to clients:

```typescript
import { hiddenField } from "nevr/plugins/core/shorthand"

const fields = {
  passwordHash: hiddenField("string"),
  internalNotes: hiddenField("string", { required: false }),
}
```

Response never includes hidden fields:

```typescript
// GET /users/123
{
  "id": "123",
  "email": "john@example.com"
  // passwordHash is not included
}
```

### Secret Fields (input: false + returned: false)

Secret fields are both protected and hidden:

```typescript
import { secretField } from "nevr/plugins/core/shorthand"

const fields = {
  apiKey: secretField("string"),
  internalToken: secretField("string"),
}
```

## Common Field Definitions

Pre-built field definitions for common patterns:

```typescript
import { commonFields } from "nevr/plugins/core/shorthand"

schema().extend({
  entity: "user",
  fields: {
    // Protected role field with default
    role: commonFields.role("user"),

    // Stripe customer ID (protected, optional)
    stripeCustomerId: commonFields.stripeCustomerId(),

    // Password hash (hidden)
    password: commonFields.password(),

    // Email verified flag (protected)
    emailVerified: commonFields.emailVerified(false),

    // Banned status (protected)
    banned: commonFields.banned(false),

    // Last login timestamp (protected)
    lastLoginAt: commonFields.lastLoginAt(),

    // API key (protected + hidden)
    apiKey: commonFields.apiKey(),
  },
})
```

### Available Common Fields

| Field | Type | Input | Returned | Default |
|-------|------|-------|----------|---------|
| `role(default)` | string | false | true | "user" |
| `stripeCustomerId()` | string | false | true | - |
| `password()` | string | true | false | - |
| `emailVerified(default)` | boolean | false | true | false |
| `banned(default)` | boolean | false | true | false |
| `lastLoginAt()` | datetime | false | true | - |
| `apiKey()` | string | false | false | - |

## Standalone Functions

For simpler usage without builder:

### addEntity()

```typescript
import { addEntity } from "nevr/plugins/core/shorthand"

const { name, def } = addEntity({
  name: "invoice",
  fields: {
    amount: int,
    currency: string.default("usd"),
  },
})
```

### extendEntity()

```typescript
import { extendEntity } from "nevr/plugins/core/shorthand"

const userExtensions = extendEntity({
  entity: "user",
  fields: {
    role: commonFields.role(),
    stripeCustomerId: commonFields.stripeCustomerId(),
  },
})
```

## Complete Plugin Example

Using shorthand to build an auth plugin:

```typescript
import {
  schema,
  protectedField,
  hiddenField,
  secretField,
  commonFields,
} from "nevr/plugins/core/shorthand"
import { string, datetime, boolean } from "nevr"

export const authPlugin = {
  name: "auth",

  schema: schema()
    // Add session entity
    .add({
      name: "session",
      fields: {
        userId: string,
        token: secretField("string"),
        expiresAt: datetime,
        userAgent: string.optional(),
        ipAddress: string.optional(),
      },
      internal: true,  // No public routes
    })

    // Add verification token entity
    .add({
      name: "verificationToken",
      fields: {
        identifier: string,
        token: secretField("string"),
        expires: datetime,
      },
      internal: true,
    })

    // Extend user with auth fields
    .extend({
      entity: "user",
      fields: {
        password: hiddenField("string"),
        emailVerified: protectedField("boolean", { default: false }),
        verifiedAt: protectedField("datetime", { required: false }),
        role: commonFields.role("user"),
        lastLoginAt: commonFields.lastLoginAt(),
        banned: commonFields.banned(),
      },
    })

    .build(),

  // Plugin endpoints, hooks, etc.
  endpoints: [...],
}
```

## Field Definition Reference

### PluginFieldDef

```typescript
interface PluginFieldDef {
  type: "string" | "int" | "float" | "boolean" | "datetime" | "json"
  required?: boolean        // Default: true
  unique?: boolean          // Default: false
  default?: unknown         // Default value
  input?: boolean           // Can client set this? Default: true
  returned?: boolean        // Is this returned? Default: true
  transform?: {
    input?: (value: unknown) => unknown   // Transform on input
    output?: (value: unknown) => unknown  // Transform on output
  }
}
```

## Best Practices

1. **Use protectedField for system fields** - Role, status, internal IDs
2. **Use hiddenField for sensitive data** - Passwords, tokens (that need input)
3. **Use secretField for internal-only** - API keys, internal tokens
4. **Use commonFields for consistency** - Standard patterns across projects
5. **Build schemas incrementally** - Chain operations in logical order

## Next Steps

- [Plugin Development](/plugins/creating) - Creating custom plugins
- [Entity Fields](/fields/overview) - Field types reference
- [Transactions](/guide/transactions) - Multi-entity operations
