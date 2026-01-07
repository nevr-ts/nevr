# Field Access Policies

Field access policies control who can read or write specific fields. This provides fine-grained security at the field level, allowing different parts of your data to have different access rules.

## Policy Types

Nevr supports both built-in policy rules and custom policy functions:

### Built-in Policies

| Policy | Description |
|--------|-------------|
| `"everyone"` | Anyone can access (including unauthenticated) |
| `"authenticated"` | Only authenticated users |
| `"owner"` | Only the resource owner |
| `"admin"` | Only admin users |
| `"none"` | No one can access |

### Custom Policy Functions

```typescript
type FieldAccessPolicyFn = (ctx: FieldAccessContext) => boolean | Promise<boolean>

interface FieldAccessContext {
  user?: User              // Current authenticated user
  record?: Record<string, unknown>  // The record being accessed
  operation: "read" | "write"       // Current operation
  field: string                     // Field name being accessed
}
```

---

## Read Policies

### readable()

Controls who can see this field in API responses.

```typescript
import { entity, string, float, boolean } from "nevr"

const user = entity("user", {
  // Everyone can see
  name: string,
  avatar: string.optional(),

  // Only authenticated users
  email: string.readable("authenticated"),

  // Only the owner can see their own
  phoneNumber: string.readable("owner").optional(),

  // Only admins
  role: string.readable("admin").default("user"),

  // Never readable (use .omit() instead for this)
  password: string.readable("none").password().omit(),
})
```

### How Read Policies Work

When a user requests data:

1. **everyone** - Field always included
2. **authenticated** - Field included if user is logged in
3. **owner** - Field included if `user.id === record.userId` (or similar ownership check)
4. **admin** - Field included if `user.role === "admin"`
5. **none** - Field never included
6. **Custom function** - Field included if function returns `true`

**Example Response:**

For an admin viewing another user's profile:
```json
{
  "id": "usr_123",
  "name": "John Doe",
  "email": "john@example.com",
  "phoneNumber": null,  // Hidden - admin is not the owner
  "role": "user"        // Visible - viewer is admin
}
```

---

## Write Policies

### writable()

Controls who can modify this field on create/update.

```typescript
const user = entity("user", {
  // Anyone can write (on create)
  name: string,
  email: string,

  // Only owner can update
  bio: string.writable("owner").optional(),
  avatar: string.writable("owner").optional(),

  // Only admins can modify
  role: string.writable("admin").default("user"),
  isVerified: boolean.writable("admin").default(false),

  // No one can write (computed or system-managed)
  createdAt: datetime.writable("none"),
  lastLoginAt: datetime.writable("none").optional(),
})
```

### How Write Policies Work

When a user submits data:

1. **everyone** - Anyone can write this field
2. **authenticated** - Only logged-in users can write
3. **owner** - Only the owner can modify (update only)
4. **admin** - Only admins can modify
5. **none** - Field cannot be set via API (read-only)
6. **Custom function** - Field writable if function returns `true`

---

## Shorthand Methods

### readOnly()

Makes a field read-only (equivalent to `.writable("none")`).

```typescript
const post = entity("post", {
  // Computed fields
  slug: string.readOnly().unique(),  // Generated from title
  viewCount: int.readOnly().default(0),  // Updated by system

  // Timestamps
  createdAt: datetime.readOnly(),
  updatedAt: datetime.readOnly(),
})
```

### adminOnly()

Restricts both read and write to admins (equivalent to `.readable("admin").writable("admin")`).

```typescript
const user = entity("user", {
  email: string.unique(),
  name: string,

  // Admin-only fields
  internalNotes: text.adminOnly().optional(),
  auditLog: json.adminOnly().optional(),
  permissions: jsonTyped<string[]>().adminOnly().default([]),
})
```

### ownerWritable()

Allows everyone to read, but only owner to write (equivalent to `.writable("owner")`).

```typescript
const profile = entity("profile", {
  userId: belongsTo(() => user),

  // Owner can update their own profile
  displayName: string.ownerWritable(),
  bio: text.ownerWritable().optional(),
  website: string.url().ownerWritable().optional(),
  location: string.ownerWritable().optional(),
})
```

---

## Custom Access Functions

For complex access rules, use custom functions:

```typescript
const document = entity("document", {
  title: string,
  content: text,

  // Team members can read
  internalNotes: text.readable((ctx) => {
    return ctx.user?.teamId === ctx.record?.teamId
  }).optional(),

  // Manager or higher can write
  budget: float.writable((ctx) => {
    const roles = ["manager", "director", "admin"]
    return roles.includes(ctx.user?.role || "")
  }),

  // Complex permission check
  sensitiveData: text.readable(async (ctx) => {
    if (!ctx.user) return false
    // Could query database for permissions
    const hasPermission = await checkUserPermission(ctx.user.id, "view_sensitive")
    return hasPermission
  }),
})
```

### Async Policy Functions

Policies can be async for database lookups:

```typescript
const project = entity("project", {
  name: string,

  // Check team membership from database
  secretKey: string.readable(async (ctx) => {
    if (!ctx.user) return false

    const membership = await db.teamMember.findFirst({
      where: {
        userId: ctx.user.id,
        projectId: ctx.record?.id,
        role: { in: ["admin", "developer"] }
      }
    })

    return !!membership
  }),
})
```

---

## Combining Policies

### Different Read and Write Policies

```typescript
const post = entity("post", {
  title: string,
  content: text,

  // Everyone reads, owner writes
  excerpt: text
    .readable("everyone")
    .writable("owner"),

  // Authenticated reads, admin writes
  featured: boolean
    .readable("authenticated")
    .writable("admin")
    .default(false),

  // Owner reads, admin writes
  privateNotes: text
    .readable("owner")
    .writable("admin")
    .optional(),
})
```

