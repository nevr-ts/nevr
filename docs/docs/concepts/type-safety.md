# Type Safety

One of Nevr's strongest features is its **End-to-End Type Safety**.

## The Problem

In traditional API development, you often have types defined in multiple places:
1.  Database Schema (SQL/Prisma)
2.  Backend DTOs (Classes/Interfaces)
3.  Frontend API Client (Interfaces)

Keeping these in sync is error-prone. If you change a database column, you must manually update the backend logic and the frontend client.

## The Nevr Solution

With Nevr, the **Entity Definition** is the single source of truth.

1.  **Database**: The Prisma schema is generated from the Entity.
2.  **Backend**: TypeScript types for request bodies and responses are inferred from the Entity.
3.  **Frontend**: A fully typed API client is generated from the Entity.

## Example

If you define:

```typescript
const user = entity("user", {
  age: number.min(18)
})
```

- The database will enforce `age` as an Integer.
- The API will return 400 if `age` < 18.
- The generated client will require `age` to be a number.

```typescript
// Frontend code using generated client
await client.user.create({
  age: "too young" // TypeScript Error! Type 'string' is not assignable to type 'number'.
})
```
