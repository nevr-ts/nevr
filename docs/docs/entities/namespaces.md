# Namespaces

Namespaces help organize entities in large codebases. They group related entities for schema splitting, code organization, and domain separation.

## Basic Usage

Assign entities to namespaces using `.namespace()`:

```typescript
// Auth domain
const user = entity("user", { ... }).namespace("auth")
const session = entity("session", { ... }).namespace("auth")
const token = entity("token", { ... }).namespace("auth")

// Catalog domain
const product = entity("product", { ... }).namespace("catalog")
const category = entity("category", { ... }).namespace("catalog")
const variant = entity("variant", { ... }).namespace("catalog")

// Orders domain
const order = entity("order", { ... }).namespace("orders")
const orderItem = entity("orderItem", { ... }).namespace("orders")
const shipment = entity("shipment", { ... }).namespace("orders")
```

## When to Use Namespaces

### Large Codebases (100+ entities)

```typescript
// Without namespaces - one massive schema file
// ❌ Hard to navigate, slow to generate

// With namespaces - split by domain
// ✅ Organized, faster generation
entity("user", { ... }).namespace("auth")
entity("product", { ... }).namespace("catalog")
entity("order", { ... }).namespace("orders")
```

### Domain-Driven Design

```typescript
// Bounded contexts as namespaces
entity("customer", { ... }).namespace("customers")
entity("invoice", { ... }).namespace("billing")
entity("ticket", { ... }).namespace("support")
entity("campaign", { ... }).namespace("marketing")
```

### Plugin Development

```typescript
// Plugin entities in their own namespace
entity("authUser", { ... }).namespace("@auth")
entity("authSession", { ... }).namespace("@auth")

entity("stripeCustomer", { ... }).namespace("@stripe")
entity("stripeSubscription", { ... }).namespace("@stripe")
```

### Microservice Alignment

```typescript
// Namespace per service
entity("user", { ... }).namespace("user-service")
entity("profile", { ... }).namespace("user-service")

entity("product", { ... }).namespace("catalog-service")
entity("inventory", { ... }).namespace("inventory-service")
```

## Schema Organization

Namespaces affect how schemas are generated:

```
prisma/
  schema/
  ├── models.prisma   # Main schema (no namespace)
  ├── auth.prisma     # Auth namespace
  ├── catalog.prisma  # Catalog namespace
  └── orders.prisma   # Orders namespace
  ├── schema.prisma   # Combined schema
```

### Generated Files

```prisma
// auth.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  ...
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  ...
}
```



## Cross-Namespace Relations

Entities can relate across namespaces:

```typescript
// Auth namespace
const user = entity("user", {
  name: string,
  email: string.email().unique(),
})
  .namespace("auth")

// Orders namespace
const order = entity("order", {
  orderNumber: string.unique(),
  total: float,
  customer: belongsTo(() => user),  // Cross-namespace relation
})
  .namespace("orders")
```

## Naming Conventions

### Domain-Based

```typescript
// Business domains
.namespace("auth")
.namespace("catalog")
.namespace("orders")
.namespace("billing")
.namespace("support")
```

### Plugin Prefix

```typescript
// Third-party plugins use @ prefix
.namespace("@auth")
.namespace("@stripe")
.namespace("@storage")
```

### Service-Based

```typescript
// Microservice alignment
.namespace("user-service")
.namespace("order-service")
.namespace("notification-service")
```
## Example Structure

**entities/auth/user.ts:**
```typescript
export const user = entity("user", {
  name: string,
  email: string.email().unique(),
})
  .namespace("auth")
```

**entities/auth/index.ts:**
```typescript
export { user } from "./user"
export { session } from "./session"
```

**entities/index.ts:**
```typescript
export * from "./auth"
export * from "./catalog"
export * from "./orders"
```

## Best Practices

### 1. Use Namespaces for 10+ Entities

```typescript
// Small project - namespaces optional
const user = entity("user", { ... })
const post = entity("post", { ... })

// Large project - use namespaces
const user = entity("user", { ... }).namespace("users")
const product = entity("product", { ... }).namespace("catalog")
```

### 2. Align with Business Domains

```typescript
// ✅ Good: reflects business language
.namespace("orders")
.namespace("customers")
.namespace("inventory")

// ❌ Bad: technical grouping
.namespace("models")
.namespace("tables")
```

### 3. Keep Namespaces Focused

```typescript
// ✅ Good: single responsibility
.namespace("auth")      // Authentication only
.namespace("billing")   // Billing only

// ❌ Bad: mixed concerns
.namespace("userStuff") // Auth + profile + billing?
```

### 4. Use Consistent Naming

```typescript
// ✅ Good: consistent convention
.namespace("auth")
.namespace("catalog")
.namespace("orders")

// ❌ Bad: inconsistent
.namespace("auth")
.namespace("ProductCatalog")
.namespace("order-management")
```

### 5. Document Namespace Purpose

```typescript
/**
 * Auth namespace: Authentication and session management
 * Entities: user, session, token, passwordReset
 */
export const user = entity("user", { ... }).namespace("auth")
```

## Summary

| Aspect | Without Namespace | With Namespace |
|--------|-------------------|----------------|
| Schema files | Single file | Split by namespace |
| API routes | Flat | Optionally prefixed |
| Code organization | All in one place | Grouped by domain |
| Best for | Small projects | Large projects (10+ entities) |

## Next Steps

- [Defining Entities](/entities/defining) - Complete entity guide
- [Plugins Overview](/plugins/overview) - Plugin namespaces
- [Architecture](/concepts/architecture) - System design

## Entity Builder API

You can set the namespace directly on the entity definition:

```typescript
export const user = entity("User", { ... })
  .namespace("Auth")
```

This ensures the entity is correctly categorized in the internal service container and API routing.
