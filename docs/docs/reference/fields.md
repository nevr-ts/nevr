# Fields Reference

Complete reference for field types and methods.

## Field Types

### string

Short text field.

```typescript
name: string
name: string.min(2).max(100)
```

### text

Long text field (unlimited length).

```typescript
content: text
bio: text.optional()
```

### int

Integer number.

```typescript
age: int
quantity: int.gte(0).default(0)
```

### float

Decimal number.

```typescript
price: float
rating: float.gte(0).lte(5)
```

### boolean / bool

True/false value.

```typescript
isActive: boolean
published: bool.default(false)
```

### datetime

Date and time.

```typescript
createdAt: datetime
publishedAt: datetime.optional()
```

### json

Untyped JSON data.

```typescript
metadata: json
settings: json.optional()
```

### jsonTyped\<T>()

Typed JSON data.

```typescript
interface Address {
  street: string
  city: string
  zip: string
}

address: jsonTyped<Address>()
```

### email

String with email validation.

```typescript
email: email.unique()
// Equivalent to: string.email()
```

## Modifiers

### .optional()

Make field optional.

```typescript
bio: text.optional()
```

### .unique()

Add unique constraint.

```typescript
email: string.unique()
slug: string.lower().unique()
```

### .default(value)

Set default value.

```typescript
role: string.default("user")
count: int.default(0)
createdAt: datetime.default(() => new Date())
```

## Validation Methods

### .min(value, message?)

Minimum length/value.

```typescript
name: string.min(2)
age: int.min(18, "Must be 18+")
```

### .max(value, message?)

Maximum length/value.

```typescript
title: string.max(200)
quantity: int.max(100)
```

### .length(min, max, message?)

Length range.

```typescript
code: string.length(6, 6)
password: string.length(8, 128)
```

### .email(message?)

Email validation.

```typescript
email: string.email()
```

### .url(message?)

URL validation.

```typescript
website: string.url().optional()
```

### .regex(pattern, message?)

Regex validation.

```typescript
phone: string.regex(/^\+?[\d\s-]+$/, "Invalid phone")
sku: string.regex(/^[A-Z]{3}-\d{4}$/)
```

### .startsWith(value, message?)

String starts with.

```typescript
url: string.startsWith("https://")
```

### .endsWith(value, message?)

String ends with.

```typescript
email: string.endsWith("@company.com")
```

### .contains(value, message?)

String contains.

```typescript
name: string.contains("test")
```

### .gt(value, message?)

Greater than.

```typescript
price: float.gt(0, "Must be positive")
```

### .gte(value, message?)

Greater than or equal.

```typescript
quantity: int.gte(0)
```

### .lt(value, message?)

Less than.

```typescript
discount: float.lt(100)
```

### .lte(value, message?)

Less than or equal.

```typescript
rating: float.lte(5)
```

### .validate(fn, message?)

Custom validation.

```typescript
code: string.validate(
  (v) => luhnCheck(v),
  "Invalid code"
)
```

## Transform Methods

### .trim()

Trim whitespace.

```typescript
name: string.trim()
```

### .lower()

Convert to lowercase.

```typescript
email: string.lower()
slug: string.trim().lower()
```

### .upper()

Convert to uppercase.

```typescript
code: string.upper()
sku: string.trim().upper()
```

## Security Methods

### .password(options?)

Hash password with scrypt (Node.js native, zero dependencies).

```typescript
password: string.password()           // default cost 2
password: string.password({ cost: 1 }) // fast (development)
password: string.password({ cost: 3 }) // high security
```

**Cost Levels:**
| Cost | N Value | Time | Use Case |
|------|---------|------|----------|
| 1 | 16384 | ~200ms | Development/testing |
| 2 | 32768 | ~400ms | Production (default) |
| 3 | 65536 | ~800ms | High security |
| 4 | 131072 | ~1.6s | Maximum security |

### .omit()

Omit from API responses.

```typescript
password: string.password().omit()
internalNote: text.omit()
```

