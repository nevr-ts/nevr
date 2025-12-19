# Entities

Entities are the heart of Nevr. They define shape, validation, relations, and authorization defaults.

## Define an Entity

```ts
import { entity, string, text, bool } from "nevr"

export const post = entity("post", {
  title: string.min(1).max(200),
  body: text,
  published: bool.default(false),
})
```

## Field Types & Modifiers

Available field types:

- `string`, `text`, `int`, `float`, `boolean` (alias: `bool`), `datetime`, `json`, `email`

Common modifiers:

- `.optional()` mark as nullable
- `.unique()` unique constraint (reflected in schema)
- `.default(value)` default on create
- `.min(n) / .max(n)` length/value constraints

Examples:

```ts
import { entity, string, int, email } from "nevr"

export const user = entity("user", {
  email: email.unique(),
  name: string.min(1).max(100),
  age: int.min(0).optional(),
})
```

## Relations

Nevr supports three relation builders:

- `belongsTo(() => Target)` — many-to-one, adds a foreign key (default: `<field>Id`)
- `hasMany(() => Target)` — one-to-many (inverse collection)
- `hasOne(() => Target)` — one-to-one (unique)

Options:

- `.foreignKey("customId")`
- `.onDelete("cascade" | "setNull" | "restrict")`
- `.optional()`

```ts
import { entity, string, belongsTo, hasMany } from "nevr"

export const user = entity("user", { name: string })

export const project = entity("project", {
  name: string,
  owner: belongsTo(() => user).onDelete("cascade"),
})

export const task = entity("task", {
  title: string,
  project: belongsTo(() => project),
  assignee: belongsTo(() => user),
})
```

When there are multiple `belongsTo` to the same target, Prisma relation names are generated automatically.

## Authorization Defaults with ownedBy

`ownedBy(field)` sets sensible CRUD rules based on ownership:

```ts
export const post = entity("post", { author: belongsTo(() => user) })
  .ownedBy("author")
```

Shorthand for:

```ts
.rules({
  create: ["authenticated"],
  read: ["everyone"],
  list: ["everyone"],
  update: ["owner"],
  delete: ["owner"],
})
```

Override with `.rules()` if needed.

## Timestamps

Entities include `createdAt`/`updatedAt` by default. Disable with:

```ts
entity("audit", { /* ... */ }).noTimestamps()
```

## Validation & Input

Input is validated from field definitions. Unknown fields are ignored to prevent mass assignment. For create, required fields are enforced unless a default exists.
