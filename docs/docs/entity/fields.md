# Fields Reference

Fields define the shape of your data. Nevr provides a rich set of field types that map to both database columns and TypeScript types.

---

## Importing Fields

```typescript
import { 
  string,    // Short text
  text,      // Long text
  int,       // Integer numbers
  float,     // Decimal numbers
  bool,      // Boolean (true/false)
  boolean,   // Alias for bool
  datetime,  // Date and time
  json,      // JSON objects
  email      // String with email validation
} from "nevr"
```

---

## Field Types

### `string`

Short text field (VARCHAR). Use for names, titles, short descriptions.

```typescript
const user = entity("user", {
  name: string,
  username: string.unique(),
  bio: string.optional()
})
```

**Prisma mapping:** `String`

**TypeScript type:** `string`

---

### `text`

Long text field (TEXT). Use for content, descriptions, articles.

```typescript
const post = entity("post", {
  content: text,
  summary: text.optional()
})
```

**Prisma mapping:** `String` (with `@db.Text` annotation)

**TypeScript type:** `string`

---

### `int`

Integer number field. Use for counts, ages, quantities.

```typescript
const product = entity("product", {
  stock: int.min(0),
  views: int.default(0)
})
```

**Prisma mapping:** `Int`

**TypeScript type:** `number`

---

### `float`

Decimal number field. Use for prices, ratings, coordinates.

```typescript
const product = entity("product", {
  price: float.min(0),
  rating: float.min(0).max(5).optional()
})
```

**Prisma mapping:** `Float`

**TypeScript type:** `number`

---

### `bool` / `boolean`

Boolean field. Use for flags and toggles.

```typescript
const post = entity("post", {
  published: bool.default(false),
  featured: boolean.default(false)
})
```

**Prisma mapping:** `Boolean`

**TypeScript type:** `boolean`

---

### `datetime`

Date and time field. Use for timestamps, schedules.

```typescript
const event = entity("event", {
  startsAt: datetime,
  endsAt: datetime.optional()
})
```

**Prisma mapping:** `DateTime`

**TypeScript type:** `Date`

---

### `json`

JSON field. Use for flexible, structured data.

```typescript
const user = entity("user", {
  preferences: json.default({}),
  metadata: json.optional()
})
```

**Prisma mapping:** `Json`

**TypeScript type:** `unknown` (you should cast it in your code)

---

### `email`

String field with built-in email validation.

```typescript
const user = entity("user", {
  email: email.unique()
})
```

**Prisma mapping:** `String`

**TypeScript type:** `string`

**Validation:** Automatically validates email format on create/update.

---

## Field Modifiers

All field types support the following modifiers. They are **chainable**.

### `.optional()`

Makes the field optional (nullable in the database).

```typescript
const user = entity("user", {
  middleName: string.optional(),
  phone: string.optional()
})
```

**Without `.optional()`:** Field is required on create.

**With `.optional()`:** Field can be omitted or set to `null`.

---

### `.default(value)`

Sets a default value. Applied when creating new records.

```typescript
const user = entity("user", {
  role: string.default("member"),
  isActive: bool.default(true),
  createdViews: int.default(0)
})
```

**Note:** When a field has a default, it doesn't need to be provided on create.

---

### `.unique()`

Adds a unique constraint to the database column.

```typescript
const user = entity("user", {
  email: email.unique(),
  username: string.unique(),
  slug: string.unique()
})
```

**Effect:** The database will reject duplicate values. Nevr doesn't validate uniqueness before insert (the database handles it).

---

### `.min(value)`

Sets a minimum constraint.

- **For strings:** Minimum character length
- **For numbers:** Minimum value

```typescript
const user = entity("user", {
  username: string.min(3),     // At least 3 characters
  age: int.min(0),             // Cannot be negative
  price: float.min(0.01)       // At least 0.01
})
```

---

### `.max(value)`

Sets a maximum constraint.

- **For strings:** Maximum character length
- **For numbers:** Maximum value

```typescript
const post = entity("post", {
  title: string.max(200),      // At most 200 characters
  rating: int.max(5),          // Maximum 5
  discount: float.max(100)     // Maximum 100
})
```

---

## Combining Modifiers

Modifiers are **chainable**. Order doesn't matter.

```typescript
const product = entity("product", {
  // String with length constraints
  sku: string.min(3).max(20).unique(),
  
  // Optional number with range
  stock: int.min(0).max(10000).optional(),
  
  // Optional with default
  status: string.default("draft").optional(),
  
  // Email that's optional but unique if provided
  contactEmail: email.unique().optional()
})
```

---

## Field Types Summary Table

| Field | Prisma Type | TypeScript | Example |
|-------|-------------|------------|---------|
| `string` | `String` | `string` | Names, titles |
| `text` | `String` | `string` | Content, body |
| `int` | `Int` | `number` | Counts, ages |
| `float` | `Float` | `number` | Prices, ratings |
| `bool` | `Boolean` | `boolean` | Flags |
| `datetime` | `DateTime` | `Date` | Timestamps |
| `json` | `Json` | `unknown` | Metadata |
| `email` | `String` | `string` | Email addresses |

---

## Next Steps

- [Validation](/entity/validation) — More validation rules
- [Relationships](/entity/relationships) — Connect entities together
