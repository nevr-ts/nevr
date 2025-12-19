# Relationships

Relationships connect your entities together. Nevr supports three types of relationships that map directly to Prisma relations.

---

## Importing Relationship Functions

```typescript
import { belongsTo, hasMany, hasOne } from "nevr"
```

---

## Relationship Types

### `belongsTo` — Many-to-One

A `post` **belongs to** a `user`. Many posts can belong to one user.

```typescript
// post.ts
import { entity, string, text, belongsTo } from "nevr"
import { user } from "./user"

export const post = entity("post", {
  title: string,
  content: text,
  author: belongsTo(() => user)
})
```

**What happens:**
- Adds `authorId` column to the `post` table
- Creates a foreign key constraint
- In the API, you send `authorId` when creating a post

**API Request:**
```json
POST /posts
{
  "title": "Hello World",
  "content": "My first post",
  "authorId": "user_123"
}
```

---

### `hasMany` — One-to-Many

A `user` **has many** `posts`. This is the inverse of `belongsTo`.

```typescript
// user.ts
import { entity, string, email, hasMany } from "nevr"
import { post } from "./post"

export const user = entity("user", {
  name: string,
  email: email.unique(),
  posts: hasMany(() => post)
})
```

**What happens:**
- No column added to `user` table (the FK is on `post`)
- Enables fetching user's posts
- Not included in create/update input

---

### `hasOne` — One-to-One

A `user` **has one** `profile`. Each user has exactly one profile.

```typescript
// profile.ts
import { entity, text, belongsTo } from "nevr"
import { user } from "./user"

export const profile = entity("profile", {
  bio: text.optional(),
  avatar: string.optional(),
  user: belongsTo(() => user)
})

// user.ts
export const user = entity("user", {
  name: string,
  profile: hasOne(() => profile)
})
```

---

## The Arrow Function Pattern

**Always use arrow functions** when referencing other entities:

```typescript
// ✅ Correct
author: belongsTo(() => user)

// ❌ Wrong - causes circular import issues
author: belongsTo(user)
```

The arrow function defers the resolution of the entity, avoiding circular import problems.

---

## Relationship Modifiers

### `.optional()`

Make a relationship optional (nullable foreign key):

```typescript
const post = entity("post", {
  title: string,
  // Post may or may not have a category
  category: belongsTo(() => category).optional()
})
```

---

### `.foreignKey(name)`

Customize the foreign key column name:

```typescript
const post = entity("post", {
  title: string,
  author: belongsTo(() => user).foreignKey("createdById")
})
```

**Result:** Column is named `createdById` instead of `authorId`.

---

### `.onDelete(action)`

Control what happens when the related record is deleted:

```typescript
const post = entity("post", {
  author: belongsTo(() => user).onDelete("cascade")
})
```

| Action | Effect |
|--------|--------|
| `"cascade"` | Delete post when user is deleted |
| `"setNull"` | Set `authorId` to null when user is deleted |
| `"restrict"` | Prevent deleting user if they have posts |

---

## Complete Example: Blog

Let's build a blog with users, posts, and comments.

### User Entity

```typescript
// entities/user.ts
import { entity, string, email, hasMany } from "nevr"

export const user = entity("user", {
  name: string.min(1).max(100),
  email: email.unique(),
  posts: hasMany(() => post),
  comments: hasMany(() => comment)
})
```

### Post Entity

```typescript
// entities/post.ts
import { entity, string, text, bool, belongsTo, hasMany } from "nevr"
import { user } from "./user"

export const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  published: bool.default(false),
  author: belongsTo(() => user),
  comments: hasMany(() => comment)
}).ownedBy("author")
```

### Comment Entity

```typescript
// entities/comment.ts
import { entity, text, belongsTo } from "nevr"
import { user } from "./user"
import { post } from "./post"

export const comment = entity("comment", {
  content: text.min(1).max(1000),
  author: belongsTo(() => user),
  post: belongsTo(() => post).onDelete("cascade")
}).ownedBy("author")
```

---

## Generated Prisma Schema

For the blog example above, Nevr generates:

```prisma
model User {
  id        String    @id @default(cuid())
  name      String
  email     String    @unique
  posts     Post[]
  comments  Comment[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Post {
  id        String    @id @default(cuid())
  title     String
  content   String
  published Boolean   @default(false)
  authorId  String
  author    User      @relation(fields: [authorId], references: [id])
  comments  Comment[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## API Usage

### Creating with Relationships

```bash
# Create a user first
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# Response: { "id": "user_abc123", "name": "Alice", ... }

# Create a post for that user
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Post",
    "content": "Hello World!",
    "authorId": "user_abc123"
  }'

# Create a comment on the post
curl -X POST http://localhost:3000/api/comments \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Great post!",
    "authorId": "user_abc123",
    "postId": "post_xyz789"
  }'
```

---

## Relationship Summary

| Function | Use Case | Creates FK On |
|----------|----------|---------------|
| `belongsTo(entity)` | Post belongs to User | Current entity |
| `hasMany(entity)` | User has many Posts | Related entity |
| `hasOne(entity)` | User has one Profile | Related entity |

---

## Next Steps

- [Authorization](/entity/authorization) — Control access with rules
- [CRUD Operations](/guides/crud) — Work with the API