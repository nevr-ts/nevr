# Pre-built Actions

Nevr provides common actions out of the box. Add soft delete, archiving, cloning, bulk operations, and more with one line.

## Available Actions

| Action | Method | Path | Description |
|--------|--------|------|-------------|
| `softDeleteAction()` | DELETE | `/:id/soft` | Soft delete (set deletedAt) |
| `restoreAction()` | POST | `/:id/restore` | Restore soft-deleted |
| `archiveAction()` | POST | `/:id/archive` | Archive record |
| `unarchiveAction()` | POST | `/:id/unarchive` | Unarchive record |
| `cloneAction()` | POST | `/:id/clone` | Duplicate record |
| `bulkUpdateAction()` | PUT | `/bulk` | Update multiple records |
| `bulkDeleteAction()` | DELETE | `/bulk` | Delete multiple records |
| `toggleAction(field)` | POST | `/:id/toggle-{field}` | Toggle boolean field |
| `exportAction()` | GET | `/export` | Export all records |
| `countAction()` | GET | `/count` | Count records |
| `existsAction()` | GET | `/:id/exists` | Check if record exists |

## Importing Actions

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
} from "nevr/plugins/core/actions"
```

## Using Pre-built Actions

```typescript
import { entity, string, boolean, datetime } from "nevr"
import {
  softDeleteAction,
  restoreAction,
  archiveAction,
  cloneAction,
  toggleAction,
} from "nevr/plugins/core/actions"

const post = entity("post", {
  title: string,
  content: string,
  published: boolean.default(false),
  archived: boolean.default(false),
  deletedAt: datetime.optional(),
}).actions({
  // Add pre-built actions
  softDelete: softDeleteAction(),
  restore: restoreAction(),
  archive: archiveAction(),
  clone: cloneAction(),
  togglePublished: toggleAction("published"),
})
```

## Action Details

### softDeleteAction()

Set a timestamp field instead of hard deleting:

```typescript
softDeleteAction(fieldName = "deletedAt")
```

**Usage:**
```bash
DELETE /posts/123/soft
```

**Response:**
```json
{ "success": true }
```

**Customization:**
```typescript
// Use custom field name
softDeleteAction("removedAt")
```

### restoreAction()

Clear the deleted timestamp:

```typescript
restoreAction(fieldName = "deletedAt")
```

**Usage:**
```bash
POST /posts/123/restore
```

**Response:**
```json
{ "success": true }
```

### archiveAction() / unarchiveAction()

Set/clear an `archived` boolean:

```typescript
archiveAction()    // Sets archived: true
unarchiveAction()  // Sets archived: false
```

**Usage:**
```bash
POST /posts/123/archive
POST /posts/123/unarchive
```

**Response:**
```json
{ "success": true }
```

### cloneAction()

Duplicate a record (excluding id and timestamps):

```typescript
cloneAction(fieldsToExclude = ["id", "createdAt", "updatedAt"])
```

**Usage:**
```bash
POST /posts/123/clone
```

**Response:**
```json
{
  "id": "456",
  "title": "My Post",
  "content": "...",
  "published": false,
  "createdAt": "2024-01-16T..."
}
```

**Customization:**
```typescript
// Exclude additional fields
cloneAction(["id", "createdAt", "updatedAt", "slug", "viewCount"])
```

### bulkUpdateAction()

Update multiple records at once:

```typescript
bulkUpdateAction()
```

**Usage:**
```bash
PUT /posts/bulk
Content-Type: application/json

{
  "ids": ["123", "456", "789"],
  "data": { "published": true }
}
```

**Response:**
```json
{ "count": 3 }
```

### bulkDeleteAction()

Delete multiple records:

```typescript
bulkDeleteAction()
```

**Usage:**
```bash
DELETE /posts/bulk
Content-Type: application/json

{
  "ids": ["123", "456", "789"]
}
```

**Response:**
```json
{ "count": 3 }
```

### toggleAction()

Toggle a boolean field:

```typescript
toggleAction(fieldName: string)
```

**Usage:**
```bash
POST /posts/123/toggle-published
```

**Response:**
```json
{ "published": true }
```

**Multiple toggles:**
```typescript
const post = entity("post", {
  published: boolean.default(false),
  featured: boolean.default(false),
  pinned: boolean.default(false),
}).actions({
  togglePublished: toggleAction("published"),
  toggleFeatured: toggleAction("featured"),
  togglePinned: toggleAction("pinned"),
})
```

### exportAction()

Export all records (JSON or CSV):

```typescript
exportAction()
```

**Usage:**
```bash
# JSON export (default)
GET /posts/export

# CSV export
GET /posts/export?format=csv
```

**JSON Response:**
```json
[
  { "id": "1", "title": "Post 1", ... },
  { "id": "2", "title": "Post 2", ... }
]
```

**CSV Response:**
```csv
id,title,content,published
1,"Post 1","Content...",true
2,"Post 2","Content...",false
```

### countAction()

Count records with optional filters:

```typescript
countAction()
```

**Usage:**
```bash
# Count all
GET /posts/count

