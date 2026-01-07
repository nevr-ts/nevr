# Field Modifiers

> 🎛️ **Control optionality, uniqueness, and defaults with chainable modifiers.**

## Why Modifiers?

| Modifier | Database Effect | TypeScript Effect |
|----------|-----------------|-------------------|
| `.optional()` | Allow `NULL` | `T \| null` |
| `.unique()` | Unique Index | No change (runtime check) |
| `.default()` | Default Value | Optional in `create` input |

> 🟢 **Beginner Tip**: Chain modifiers in any order. `string.optional().unique()` is the same as `string.unique().optional()`.

---

## optional()

Makes a field nullable. By default, all fields are required.

```typescript
const user = entity("user", {
  name: string,                    // Required
  nickname: string.optional(),     // Optional (nullable)
  bio: text.optional(),
  age: int.optional(),
})
```

**Database effect:** Column allows `NULL` values

**TypeScript effect:** Type becomes `T | null`

```typescript
// Generated type
interface User {
  name: string
  nickname: string | null
  bio: string | null
  age: number | null
}
```

---

## unique()

Adds a unique constraint to the field. No two records can have the same value.

```typescript
const user = entity("user", {
  email: string.unique(),
  username: string.unique(),
  slug: string.unique(),
})
```

**Database effect:** Creates a unique index on the column

**API effect:** Returns 409 Conflict if duplicate value is submitted

### Combining with optional

```typescript
const user = entity("user", {
  // Unique but optional - multiple NULL values allowed
  phoneNumber: string.optional().unique(),
})
```

---

## default()

Sets a default value for the field when not provided during creation.

```typescript
const post = entity("post", {
  // String defaults
  status: string.default("draft"),

  // Number defaults
  views: int.default(0),
  rating: float.default(0.0),

  // Boolean defaults
  isPublished: boolean.default(false),
  isFeatured: boolean.default(false),
})
```

### Default with Functions

For dynamic defaults (like timestamps), the default is applied at the application level:

```typescript
const user = entity("user", {
  role: string.default("user"),
  createdAt: datetime.default(() => new Date()),
})
```

::: tip
For `createdAt` and `updatedAt` timestamps, use the built-in timestamps feature instead:
```typescript
const user = entity("user", { ... })  // timestamps enabled by default
```
:::

### JSON Defaults

```typescript
import { json, jsonTyped } from "nevr"

const user = entity("user", {
  settings: json.default({}),
  preferences: jsonTyped<{ theme: string }>().default({ theme: "light" }),
})
```

---

## Combining Modifiers

Modifiers can be chained in any order:

```typescript
const user = entity("user", {
  // Optional with default (default used when field is omitted)
  role: string.optional().default("user"),

  // Unique and optional
  referralCode: string.unique().optional(),

  // All three
  inviteCode: string.optional().unique().default(() => generateCode()),
})
```

## Modifier Reference

| Modifier | Purpose | Database Effect |
|----------|---------|-----------------|
| `.optional()` | Allow null values | `NULL` allowed |
| `.unique()` | Enforce uniqueness | Unique index |
| `.default(value)` | Set default value | Default constraint or app-level |

## Examples

### User Registration

```typescript
const user = entity("user", {
  // Required fields
  email: string.unique(),
  name: string,

  // Optional profile fields
  avatar: string.optional(),
  bio: text.optional(),
  website: string.optional(),

  // Fields with defaults
  role: string.default("user"),
  isActive: boolean.default(true),
  emailVerified: boolean.default(false),
  loginCount: int.default(0),
})
```

### Blog Post

```typescript
const post = entity("post", {
  // Required
  title: string,
  slug: string.unique(),

  // Optional
  content: text.optional(),
  excerpt: string.optional(),
  featuredImage: string.optional(),

  // Defaults
  status: string.default("draft"),
  views: int.default(0),
  isPublished: boolean.default(false),
  publishedAt: datetime.optional(),
})
```

### Product Inventory

```typescript
const product = entity("product", {
  sku: string.unique(),
  name: string,
  description: text.optional(),

  // Pricing
  price: float,
  compareAtPrice: float.optional(),

  // Inventory
  quantity: int.default(0),
  lowStockThreshold: int.default(10),

  // Status
  isActive: boolean.default(true),
  isFeatured: boolean.default(false),
})
```

## Next Steps

- [Validation](/fields/validation) - Add validation rules to your fields
- [Transforms](/fields/transforms) - Transform data before saving
