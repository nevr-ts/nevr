# Fields Overview

> 🎯 **Fields define the shape of your data with types, validation, transformations, and security policies.**

## Why Nevr Fields?

### The Problem: Validation Logic Scattered Everywhere

| Approach | Problem |
|----------|----------|
| **Prisma-only** | No runtime validation, just types |
| **Zod everywhere** | Schemas duplicated across files |
| **Class validators** | Decorators on every property |
| **Manual validation** | Error-prone, inconsistent |

### The Solution: Nevr's Fluent Field DSL

Define your schema **once** with validation, transforms, and security built-in:

```typescript
email: string.trim().lower().email().unique()  // ✅ All in one place
```

> 🟢 **Beginner Tip**: Think of Nevr fields as "super-powered" Prisma fields. They handle validation, transformation, and security automatically.

> 🟡 **Prefer Zod?** You can use Zod schemas with the `.zod()` escape hatch—see [Zod Integration](#zod-integration) below.

---

## Basic Concept

Every entity is composed of fields that describe its properties:

```typescript
import { entity, string, int, boolean, datetime } from "nevr"

const user = entity("user", {
  name: string,                    // Simple string field
  email: string.unique(),          // String with unique constraint
  age: int.optional(),             // Optional integer
  isActive: boolean.default(true), // Boolean with default value
  createdAt: datetime,             // DateTime field
})
```

## Field Categories

Nevr fields are organized into several categories:

| Category | Purpose | Examples |
|----------|---------|----------|
| **Types** | Basic data types | `string`, `int`, `float`, `boolean`, `datetime`, `json` |
| **Modifiers** | Constraints and defaults | `.optional()`, `.unique()`, `.default()` |
| **Validation** | Input validation | `.email()`, `.min()`, `.max()`, `.regex()` |
| **Transforms** | Data transformation | `.trim()`, `.lower()`, `.upper()` |
| **Security** | Data protection | `.password()`, `.omit()`, `.encrypted()` |
| **Access** | Field-level permissions | `.readable()`, `.writable()`, `.adminOnly()` |
| **Relations** | Entity relationships | `belongsTo()`, `hasMany()`, `hasOne()`, `selfRef()` |

## Chainable API

All field methods are chainable, allowing you to compose complex field definitions:

```typescript
const user = entity("user", {
  // Chain multiple modifiers
  email: string
    .trim()           // Remove whitespace
    .lower()          // Convert to lowercase
    .email()          // Validate email format
    .unique(),        // Unique constraint

  // Chain validation and security
  password: string
    .min(8, "Password must be at least 8 characters")
    .password()       // Hash with scrypt
    .omit(),          // Never return in responses

  // Chain access policies
  ssn: string
    .encrypted()      // Encrypt at rest
    .readable("admin") // Only admins can read
    .writable("admin"), // Only admins can write
})
```

## Immutability

Field builders are immutable. Each method returns a new builder instance:

```typescript
const baseString = string.trim()
const emailField = baseString.email()  // New instance
const nameField = baseString.min(2)    // Another new instance

// baseString is unchanged
```

## Quick Reference

### Field Types

```typescript
import {
  string,    // Short string (VARCHAR)
  text,      // Long text (TEXT)
  int,       // Integer
  float,     // Decimal/float
  bool,      // Boolean (alias: boolean)
  boolean,   // Boolean
  datetime,  // DateTime
  json,      // Untyped JSON
  email,     // String with email validation
  jsonTyped, // Typed JSON with TypeScript inference
} from "nevr"
```

### Relations

```typescript
import { belongsTo, hasMany, hasOne, selfRef } from "nevr"

const post = entity("post", {
  author: belongsTo(() => user),           // Many-to-one
  comments: hasMany(() => comment),        // One-to-many
  featuredImage: hasOne(() => image),      // One-to-one
  parent: selfRef().optional(),            // Self-reference
})
```

---

## Zod Integration

Already using Zod and don't want to relearn? Use the `.zod()` escape hatch:

```typescript
import { z } from "zod"
import { entity, string } from "nevr"

const user = entity("user", {
  // Use Nevr's built-in validation
  name: string.min(2).max(50),
  
  // Or escape to Zod for complex validation
  email: string.zod(
    z.string()
      .email("Invalid email format")
      .refine((e) => !e.endsWith("@banned.com"), "Domain not allowed")
  ),
  
  // Mix both! Nevr modifiers still work with Zod
  password: string
    .zod(z.string().min(8).regex(/[A-Z]/, "Must have uppercase"))
    .password()  // Nevr's scrypt hashing
    .omit(),     // Never return in responses
})
```

> 🟡 **When to use Zod**: Complex cross-field validation, custom refinements, or when you already have Zod schemas you want to reuse.

---

## Next Steps

- [Field Types](/fields/types) - Learn about all available field types
- [Modifiers](/fields/modifiers) - Constraints like optional, unique, default
- [Validation](/fields/validation) - Input validation rules
- [Transforms](/fields/transforms) - Data transformation
- [Security](/fields/security) - Password hashing and encryption
- [Access Policies](/fields/access-policies) - Field-level permissions
- [Relations](/fields/relations) - Entity relationships
