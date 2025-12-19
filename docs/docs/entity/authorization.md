# Authorization

Nevr has a built-in Role-Based Access Control (RBAC) system. You can define exactly who can perform which operations on your entities.

---

## The `rules()` Method

You can define rules for each of the standard CRUD operations: `create`, `read`, `update`, `delete`, and `list`.

```typescript
const post = entity("post", {
  title: string,
  content: text
}).rules({
  create: ["authenticated"],
  read: ["everyone"],
  update: ["admin"],
  delete: ["admin"]
})
```

### Operations

| Operation | Description |
|-----------|-------------|
| `create` | Creating a new record (POST) |
| `read` | Reading a single record by ID (GET /:id) |
| `update` | Updating a record (PUT/PATCH) |
| `delete` | Deleting a record (DELETE) |
| `list` | Listing multiple records (GET /) |

---

## Built-in Rules

Nevr comes with several built-in rules:

### `"everyone"`
Allows access to anyone, including unauthenticated users. This is the default if no rules are specified.

### `"authenticated"`
Allows access only to logged-in users.

### `"admin"`
Allows access only to users with `role: "admin"`.

### `"owner"`
Allows access only to the user who "owns" the resource. Requires the entity to have an owner field (see below).

---

## Ownership

For the `"owner"` rule to work, Nevr needs to know which field represents the owner of the record.

### Using `.ownedBy()`

The easiest way to set this up is using the `.ownedBy()` method.

```typescript
const post = entity("post", {
  title: string,
  author: belongsTo(() => user)
}).ownedBy("author")
```

This does two things:
1. Tells Nevr that the `author` relation (and its underlying `authorId` field) represents the owner.
2. **Sets default rules** for you.

### Default Rules for Owned Entities

When you use `.ownedBy()`, Nevr automatically applies these sensible defaults:

```typescript
{
  create: ["authenticated"], // Must be logged in to create
  read: ["everyone"],        // Anyone can read
  update: ["owner"],         // Only owner can update
  delete: ["owner"],         // Only owner can delete
  list: ["everyone"]         // Anyone can list
}
```

### Overriding Defaults

You can combine `.ownedBy()` with `.rules()` to customize the behavior.

```typescript
// Example: Private Diary
// Only the owner can read or list their own entries
const diaryEntry = entity("diaryEntry", {
  content: text,
  author: belongsTo(() => user)
})
  .ownedBy("author")
  .rules({
    read: ["owner"],
    list: ["owner"]
  })
```

---

## Combining Rules

You can provide multiple rules for an operation. If **any** of the rules pass, access is granted (OR logic).

```typescript
// Owner OR Admin can delete
delete: ["owner", "admin"]
```

---

## Custom Rules

(Advanced) You can define custom rule functions.

```typescript
const isModerator = (ctx) => ctx.user.role === "moderator"

const post = entity("post", { ... })
  .rules({
    delete: ["owner", "admin", isModerator]
  })
```

---

## Authentication Setup

For these rules to work, you need to have an authentication plugin installed (like `@nevr/plugin-auth`) or manually provide the user object in the context.

### With `@nevr/plugin-auth`

The auth plugin automatically handles sessions and populates `ctx.user`.

### Manual Setup (Express)

If you are using your own auth middleware:

```typescript
app.use("/api", (req, res, next) => {
  // Populate user from your session/token
  // The adapter will pass this to Nevr
  (req as any).user = { id: "123", role: "user" }
  next()
}, expressAdapter(api))
```

---

## Example Scenarios

### Public Blog
- Anyone can read
- Only admins can write

```typescript
.rules({
  read: ["everyone"],
  list: ["everyone"],
  create: ["admin"],
  update: ["admin"],
  delete: ["admin"]
})
```

### Social Media Post
- Anyone can read
- Authenticated users can create
- Users can edit/delete their own posts
- Admins can delete any post

```typescript
.ownedBy("author")
.rules({
  delete: ["owner", "admin"]
})
```

### User Profile
- Anyone can read
- Only the user can update their own profile
- No one can delete (except maybe admin)

```typescript
.ownedBy("user") // Assuming a self-referential or implicit ownership
.rules({
  create: ["admin"], // Only admin creates users manually?
  delete: ["admin"]
})
```
