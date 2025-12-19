# Type Safety in Nevr

Nevr is designed for full end-to-end type safety. Every layer is typed, from your entity definitions to your API client.

## Why Type Safety?

- **Catch errors at compile time**
- **IntelliSense everywhere**
- **No runtime surprises**
- **Safer refactoring**

## Type-Safe Entities

Entity fields are strongly typed:

```typescript
const User = entity('User', {
  name: string(),
  age: int(),
  email: email(),
});
```

Nevr generates:
- `User` type
- `CreateUserInput` type
- `UpdateUserInput` type

## Type-Safe API

All API routes are typed:

```typescript
import { createClient } from './generated/client';

const client = createClient({ baseUrl: '/api' });

const user: User = await client.users.findOne(1);
```

- Autocomplete for all routes
- Type-checked input/output

## Type-Safe Database

Nevr generates a Prisma schema and types:

```typescript
import { PrismaClient } from '../generated/prisma';

const db = new PrismaClient();
// db.user.findMany() returns User[]
```

## Type-Safe Plugins

Plugins can add fields and hooks with types:

```typescript
const Post = entity('Post', {...}).use(timestamps());
// Post type now includes createdAt, updatedAt
```

## Type-Safe Rules

Rules are type-checked:

```typescript
.rules({
  find: 'everyone',
  create: 'admin',
  update: 'owner',
})
// Only valid rule names allowed
```

## TypeScript Version

Nevr requires TypeScript 5.0+ for best type inference.

## Best Practices

- Use VS Code for best IntelliSense
- Always regenerate types after changing entities
- Use the generated client in your frontend and tests

## Next Steps

- [Entities](/docs/concepts/entities)
- [Generated Types](/docs/entity/defining-entities)
- [API Client](/docs/basic-usage)
