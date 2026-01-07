# Field Types

> 🧱 **Maps database columns to TypeScript types automatically.**

## Why Strict Types?

| Feature | Dynamic/Untyped | Nevr Types |
|---------|-----------------|------------|
| **Database** | `VARCHAR` | `string` → `VARCHAR(255)` |
| **API Input** | `any` | Validated input types |
| **API Response** | `any` | Strict output types |
| **Frontend** | Manual interfaces | Auto-generated types |

> 🟢 **Beginner Tip**: Start with simple types like `string`, `int`, `boolean`. You can change them later, and Nevr will handle the migration.

> 🟡 **Intermediate**: Use `jsonTyped<T>()` to bring TypeScript safety to JSON columns.

---

## Available Types

### string

Short string field, typically maps to `VARCHAR(255)` in databases.

```typescript
import { string } from "nevr"

const user = entity("user", {
  name: string,
  username: string.unique(),
  status: string.default("active"),
})
```

**Use for:** Names, titles, short identifiers, status values

**TypeScript type:** `string`

---

### text

Long text field, maps to `TEXT` in databases. Use for content that may exceed 255 characters.

```typescript
import { text } from "nevr"

const post = entity("post", {
  title: string,
  content: text,
  summary: text.optional(),
})
```

**Use for:** Blog posts, descriptions, comments, rich content

**TypeScript type:** `string`

---

### int

Integer field for whole numbers.

```typescript
import { int } from "nevr"

const product = entity("product", {
  quantity: int.default(0),
  views: int.default(0),
  sortOrder: int.optional(),
})
```

**Use for:** Counts, quantities, ages, sort orders

**TypeScript type:** `number`

---

### float

Decimal/floating-point field for numbers with decimals.

```typescript
import { float } from "nevr"

const product = entity("product", {
  price: float,
  weight: float.optional(),
  rating: float.default(0),
})
```

**Use for:** Prices, measurements, ratings, percentages

**TypeScript type:** `number`

---

### boolean / bool

Boolean field for true/false values. `bool` is an alias for `boolean`.

```typescript
import { boolean, bool } from "nevr"

const user = entity("user", {
  isActive: boolean.default(true),
  emailVerified: bool.default(false),
  isAdmin: boolean.default(false),
})
```

**Use for:** Flags, toggles, status indicators

**TypeScript type:** `boolean`

---

### datetime

DateTime field for dates and timestamps.

```typescript
import { datetime } from "nevr"

const event = entity("event", {
  startDate: datetime,
  endDate: datetime,
  publishedAt: datetime.optional(),
})
```

**Use for:** Timestamps, dates, scheduling

**TypeScript type:** `Date`

---

### json

Untyped JSON field for storing structured data.

```typescript
import { json } from "nevr"

const user = entity("user", {
  preferences: json.default({}),
  metadata: json.optional(),
})
```

**Use for:** Dynamic data, settings, configurations

**TypeScript type:** `unknown`

---

### email

Pre-configured string field with email validation.

```typescript
import { email } from "nevr"

const user = entity("user", {
  email: email.unique(),
  recoveryEmail: email.optional(),
})
```

**Equivalent to:** `string.email()`

**TypeScript type:** `string`

---

### jsonTyped\<T\>()

Typed JSON field that preserves TypeScript type information for full type inference.

```typescript
import { jsonTyped } from "nevr"

// Define your types
interface Address {
  street: string
  city: string
  country: string
  zip: string
}

interface OrderItem {
  productId: string
  quantity: number
  price: number
}

const user = entity("user", {
  address: jsonTyped<Address>().optional(),
})

const order = entity("order", {
  items: jsonTyped<OrderItem[]>(),
  shippingAddress: jsonTyped<Address>(),
})
```

**Benefits:**
- Full TypeScript type inference
- Compile-time type checking
- IDE autocomplete support

**TypeScript type:** `T` (your specified type)

## Type Mapping

| Nevr Type | TypeScript | PostgreSQL | MySQL | SQLite |
|-----------|------------|------------|-------|--------|
| `string` | `string` | `VARCHAR(255)` | `VARCHAR(255)` | `TEXT` |
| `text` | `string` | `TEXT` | `LONGTEXT` | `TEXT` |
| `int` | `number` | `INTEGER` | `INT` | `INTEGER` |
| `float` | `number` | `DOUBLE PRECISION` | `DOUBLE` | `REAL` |
| `boolean` | `boolean` | `BOOLEAN` | `TINYINT(1)` | `INTEGER` |
| `datetime` | `Date` | `TIMESTAMP` | `DATETIME` | `TEXT` |
| `json` | `unknown` | `JSONB` | `JSON` | `TEXT` |

## Examples

### Complete User Entity

```typescript
import { entity, string, text, int, boolean, datetime, email, jsonTyped } from "nevr"

interface UserPreferences {
  theme: "light" | "dark"
  language: string
  notifications: boolean
}

const user = entity("user", {
  // Basic info
  name: string,
  email: email.unique(),
  bio: text.optional(),

  // Numbers
  age: int.optional(),
  balance: float.default(0),

  // Flags
  isActive: boolean.default(true),
  emailVerified: boolean.default(false),

  // Dates
  lastLoginAt: datetime.optional(),

  // Typed JSON
  preferences: jsonTyped<UserPreferences>().default({
    theme: "light",
    language: "en",
    notifications: true,
  }),
})
```

### E-commerce Product

```typescript
import { entity, string, text, int, float, boolean, jsonTyped } from "nevr"

interface ProductVariant {
  sku: string
  size: string
  color: string
  price: number
  stock: number
}

const product = entity("product", {
  name: string,
  slug: string.unique(),
  description: text.optional(),
  price: float,
  compareAtPrice: float.optional(),
  quantity: int.default(0),
  isPublished: boolean.default(false),
  variants: jsonTyped<ProductVariant[]>().default([]),
})
```

## Next Steps

- [Modifiers](/fields/modifiers) - Add constraints like optional, unique, default
- [Validation](/fields/validation) - Add validation rules