### .encrypted()

Encrypt with AES-256-GCM.

```typescript
ssn: string.encrypted()
apiKey: string.encrypted()
```

## Access Policy Methods

### .readable(policy)

Set read access policy.

```typescript
email: string.readable("authenticated")
salary: float.readable("admin")
```

### .writable(policy)

Set write access policy.

```typescript
role: string.writable("admin")
status: string.writable("owner")
```

### .readOnly()

Make field read-only.

```typescript
createdBy: string.readOnly()
```

### .adminOnly()

Admin-only access.

```typescript
internalNotes: text.adminOnly()
```

### .ownerWritable()

Owner can write.

```typescript
bio: text.ownerWritable()
```

## Rich Metadata Methods

These methods enhance OpenAPI docs, Admin UI, and AI integrations.

### .label(value)

Set human-readable label for forms and API docs.

```typescript
email: string.label("Email Address")
dob: datetime.label("Date of Birth")
```

### .description(value)

Set detailed description for tooltips and documentation.

```typescript
email: string.description("Primary email used for notifications")
status: string.description("Current order fulfillment status")
```

### .placeholder(value)

Set placeholder text for form inputs.

```typescript
email: string.placeholder("Enter your email...")
search: string.placeholder("Search products...")
```

### .example(value)

Set example value for OpenAPI documentation.

```typescript
email: string.example("user@example.com")
price: float.example(29.99)
```

### .icon(value)

Set icon for Admin UI display.

```typescript
email: string.icon("📧")
phone: string.icon("📱")
```

### .options(values)

Define allowed values (creates enum in OpenAPI and TypeScript).

```typescript
status: string.options(["pending", "active", "closed"])
priority: string.options(["low", "medium", "high", "urgent"])
```

### .ui(config)

Set UI rendering hints for Admin UI generation.

```typescript
content: text.ui({ component: "RichTextEditor" })
password: string.ui({ hidden: ["list", "detail"] })
order: int.ui({ order: 1, width: "100px" })
```

**Config options:**
- `component` - Custom component name
- `hidden` - Hide in specific views: `true` or `["list" | "detail" | "form" | "create" | "edit"]`
- `readonly` - Read-only in forms
- `order` - Display order
- `width` - Column width
- `group` - Group fields together

### .searchable()

Mark field for full-text search indexing.

```typescript
title: string.searchable()
content: text.searchable()
```

### .embedding(config?)

Enable vector embedding for semantic search (RAG).

```typescript
content: text.embedding()
content: text.embedding({ provider: "openai", model: "text-embedding-3-small" })
```

**Config options:**
- `provider` - `"openai"` | `"cohere"` | `"huggingface"` | custom
- `model` - Model name
- `dimensions` - Vector dimensions

### .sensitive()

Mark as PII/sensitive data for GDPR compliance.

```typescript
ssn: string.sensitive()
email: string.sensitive()
```

## Relations

### belongsTo(entity)

Many-to-one relation.

```typescript
author: belongsTo(() => user)
category: belongsTo(() => category).optional()
```

### hasMany(entity)

One-to-many relation.

```typescript
posts: hasMany(() => post)
comments: hasMany(() => comment)
```

### hasOne(entity)

One-to-one relation.

```typescript
profile: hasOne(() => profile)
```

### selfRef(type?)

Self-referential relation.

```typescript
parent: selfRef("parent").optional()
children: selfRef("children")
```

## Relation Methods

### .foreignKey(key)

Custom foreign key.

```typescript
author: belongsTo(() => user).foreignKey("creatorId")
```

### .onDelete(action)

Delete behavior.

```typescript
author: belongsTo(() => user).onDelete("cascade")
// "cascade" | "setNull" | "restrict"
```

### .remote(serviceId)

Remote relation.

```typescript
subscription: belongsTo(() => Sub).remote("stripeService")
```

## See Also

- [Fields Overview](/fields/overview)
- [Validation](/fields/validation)
- [Security](/fields/security)