### Policies with Security

```typescript
const user = entity("user", {
  // Public fields
  username: string.unique(),
  displayName: string,

  // Owner-only contact info
  email: string
    .email()
    .readable("owner")
    .writable("owner")
    .unique(),

  // Admin-only + encrypted
  ssn: string
    .readable("admin")
    .writable("admin")
    .encrypted(),

  // Never exposed
  password: string
    .readable("none")
    .writable("authenticated")
    .password()
    .omit(),
})
```

---

## Access Policy Reference

| Method | Read | Write | Use Case |
|--------|------|-------|----------|
| `.readable(policy)` | Set | - | Control field visibility |
| `.writable(policy)` | - | Set | Control field modification |
| `.readOnly()` | - | none | System/computed fields |
| `.adminOnly()` | admin | admin | Sensitive admin data |
| `.ownerWritable()` | - | owner | User profile fields |

---

## Examples

### User Profile

```typescript
const user = entity("user", {
  // Public info
  id: string.unique(),
  username: string.unique(),
  displayName: string,
  avatar: string.optional(),

  // Authenticated users only
  email: string
    .email()
    .readable("authenticated")
    .writable("owner")
    .unique(),

  // Owner only
  phoneNumber: string
    .readable("owner")
    .writable("owner")
    .optional(),

  settings: jsonTyped<UserSettings>()
    .readable("owner")
    .writable("owner")
    .default({}),

  // Admin only
  role: string
    .readable("authenticated")
    .writable("admin")
    .default("user"),

  isVerified: boolean
    .readable("authenticated")
    .writable("admin")
    .default(false),

  internalNotes: text
    .adminOnly()
    .optional(),

  // System managed
  createdAt: datetime.readOnly(),
  lastLoginAt: datetime.readOnly().optional(),
})
```

### E-commerce Order

```typescript
const order = entity("order", {
  // Basic info
  orderNumber: string.unique().readOnly(),

  // Owner can see their orders
  userId: belongsTo(() => user),

  items: jsonTyped<OrderItem[]>()
    .readable("owner")
    .writable("none"), // Set at creation only

  // Financial - owner readable
  subtotal: float.readable("owner").readOnly(),
  tax: float.readable("owner").readOnly(),
  total: float.readable("owner").readOnly(),

  // Status - owner reads, admin updates
  status: string
    .readable("owner")
    .writable("admin")
    .default("pending"),

  // Shipping - owner readable
  shippingAddress: jsonTyped<Address>()
    .readable("owner")
    .writable("owner"),

  trackingNumber: string
    .readable("owner")
    .writable("admin")
    .optional(),

  // Admin only
  internalNotes: text.adminOnly().optional(),
  refundReason: text.adminOnly().optional(),
})
```

### Multi-Tenant App

```typescript
const document = entity("document", {
  title: string,
  content: text,

  // Organization membership check
  organizationId: belongsTo(() => organization),

  // Team members can read
  team: jsonTyped<string[]>()
    .readable((ctx) => {
      // Check if user is in the team array
      return ctx.record?.team?.includes(ctx.user?.id) || false
    })
    .writable("admin"),

  // Org admins can modify sensitive fields
  isPublic: boolean
    .readable("everyone")
    .writable(async (ctx) => {
      if (!ctx.user || !ctx.record) return false
      const membership = await getOrgMembership(
        ctx.user.id,
        ctx.record.organizationId
      )
      return membership?.role === "admin"
    })
    .default(false),
})
```

### Healthcare Record

```typescript
const patientRecord = entity("patientRecord", {
  patientId: belongsTo(() => patient),

  // Patient can see their own records
  diagnosis: text
    .readable("owner")
    .writable("none")
    .encrypted(),

  treatment: text
    .readable("owner")
    .writable("none")
    .encrypted(),

  // Only medical staff can add notes
  medicalNotes: text
    .readable(ctx => ["doctor", "nurse"].includes(ctx.user?.role || ""))
    .writable(ctx => ["doctor"].includes(ctx.user?.role || ""))
    .encrypted(),

  // Billing - patient and billing staff
  billingInfo: jsonTyped<BillingInfo>()
    .readable(ctx => {
      return ctx.user?.id === ctx.record?.patientId ||
             ctx.user?.role === "billing"
    })
    .writable(ctx => ctx.user?.role === "billing")
    .encrypted(),
})
```

---

## Best Practices

### 1. Default to restrictive policies

```typescript
// Good - explicit about access
sensitiveData: string.readable("admin").writable("admin")

// Risky - anyone can read by default
sensitiveData: string
```

### 2. Use readOnly() for computed fields

```typescript
// Good - prevent accidental modification
viewCount: int.readOnly().default(0)
slug: string.readOnly().unique()

// Bad - could be manipulated
viewCount: int.default(0)
```

### 3. Combine with security features

```typescript
// Defense in depth
ssn: string
  .encrypted()         // Layer 1: Encryption
  .readable("admin")   // Layer 2: Access control
  .writable("admin")
```

### 4. Use custom functions for complex rules

```typescript
// Good - clear and flexible
budget: float.writable(ctx => {
  const canEdit = ["manager", "director", "cfo"].includes(ctx.user?.role || "")
  return canEdit
})

// Less flexible - hardcoded to single role
budget: float.writable("admin")
```

### 5. Document your policies

```typescript
const user = entity("user", {
  // Public profile info
  displayName: string,

  // Contact info - only owner can see/edit
  email: string.readable("owner").writable("owner"),

  // Administrative - only admins
  role: string.adminOnly().default("user"),
})
```

## Next Steps

- [Relations](/fields/relations) - Entity relationships
- [Security](/fields/security) - Password hashing and encryption
- [Cross-Field Validation](/entities/cross-field-validation) - Entity-level validation

