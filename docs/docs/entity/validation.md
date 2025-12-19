# Validation

Nevr automatically validates all incoming data before it reaches your database. Validation rules are defined directly on your fields.

---

## How Validation Works

1. A client sends a POST/PUT request with JSON data
2. Nevr validates each field against its rules
3. If validation fails, returns `400 Bad Request` with errors
4. If validation passes, proceeds to create/update

### Example Error Response

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "title", "message": "Must be at least 1 characters" },
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

---

## String Validation

### Minimum Length

```typescript
const user = entity("user", {
  username: string.min(3)  // At least 3 characters
})
```

**Request:**
```json
{ "username": "ab" }
```

**Response (400):**
```json
{ "details": [{ "field": "username", "message": "Must be at least 3 characters" }] }
```

---

### Maximum Length

```typescript
const post = entity("post", {
  title: string.max(100)  // At most 100 characters
})
```

---

### Min and Max Combined

```typescript
const user = entity("user", {
  username: string.min(3).max(20)  // Between 3 and 20 characters
})
```

---

### Email Validation

The `email` field type automatically validates email format:

```typescript
import { email } from "nevr"

const user = entity("user", {
  email: email.unique()
})
```

**Valid:** `user@example.com`, `name.surname@company.org`

**Invalid:** `notanemail`, `missing@domain`, `@nodomain.com`

---

## Number Validation

### Minimum Value

```typescript
const product = entity("product", {
  price: float.min(0),      // Cannot be negative
  stock: int.min(0)         // Cannot be negative
})
```

---

### Maximum Value

```typescript
const review = entity("review", {
  rating: int.min(1).max(5)  // Between 1 and 5
})
```

---

### Integer Validation

The `int` field automatically validates that the value is a whole number:

```typescript
const product = entity("product", {
  quantity: int
})
```

**Request:**
```json
{ "quantity": 3.5 }
```

**Response (400):**
```json
{ "details": [{ "field": "quantity", "message": "Must be an integer" }] }
```

---

## Required vs Optional

### Required Fields

By default, all fields are **required** on create:

```typescript
const user = entity("user", {
  name: string,   // Required
  email: email    // Required
})
```

**Request:**
```json
{ "name": "John" }
```

**Response (400):**
```json
{ "details": [{ "field": "email", "message": "Required" }] }
```

---

### Optional Fields

Use `.optional()` to make a field nullable:

```typescript
const user = entity("user", {
  name: string,
  bio: string.optional()  // Can be omitted or null
})
```

**Valid requests:**
```json
{ "name": "John" }
{ "name": "John", "bio": null }
{ "name": "John", "bio": "Hello!" }
```

---

### Default Values

Fields with defaults don't need to be provided:

```typescript
const post = entity("post", {
  title: string,
  published: bool.default(false)
})
```

**Request:**
```json
{ "title": "My Post" }
```

**Result:** Creates post with `published: false`

---

## Type Validation

Nevr validates that the data type matches the field type:

| Field Type | Expected JSON Type | Error Message |
|------------|-------------------|---------------|
| `string`, `text`, `email` | `"string"` | "Must be a string" |
| `int` | `123` (integer) | "Must be an integer" |
| `float` | `123` or `123.45` | "Must be a number" |
| `bool` | `true` or `false` | "Must be a boolean" |
| `datetime` | `"2024-01-15T10:30:00Z"` | "Must be a date" or "Invalid date format" |
| `json` | Any valid JSON | (no validation) |

---

## Null Validation

Null values are only allowed for optional fields:

```typescript
const user = entity("user", {
  name: string,              // null NOT allowed
  nickname: string.optional() // null IS allowed
})
```

**Request:**
```json
{ "name": null, "nickname": null }
```

**Response (400):**
```json
{ "details": [{ "field": "name", "message": "Cannot be null" }] }
```

---

## Date Validation

Datetime fields accept:
- ISO 8601 strings: `"2024-01-15T10:30:00Z"`
- Date objects (in TypeScript code)

```typescript
const event = entity("event", {
  startsAt: datetime
})
```

**Valid:**
```json
{ "startsAt": "2024-01-15T10:30:00Z" }
{ "startsAt": "2024-01-15" }
```

**Invalid:**
```json
{ "startsAt": "not a date" }
{ "startsAt": "15-01-2024" }
```

---

## Validation Summary

| Modifier | String Effect | Number Effect |
|----------|--------------|---------------|
| `.min(n)` | Min n characters | Min value n |
| `.max(n)` | Max n characters | Max value n |
| `.optional()` | Can be null/omitted | Can be null/omitted |
| `.default(v)` | Uses v if omitted | Uses v if omitted |

---

## Real-World Example

```typescript
const user = entity("user", {
  // Required, unique email with format validation
  email: email.unique(),
  
  // Required, between 3-50 characters
  name: string.min(3).max(50),
  
  // Optional, max 500 characters
  bio: text.max(500).optional(),
  
  // Required, at least 18
  age: int.min(18),
  
  // Defaults to "member" if not provided
  role: string.default("member"),
  
  // Defaults to true
  emailVerified: bool.default(false)
})
```

---

## Next Steps

- [Relationships](/entity/relationships) — Connect entities together
- [Authorization](/entity/authorization) — Control access with rules
