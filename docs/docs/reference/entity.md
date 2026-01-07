# entity()

Define an entity.

## Signature

```typescript
function entity<TName, TFields>(
  name: TName,
  fields: TFields
): EntityBuilder<TName, TFields>
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Entity name (lowercase, camelCase) |
| `fields` | `Record<string, FieldBuilder>` | Field definitions |

## Returns

`EntityBuilder` with chainable methods.

## EntityBuilder Methods

### `.rules(config)`

Set authorization rules.

```typescript
.rules({
  create: ["authenticated"],
  read: ["everyone"],
  update: ["owner"],
  delete: ["owner", "admin"],
  list: ["everyone"],
})
```

**Rules:**
- `"everyone"` - No auth required
- `"authenticated"` - Must be logged in
- `"owner"` - Must own record
- `"admin"` - Must be admin

### `.ownedBy(relationField)`

Set owner relation.

```typescript
const post = entity("post", {
  author: belongsTo(() => user),
})
  .ownedBy("author")
```

### `.timestamps(false)`

Disable automatic timestamps.

```typescript
const config = entity("config", {
  key: string.unique(),
  value: json,
})
  .timestamps(false)
```

### `.namespace(ns)`

Set namespace for organization.

```typescript
const user = entity("user", { ... })
  .namespace("auth")
```

### `.actions(actions)`

Define custom actions.

```typescript
.actions({
  publish: action()
    .onResource()
    .handler(async (ctx) => { ... }),
})
```

### `.validate(fn, message, options?)`

Add cross-field validation.

```typescript
.validate(
  (data) => data.startDate < data.endDate,
  "Start must be before end"
)
```

### `.build()`

Build the entity definition.

```typescript
const postEntity = post.build()
```

## Examples

### Basic Entity

```typescript
const user = entity("user", {
  name: string.trim().min(2),
  email: string.email().unique(),
})
```

### With Relations

```typescript
const post = entity("post", {
  title: string,
  content: text,
  author: belongsTo(() => user),
  comments: hasMany(() => comment),
})
```

### Full Example

```typescript
const product = entity("product", {
  name: string.trim().min(2).max(200),
  slug: string.trim().lower().unique(),
  price: float.gt(0),
  stock: int.gte(0).default(0),
  isActive: boolean.default(true),
  category: belongsTo(() => category),
})
  .ownedBy("vendor")
  .rules({
    read: ["everyone"],
    create: ["vendor"],
    update: ["owner", "admin"],
    delete: ["admin"],
  })
  .validate(
    (d) => d.stock >= 0,
    "Stock cannot be negative"
  )
  .namespace("catalog")
```

## Auto-Generated Fields

Every entity includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | CUID primary key |
| `createdAt` | `datetime` | Creation timestamp |
| `updatedAt` | `datetime` | Update timestamp |

## Generated API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/{entities}` | List all |
| GET | `/api/{entities}/:id` | Get one |
| POST | `/api/{entities}` | Create |
| PATCH | `/api/{entities}/:id` | Update |
| DELETE | `/api/{entities}/:id` | Delete |

## See Also

- [Fields](/reference/fields)
- [Actions](/reference/actions)
- [Defining Entities](/entities/defining)
