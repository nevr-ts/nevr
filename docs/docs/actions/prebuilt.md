# Pre-built Actions

> 📦 **Ready-to-use actions for common entity operations. Drop in and go!**

## Why Pre-built Actions?

Many applications need the same patterns repeatedly:

| Pattern | Why Re-implement? | Pre-built Solution |
|---------|-------------------|--------------------|
| **Soft delete** | Every app needs "delete without losing data" | `softDeleteAction()` |
| **Toggle states** | Active/inactive, enabled/disabled are universal | `toggleAction()` |
| **Bulk operations** | Admins always need mass updates/deletes | `bulkUpdateAction()` / `bulkDeleteAction()` |
| **Export data** | CSV/JSON exports are common requirements | `exportAction()` |

> 🟢 **Beginner Tip**: Start with pre-built actions to ship faster. You can always replace them with custom implementations later if needed.

> 🟡 **Intermediate Tip**: Pre-built actions are just regular action definitions. View their source code for patterns to follow when creating your own.

## Available Actions

```typescript
import {
  softDeleteAction,
  restoreAction,
  archiveAction,
  unarchiveAction,
  cloneAction,
  bulkUpdateAction,
  bulkDeleteAction,
  toggleAction,
  exportAction,
  countAction,
  existsAction,
} from "nevr"
```

---

## softDeleteAction()

Soft delete by setting a timestamp field instead of hard delete.

```typescript
// Signature
softDeleteAction(fieldName?: string): ActionDefinition

// Default field: "deletedAt"
```

### Usage

```typescript
const post = entity("post", {
  title: string,
  content: text,
  deletedAt: datetime.optional(),
})
  .actions({
    softDelete: softDeleteAction(),  // Uses "deletedAt"
    // Or custom field
    softDelete: softDeleteAction("removedAt"),
  })
```

### Endpoint

```bash
DELETE /api/posts/:id/soft
# Sets deletedAt = new Date()
# Response: { success: true }
```

---

## restoreAction()

Restore a soft-deleted record by clearing the timestamp.

```typescript
// Signature
restoreAction(fieldName?: string): ActionDefinition

// Default field: "deletedAt"
```

### Usage

```typescript
const post = entity("post", {
  title: string,
  deletedAt: datetime.optional(),
})
  .actions({
    softDelete: softDeleteAction(),
    restore: restoreAction(),
  })
```

### Endpoint

```bash
POST /api/posts/:id/restore
# Sets deletedAt = null
# Response: { success: true }
```

---

## archiveAction() / unarchiveAction()

Toggle an `archived` boolean field.

```typescript
const document = entity("document", {
  title: string,
  content: text,
  archived: bool.default(false),
})
  .actions({
    archive: archiveAction(),    // Sets archived = true
    unarchive: unarchiveAction(), // Sets archived = false
  })
```

### Endpoints

```bash
POST /api/documents/:id/archive
# Response: { success: true }

POST /api/documents/:id/unarchive
# Response: { success: true }
```

---

## cloneAction()

Duplicate a record, excluding ID and timestamps.

```typescript
// Signature
cloneAction<T>(fieldsToExclude?: string[]): ActionDefinition

// Default excluded: ["id", "createdAt", "updatedAt"]
```

### Usage

```typescript
const template = entity("template", {
  name: string,
  content: text,
  category: string,
})
  .actions({
    clone: cloneAction(),
    // Or exclude additional fields
    clone: cloneAction(["id", "createdAt", "updatedAt", "slug"]),
  })
```

### Endpoint

```bash
POST /api/templates/:id/clone
# Response: { id: "new-id", name: "...", content: "...", ... }
```

---

## bulkUpdateAction()

Update multiple records at once.

```typescript
const product = entity("product", {
  name: string,
  status: string,
  category: string,
})
  .actions({
    bulkUpdate: bulkUpdateAction(),
  })
```

### Endpoint

```bash
PUT /api/products/bulk
Content-Type: application/json

{
  "ids": ["prod_1", "prod_2", "prod_3"],
  "data": {
    "status": "active",
    "category": "electronics"
  }
}

# Response: { count: 3 }
```

---

## bulkDeleteAction()

Delete multiple records at once.

```typescript
const notification = entity("notification", {
  message: string,
  read: bool,
})
  .actions({
    bulkDelete: bulkDeleteAction(),
  })
```

