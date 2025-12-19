# Authentication

Nevr stays auth‑agnostic but ships helpers for development and JWT. You can integrate any provider (e.g., Better Auth) via the adapter `getUser` callback.

## Development Auth (headers)

```ts
import { expressAdapter, expressDevAuth } from "nevr/adapters/express"

app.use("/api", expressAdapter(api, { getUser: expressDevAuth }))
// Send headers: X-User-Id, X-User-Role
```

## JWT Auth

```ts
import { expressAdapter, expressJwtAuth } from "nevr/adapters/express"

const verify = async (token: string) => {
  // verify and return { id, role } or null
}

app.use("/api", expressAdapter(api, { getUser: expressJwtAuth(verify) }))
```

## Better Auth (concept)

Use your Better Auth session or token verification to build `getUser(req)` and return `{ id, role } | null`.

## Authorization Rules

Protect entities with ownership-aware rules using `ownedBy` or explicit `.rules()`:

```ts
const post = entity("post", { author: belongsTo(() => user) }).ownedBy("author")

// or
post.rules({ update: ["owner"], delete: ["owner", "admin"] })
```