# Count with filters
GET /posts/count?published=true
```

**Response:**
```json
{ "count": 42 }
```

### existsAction()

Check if a record exists:

```typescript
existsAction()
```

**Usage:**
```bash
GET /posts/123/exists
```

**Response:**
```json
{ "exists": true }
```

## Creating Custom Actions

For more complex logic, use the action builder:

```typescript
import { action } from "nevr/plugins/core/actions"

const post = entity("post", {
  title: string,
  viewCount: int.default(0),
}).actions({
  // Custom action with builder
  incrementViews: action()
    .method("POST")
    .path("/:id/view")
    .handle(async (ctx) => {
      const current = await ctx.driver.findOne("post", { id: ctx.params.id })
      if (!current) throw new APIError("NOT_FOUND", { message: "Post not found" })

      await ctx.driver.update("post",
        { id: ctx.params.id },
        { viewCount: current.viewCount + 1 }
      )

      return { viewCount: current.viewCount + 1 }
    })
    .build(),

  // Simple post action
  publish: postAction(async (ctx) => {
    await ctx.driver.update("post",
      { id: ctx.params.id },
      { published: true, publishedAt: new Date() }
    )
    return { published: true }
  }),

  // Simple get action
  stats: getAction(async (ctx) => {
    const count = await ctx.driver.count("post")
    const published = await ctx.driver.count("post", { published: true })
    return { total: count, published }
  }),
})
```

## Action Builder API

```typescript
action()
  .method("POST")                    // HTTP method
  .path("/:id/custom")               // Route path
  .describe("Custom action")         // Description
  .auth(["admin"])                   // Require auth + role
  .validate((input) => ({            // Validate input
    valid: input.name?.length > 0,
    errors: ["Name is required"],
  }))
  .handle(async (ctx) => {           // Handler
    return { success: true }
  })
  .build()
```

## Action Context

Handlers receive an ActionContext:

```typescript
interface ActionContext<TInput> {
  input: TInput                              // Request body/query
  params: Record<string, string>             // URL params
  query: Record<string, string | undefined>  // Query params
  headers: Record<string, string | undefined>
  user: User | null                          // Authenticated user
  driver: Driver                             // Database driver
  entity: string                             // Entity name
  context: NevrContext                       // Full context
  request: NevrRequest                       // Raw request
}
```

## Combining Actions

Mix pre-built and custom actions:

```typescript
const post = entity("post", {
  title: string,
  content: string,
  published: boolean.default(false),
  archived: boolean.default(false),
  deletedAt: datetime.optional(),
  viewCount: int.default(0),
}).actions({
  // Pre-built actions
  softDelete: softDeleteAction(),
  restore: restoreAction(),
  archive: archiveAction(),
  unarchive: unarchiveAction(),
  clone: cloneAction(),
  bulkUpdate: bulkUpdateAction(),
  bulkDelete: bulkDeleteAction(),
  togglePublished: toggleAction("published"),
  export: exportAction(),
  count: countAction(),
  exists: existsAction(),

  // Custom actions
  publish: action()
    .method("POST")
    .path("/:id/publish")
    .auth()
    .handle(async (ctx) => {
      await ctx.driver.update("post",
        { id: ctx.params.id },
        { published: true, publishedAt: new Date() }
      )
      return { success: true }
    })
    .build(),

  unpublish: action()
    .method("POST")
    .path("/:id/unpublish")
    .auth()
    .handle(async (ctx) => {
      await ctx.driver.update("post",
        { id: ctx.params.id },
        { published: false }
      )
      return { success: true }
    })
    .build(),
})
```

## Generated Routes

For the example above:

```
DELETE /posts/:id/soft         # softDelete
POST   /posts/:id/restore      # restore
POST   /posts/:id/archive      # archive
POST   /posts/:id/unarchive    # unarchive
POST   /posts/:id/clone        # clone
PUT    /posts/bulk             # bulkUpdate
DELETE /posts/bulk             # bulkDelete
POST   /posts/:id/toggle-published  # togglePublished
GET    /posts/export           # export
GET    /posts/count            # count
GET    /posts/:id/exists       # exists
POST   /posts/:id/publish      # publish
POST   /posts/:id/unpublish    # unpublish
```

## Best Practices

1. **Use soft delete for important data** - Never lose data accidentally
2. **Add archive for content management** - Hide without deleting
3. **Use toggle for boolean fields** - Simple on/off operations
4. **Export for reporting** - Quick data export capability
5. **Bulk for admin operations** - Efficient mass updates

## Next Steps

- [Actions](/guide/actions) - Custom action development
- [Workflows](/guide/workflows) - Multi-step actions with compensation
- [Authorization](/entities/authorization) - Securing actions
