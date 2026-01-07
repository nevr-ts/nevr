# Field Validation

> ✅ **Built-in, chainable validation for all your fields.**

## Why Built-in Validation?

### The Problem: Backend vs Database Validation

| Layer | Pros | Cons |
|-------|------|------|
| **Database Constraints** | Guaranteed data integrity | Limited rules, ugly errors |
| **API Validation** | User-friendly errors | Duplicated logic, disconnected from DB |
| **Nevr Validation** | **Best of both worlds** | Single definition, runtime checks + DB constraints |

### Using Validation

```typescript
const user = entity("user", {
  // Chain validators together
  username: string.min(3).max(20).alphanumeric(),
  
  // Custom error messages
  email: string.email("Please provide a valid email address"),
})
```

> 🟡 **Need Zod?** You can use Zod schemas directly with the `.zod()` modifier. See [Zod Integration](#zod-integration).

---

## Validation Methods

## String Validation

### email()

Validates the field as an email address format.

```typescript
import { string, email } from "nevr"

const user = entity("user", {
  // Using the email type
  email: email.unique(),

  // Or using .email() modifier
  contactEmail: string.email("Invalid email format"),
})
```

**Validation:** Checks for valid email format (e.g., `user@example.com`)

**Error:** Returns custom message or `"Invalid email format"`

---

### url()

Validates the field as a valid URL.

```typescript
const user = entity("user", {
  website: string.url("Must be a valid URL").optional(),
  avatar: string.url(),
  linkedIn: string.url("Please enter a valid LinkedIn URL"),
})
```

**Validation:** Checks for valid URL format (e.g., `https://example.com`)

**Error:** Returns custom message or `"Invalid URL format"`

---

### regex()

Validates against a custom regular expression pattern.

```typescript
const user = entity("user", {
  // Slug format (lowercase letters, numbers, hyphens)
  slug: string.regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),

  // Username format
  username: string.regex(
    /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/,
    "Username must start with a letter and be 3-20 characters"
  ),

  // Phone number (simple)
  phone: string.regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),

  // Hex color
  color: string.regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color like #FF5733"),
})
```

**Parameters:**
- `pattern: RegExp` - The regular expression to match
- `message?: string` - Custom error message

---

### startsWith()

Validates that the string starts with a specific value.

```typescript
const user = entity("user", {
  // Twitter handle
  twitter: string.startsWith("@", "Twitter handle must start with @"),

  // Internal reference
  internalRef: string.startsWith("REF-", "Reference must start with REF-"),
})
```

---

### endsWith()

Validates that the string ends with a specific value.

```typescript
const employee = entity("employee", {
  // Company email
  workEmail: string.endsWith("@company.com", "Must be a company email"),

  // File path
  configPath: string.endsWith(".json", "Configuration must be a JSON file"),
})
```

---

### contains()

Validates that the string contains a specific value.

```typescript
const config = entity("config", {
  // URL with protocol
  apiEndpoint: string.contains("://", "Must include protocol (http:// or https://)"),

  // File path with extension
  imagePath: string.contains(".", "Must include file extension"),
})
```

---

### datetimeFormat()

Validates ISO 8601 datetime format for string fields.

```typescript
const event = entity("event", {
  // ISO datetime string
  scheduledAt: string.datetimeFormat("Must be ISO 8601 format"),

  // For actual datetime fields, use the datetime type instead
  createdAt: datetime,
})
```

**Note:** Use this for string fields that store dates. For native datetime handling, use the `datetime` type.

---

## Length Validation

### min()

Sets minimum length for strings or minimum value for numbers.

```typescript
const user = entity("user", {
  // String: minimum length
  name: string.min(2, "Name must be at least 2 characters"),
  password: string.min(8, "Password must be at least 8 characters"),
  bio: text.min(10),

  // Number: minimum value
  age: int.min(0, "Age cannot be negative"),
  price: float.min(0.01, "Price must be at least $0.01"),
})
```

---

### max()

Sets maximum length for strings or maximum value for numbers.

```typescript
const post = entity("post", {
  // String: maximum length
  title: string.max(200, "Title cannot exceed 200 characters"),
  summary: text.max(500),

  // Number: maximum value
  quantity: int.max(100, "Maximum 100 items per order"),
  discount: float.max(100, "Discount cannot exceed 100%"),
})
```

---

### length()

Sets both minimum and maximum length in one call.

```typescript
const user = entity("user", {
  // Username between 3 and 20 characters
  username: string.length(3, 20, "Username must be 3-20 characters"),

  // PIN code exactly 4-6 digits
  pin: string.length(4, 6, "PIN must be 4-6 characters"),

  // Bio with reasonable limits
  bio: text.length(10, 1000),
})
```

**Note:** For exact length, use the same value for min and max.

---

## Numeric Validation

### gt() - Greater Than

Validates that the number is greater than (exclusive) a value.

```typescript
const product = entity("product", {
  // Must be positive (greater than 0)
  price: float.gt(0, "Price must be greater than 0"),
  stock: int.gt(0, "Must have at least 1 in stock"),
})
```

---

### gte() - Greater Than or Equal

Validates that the number is greater than or equal to a value.

```typescript
const user = entity("user", {
  // Zero or positive
  balance: float.gte(0, "Balance cannot be negative"),
  points: int.gte(0),
})
```

---

### lt() - Less Than

Validates that the number is less than (exclusive) a value.

```typescript
const rating = entity("rating", {
  // Less than 6 (so max is 5)
  score: int.lt(6, "Score must be less than 6"),
  percentage: float.lt(101, "Percentage must be under 101"),
})
```

---

### lte() - Less Than or Equal

Validates that the number is less than or equal to a value.

```typescript
const feedback = entity("feedback", {
  // 1-5 star rating
  stars: int.gte(1).lte(5, "Rating must be between 1 and 5"),

  // Percentage 0-100
  satisfaction: float.gte(0).lte(100),
})
```

---

## Custom Validation

### validate()

Create custom validation logic with a function.

```typescript
const user = entity("user", {
  // Custom credit card validation
  creditCard: string.validate(
    (value) => {
      if (typeof value !== "string") return false
      // Luhn algorithm check
      const digits = value.replace(/\D/g, "")
      let sum = 0
      for (let i = 0; i < digits.length; i++) {
        let digit = parseInt(digits[i], 10)
        if ((digits.length - i) % 2 === 0) {
          digit *= 2
          if (digit > 9) digit -= 9
        }
        sum += digit
      }
      return sum % 10 === 0
    },
    "Invalid credit card number"
  ),

  // Password complexity
  password: string.validate(
    (value) => {
      if (typeof value !== "string") return false
      const hasUpperCase = /[A-Z]/.test(value)
      const hasLowerCase = /[a-z]/.test(value)
      const hasNumber = /[0-9]/.test(value)
      const hasSpecial = /[!@#$%^&*]/.test(value)
      return hasUpperCase && hasLowerCase && hasNumber && hasSpecial
    },
    "Password must contain uppercase, lowercase, number, and special character"
  ),

  // Age validation
  birthYear: int.validate(
    (value) => {
      const year = value as number
      const currentYear = new Date().getFullYear()
      return year >= 1900 && year <= currentYear
    },
    "Invalid birth year"
  ),
})
```

**Parameters:**
- `fn: (value: unknown) => boolean` - Function that returns true if valid
- `message?: string` - Custom error message

---

## Chaining Validations

Multiple validations can be chained for comprehensive rules:

```typescript
const user = entity("user", {
  // Multiple string validations
  email: string
    .trim()                           // Transform first
    .lower()                          // Normalize case
    .email("Invalid email")           // Validate format
    .unique(),                        // Database constraint

  // Complex username rules
  username: string
    .trim()
    .lower()
    .min(3, "Too short")
    .max(20, "Too long")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, underscore")
    .unique(),

  // Secure password
  password: string
    .min(8, "Password too short")
    .max(128, "Password too long")
    .validate(
      (v) => /[A-Z]/.test(v as string) && /[0-9]/.test(v as string),
      "Must include uppercase and number"
    )
    .password()    // Hash before storing
    .omit(),       // Never return in responses

  // Price with range
  price: float
    .gt(0, "Must be positive")
    .lte(999999.99, "Exceeds maximum price"),
})
```

---

## Validation Reference

| Method | Applies To | Description |
|--------|------------|-------------|
| `.email(msg?)` | string | Email format |
| `.url(msg?)` | string | URL format |
| `.regex(pattern, msg?)` | string | Custom regex pattern |
| `.startsWith(value, msg?)` | string | Must start with value |
| `.endsWith(value, msg?)` | string | Must end with value |
| `.contains(value, msg?)` | string | Must contain value |
| `.datetimeFormat(msg?)` | string | ISO 8601 datetime |
| `.min(value, msg?)` | string, number | Min length/value |
| `.max(value, msg?)` | string, number | Max length/value |
| `.length(min, max, msg?)` | string | Length range |
| `.gt(value, msg?)` | number | Greater than |
| `.gte(value, msg?)` | number | Greater than or equal |
| `.lt(value, msg?)` | number | Less than |
| `.lte(value, msg?)` | number | Less than or equal |
| `.validate(fn, msg?)` | any | Custom validation |

---

## Examples

### User Registration Form

```typescript
const user = entity("user", {
  // Email with full validation chain
  email: string
    .trim()
    .lower()
    .email("Please enter a valid email")
    .unique(),

  // Username with strict rules
  username: string
    .trim()
    .lower()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username cannot exceed 30 characters")
    .regex(/^[a-z0-9_]+$/, "Only letters, numbers, and underscores")
    .unique(),

  // Secure password
  password: string
    .min(8, "Password must be at least 8 characters")
    .validate(
      (v) => /[A-Z]/.test(String(v)) && /[0-9]/.test(String(v)),
      "Password must contain uppercase letter and number"
    )
    .password()
    .omit(),

  // Name with reasonable limits
  displayName: string.min(1).max(100),

  // Optional validated fields
  website: string.url("Invalid website URL").optional(),
  phone: string.regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number").optional(),
})
```

### Product Inventory

```typescript
const product = entity("product", {
  // SKU with format validation
  sku: string
    .upper()
    .regex(/^[A-Z]{3}-[0-9]{6}$/, "SKU format: ABC-123456")
    .unique(),

  name: string.min(3).max(200),
  description: text.max(5000).optional(),

  // Price validation
  price: float.gt(0, "Price must be positive"),
  compareAtPrice: float.gt(0).optional(),

  // Inventory
  quantity: int.gte(0, "Quantity cannot be negative").default(0),
  lowStockThreshold: int.gte(1).default(10),

  // Rating
  rating: float.gte(0).lte(5).optional(),
  reviewCount: int.gte(0).default(0),
})
```

### Configuration Settings

```typescript
const config = entity("config", {
  // Key-value with constraints
  key: string
    .trim()
    .lower()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_.]*$/, "Invalid config key format")
    .unique(),

  value: text.max(10000),

  // Percentage setting
  percentageValue: float.gte(0).lte(100).optional(),

  // Integer setting with bounds
  integerValue: int.gte(-1000000).lte(1000000).optional(),

  // URL setting
  urlValue: string.url().optional(),

  // Enum-like validation
  environment: string.validate(
    (v) => ["development", "staging", "production"].includes(v as string),
    "Must be development, staging, or production"
  ),
})
```

---

## Zod Integration

For advanced validation scenarios or when migrating from Zod, you can use the `.zod()` escape hatch.

```typescript
import { z } from "zod"
import { entity, string, int } from "nevr"

const user = entity("user", {
  // Simple field with Zod validation
  email: string.zod(
    z.string().email().refine(val => !val.endsWith("@example.com"))
  ),
  
  // Combine with Nevr modifiers
  password: string
    .zod(z.string().min(8).regex(/[A-Z]/))
    .password() // Hash it!
    .omit(),    // Hide it!
    
  // Complex schema
  metadata: jsonTyped<{ flags: string[] }>()
    .zod(z.object({
      flags: z.array(z.string()).max(5)
    }))
})
```

### Why use `.zod()`?

1.  **Refinements**: Custom validation logic with `z.refine()`
2.  **Schema Reuse**: Reuse existing Zod schemas from other parts of your app
3.  **Complex Transformations**: Use Zod's powerful transformation pipelines

> ⚠️ **Note**: Zod validation runs *before* database storage but *after* Nevr's type checks.

---

## Next Steps

- [Transforms](/fields/transforms) - Transform data before saving
- [Security](/fields/security) - Password hashing and encryption
- [Access Policies](/fields/access-policies) - Field-level permissions

