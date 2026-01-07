# Field Transforms

Transforms automatically modify field values before they're saved to the database. They run on create and update operations, ensuring consistent data formatting.

## Available Transforms

### trim()

Removes leading and trailing whitespace from string values.

```typescript
import { entity, string, text, email } from "nevr"

const user = entity("user", {
  // Remove accidental spaces
  name: string.trim(),
  username: string.trim(),
  email: email.trim(),
  bio: text.trim().optional(),
})
```

**Input:** `"  John Doe  "`
**Output:** `"John Doe"`

**Use cases:**
- User-submitted form data
- Usernames and identifiers
- Any text that shouldn't have surrounding whitespace

---

### lower()

Converts string values to lowercase.

```typescript
const user = entity("user", {
  // Normalize to lowercase
  email: string.lower().unique(),
  username: string.lower().unique(),
  slug: string.lower(),
})
```

**Input:** `"John.Doe@Example.COM"`
**Output:** `"john.doe@example.com"`

**Use cases:**
- Email addresses (case-insensitive matching)
- Usernames
- URL slugs
- Search terms

---

### upper()

Converts string values to uppercase.

```typescript
const product = entity("product", {
  // Uppercase for consistency
  sku: string.upper().unique(),
  countryCode: string.upper().length(2, 2),
  currencyCode: string.upper().length(3, 3),
})
```

**Input:** `"abc-12345"`
**Output:** `"ABC-12345"`

**Use cases:**
- SKU codes
- Country codes (US, GB, FR)
- Currency codes (USD, EUR, GBP)
- Reference numbers

---

## Chaining Transforms

Transforms execute in order from left to right:

```typescript
const user = entity("user", {
  // trim → lower (remove spaces, then lowercase)
  email: string.trim().lower().email().unique(),

  // trim → upper (remove spaces, then uppercase)
  referralCode: string.trim().upper().optional(),

  // Full chain with validation
  username: string
    .trim()              // 1. Remove whitespace
    .lower()             // 2. Convert to lowercase
    .min(3)              // 3. Validate minimum length
    .max(20)             // 4. Validate maximum length
    .regex(/^[a-z0-9_]+$/, "Invalid characters")  // 5. Validate format
    .unique(),           // 6. Database constraint
})
```

### Transform Order

```
Input → trim() → lower()/upper() → Database
```

For example, with `.trim().lower()`:
1. `"  Hello World  "` → `"Hello World"` (after trim)
2. `"Hello World"` → `"hello world"` (after lower)
3. `"hello world"` → saved to database

---

## Transform + Validation

Transforms run **before** validation, so validation operates on the transformed value:

```typescript
const user = entity("user", {
  // Transform first, then validate
  email: string
    .trim()           // "  USER@EMAIL.com  " → "USER@EMAIL.com"
    .lower()          // "USER@EMAIL.com" → "user@email.com"
    .email()          // Validate the normalized email
    .unique(),

  username: string
    .trim()           // "  MyUser123  " → "MyUser123"
    .lower()          // "MyUser123" → "myuser123"
    .min(3)           // Validate length after transform
    .regex(/^[a-z0-9_]+$/),  // Pattern matches lowercase
})
```

::: warning Order Matters
If you use `.upper()` but validate with a lowercase regex pattern, validation will fail:
```typescript
// Wrong - upper() + lowercase regex
username: string.trim().upper().regex(/^[a-z]+$/)  // Will always fail!

// Correct - upper() + uppercase regex
username: string.trim().upper().regex(/^[A-Z]+$/)
```
:::

---

## Transform + Security

Transforms also run before security operations:

```typescript
const user = entity("user", {
  // Transform → Hash → Save
  email: string
    .trim()          // Clean input
    .lower()         // Normalize
    .email()         // Validate
    .unique(),

  // Transform → Hash → Omit
  password: string
    .trim()          // Remove accidental whitespace
    .min(8)          // Validate after trim
    .password()      // Hash with scrypt
    .omit(),         // Never return
})
```

---

## Examples

### User Profile

```typescript
const user = entity("user", {
  // Email - normalized for consistent lookup
  email: string.trim().lower().email().unique(),

  // Username - normalized and validated
  username: string
    .trim()
    .lower()
    .min(3, "Username too short")
    .max(30, "Username too long")
    .regex(/^[a-z0-9_]+$/, "Only letters, numbers, underscore")
    .unique(),

  // Display name - trimmed but preserves case
  displayName: string.trim().min(1).max(100),

  // Bio - trimmed but otherwise unmodified
  bio: text.trim().max(500).optional(),
})
```

### Product Catalog

```typescript
const product = entity("product", {
  // SKU - uppercase standard
  sku: string.trim().upper().unique(),

  // Name - preserve case, remove extra spaces
  name: string.trim().min(1).max(200),

  // Slug - URL-friendly format
  slug: string.trim().lower().regex(/^[a-z0-9-]+$/).unique(),

  // Description - clean up whitespace
  description: text.trim().optional(),

  // Category code - uppercase
  categoryCode: string.trim().upper().optional(),
})
```

### Contact Form

```typescript
const contact = entity("contact", {
  // Email for replies
  email: string.trim().lower().email(),

  // Name
  name: string.trim().min(1).max(100),

  // Subject
  subject: string.trim().min(1).max(200),

  // Message
  message: text.trim().min(10).max(5000),

  // Optional phone - preserve format
  phone: string.trim().optional(),
})
```

### Configuration

```typescript
const setting = entity("setting", {
  // Config key - normalized
  key: string.trim().lower().regex(/^[a-z][a-z0-9_.]*$/).unique(),

  // Value - trimmed
  value: text.trim(),

  // Environment
  environment: string.trim().lower().default("production"),
})
```

---

## Transform Reference

| Method | Description | Example |
|--------|-------------|---------|
| `.trim()` | Remove leading/trailing whitespace | `"  hi  "` → `"hi"` |
| `.lower()` | Convert to lowercase | `"HELLO"` → `"hello"` |
| `.upper()` | Convert to uppercase | `"hello"` → `"HELLO"` |

---

## Best Practices

### 1. Always trim user input

```typescript
// Good - handles copy-paste errors
email: string.trim().lower().email()

// Bad - may fail validation due to whitespace
email: string.lower().email()
```

### 2. Normalize identifiers

```typescript
// Good - consistent lookup regardless of input case
username: string.trim().lower().unique()
email: string.trim().lower().unique()

// Bad - "User" and "user" could be different records
username: string.unique()
```

### 3. Use uppercase for codes

```typescript
// Good - standard format for codes
sku: string.trim().upper()
countryCode: string.trim().upper().length(2, 2)

// Consistent with industry standards
```

### 4. Consider the full chain

```typescript
// Complete chain for email
email: string
  .trim()           // 1. Clean whitespace
  .lower()          // 2. Normalize case
  .email()          // 3. Validate format
  .unique()         // 4. Database constraint

// Complete chain for username
username: string
  .trim()           // 1. Clean whitespace
  .lower()          // 2. Normalize case
  .min(3)           // 3. Min length
  .max(20)          // 4. Max length
  .regex(/^[a-z0-9_]+$/)  // 5. Valid chars
  .unique()         // 6. Database constraint
```

## Next Steps

- [Security](/fields/security) - Password hashing and encryption
- [Access Policies](/fields/access-policies) - Field-level permissions
- [Validation](/fields/validation) - Input validation rules