### Endpoint

```bash
DELETE /api/notifications/bulk
Content-Type: application/json

{
  "ids": ["notif_1", "notif_2", "notif_3"]
}

# Response: { count: 3 }
```

---

## toggleAction()

Toggle a boolean field.

```typescript
// Signature
toggleAction(field: string): ActionDefinition
```

### Usage

```typescript
const feature = entity("feature", {
  name: string,
  enabled: bool.default(false),
})
  .actions({
    toggle: toggleAction("enabled"),
  })

const user = entity("user", {
  email: string,
  active: bool.default(true),
  verified: bool.default(false),
})
  .actions({
    toggleActive: toggleAction("active"),
    toggleVerified: toggleAction("verified"),
  })
```

### Endpoint

```bash
POST /api/features/:id/toggle-enabled
# Response: { enabled: true }  (or false if it was true)
```

---

## exportAction()

Export all records in JSON or CSV format.

```typescript
const order = entity("order", {
  orderNumber: string,
  status: string,
  total: float,
  createdAt: datetime,
})
  .actions({
    export: exportAction(),
  })
```

### Endpoints

```bash
# JSON export (default)
GET /api/orders/export
GET /api/orders/export?format=json
# Response: [{ id: "...", orderNumber: "...", ... }, ...]

# CSV export
GET /api/orders/export?format=csv
# Response:
# id,orderNumber,status,total,createdAt
# "ord_1","ORD-001","completed",99.99,"2024-01-15T..."
# "ord_2","ORD-002","pending",49.99,"2024-01-16T..."
```

---

## countAction()

Count records with optional filters.

```typescript
const user = entity("user", {
  email: string,
  role: string,
  active: bool,
})
  .actions({
    count: countAction(),
  })
```

### Endpoints

```bash
# Count all
GET /api/users/count
# Response: { count: 150 }

# Count with filters
GET /api/users/count?role=admin
# Response: { count: 5 }

GET /api/users/count?active=true&role=user
# Response: { count: 120 }
```

---

## existsAction()

Check if a specific record exists.

```typescript
const product = entity("product", {
  sku: string.unique(),
  name: string,
})
  .actions({
    exists: existsAction(),
  })
```

### Endpoint

```bash
GET /api/products/:id/exists
# Response: { exists: true }  (or false)
```

---

## Combining Actions

Attach multiple pre-built actions to an entity:

```typescript
const article = entity("article", {
  title: string,
  content: text,
  status: string.default("draft"),
  archived: bool.default(false),
  deletedAt: datetime.optional(),
})
  .actions({
    // Soft delete & restore
    softDelete: softDeleteAction(),
    restore: restoreAction(),

    // Archive system
    archive: archiveAction(),
    unarchive: unarchiveAction(),

    // Duplicate content
    clone: cloneAction(),

    // Bulk operations
    bulkUpdate: bulkUpdateAction(),
    bulkDelete: bulkDeleteAction(),

    // Utilities
    count: countAction(),
    exists: existsAction(),
    export: exportAction(),
  })
```

---

## Custom Pre-built Actions

Create your own reusable actions:

```typescript
// Publish action
export function publishAction(): ActionDefinition {
  return {
    method: "POST",
    path: "/:id/publish",
    description: "Publish a record",
    handler: async (ctx) => {
      const { id } = ctx.params
      await ctx.driver.update(ctx.entity, { id }, {
        status: "published",
        publishedAt: new Date(),
      })
      return { success: true }
    },
  }
}

// Increment view count
export function incrementViewsAction(): ActionDefinition {
  return {
    method: "POST",
    path: "/:id/view",
    handler: async (ctx) => {
      const record = await ctx.driver.findOne(ctx.entity, { id: ctx.params.id })
      await ctx.driver.update(ctx.entity, { id: ctx.params.id }, {
        views: (record?.views || 0) + 1
      })
      return { views: (record?.views || 0) + 1 }
    },
  }
}

// Use
const post = entity("post", { ... })
  .actions({
    publish: publishAction(),
    view: incrementViewsAction(),
  })
```

---

## Next Steps

- [Creating Actions](/actions/creating) - Build custom actions
- [Workflows](/actions/workflows) - Multi-step operations
- [Actions Overview](/actions/overview) - Full action system
