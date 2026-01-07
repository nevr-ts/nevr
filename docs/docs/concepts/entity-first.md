# Entity-First Design

> In Nevr, the **Entity is the single source of truth** for your entire application.

## What is Entity-First?

Instead of defining schemas in multiple places, you define one Entity that generates everything:

```typescript
const user = entity("user", {
  name: string,
  email: string.unique(),
  role: string.default("user"),
})
```

From this single definition, Nevr derives:

| Output | Description |
|--------|-------------|
| **Database Schema** | Prisma model with constraints |
| **REST API** | GET, POST, PATCH, DELETE endpoints |
| **Validation** | Input validation rules |
| **E2E Type Safety** | End-to-end type safety from backend to frontend |
| **OpenAPI Spec** | Documentation for all endpoints |

## Traditional vs Entity-First

### Traditional Approach

```typescript
// 1. Database schema (schema.prisma)
model User {
  id    String @id
  name  String
  email String @unique
}

// 2. DTO (user.dto.ts)
interface CreateUserDto {
  name: string
  email: string
}

// 3. Controller (user.controller.ts)
app.post("/users", async (req, res) => { ... })

// 4. Service (user.service.ts)
class UserService { ... }

// 5. Frontend types (user.types.ts)
interface User { ... }
```

**5 files, all must stay in sync manually.**

### Entity-First Approach

```typescript
// Just one file
const user = entity("user", {
  name: string,
  email: string.unique(),
})
```

**1 file, everything else is derived.**

## Benefits

1. **No Drift** - Types can't get out of sync
2. **Less Code** - 80% reduction in boilerplate
3. **Faster Changes** - Change once, updates everywhere
4. **Type Safety** - Compile-time error catching

## Next Steps

- [Fields Overview](/fields/overview)
- [Defining Entities](/entities/defining)
