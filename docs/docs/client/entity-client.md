# Entity Client

Auto-generated CRUD methods for entities with full type safety.

## Setup

```typescript
import { createTypedClient, entityClient } from "nevr/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [
    entityClient({ entities: ["user", "product", "order"] })
  ]
})
```

---

## entityClient()

```typescript
function entityClient<TEntities>(options?: EntityClientOptions): NevrClientPlugin

interface EntityClientOptions<TEntities> {
  /** Entity names to expose */
  entities?: string[]
  /** Entity actions configuration */
  actions?: Record<string, string[]>
  /** Type-safe entity definitions from server */
  $types?: TEntities
}
```

---

## EntityMethods

Each entity gets these methods:

| Method | Description |
|--------|-------------|
| `list(options?)` | List with pagination, filter, sort |
| `create(data)` | Create new record |
| `get(id)` | Get by ID |
| `update(id, data)` | Update by ID |
| `delete(id)` | Delete by ID |
| `count(filter?)` | Count matching records |
| `action(name, id?, input?)` | Call entity action |

---

## list()

```typescript
const { data, error } = await client.products.list({
  filter: { published: true, price: { gte: 100 } },
  sort: { createdAt: "desc" },
  take: 10,
  skip: 0,
  include: ["category"],
  select: { id: true, name: true, price: true }
})

// Response
interface ListResponse<T> {
  data: T[]
  pagination: { total: number; limit: number; offset: number }
}
```

### ListOptions

```typescript
interface ListOptions<T> {
  filter?: EntityFilter<T>
  sort?: EntitySort<T>
  take?: number
  skip?: number
  include?: string[]
  select?: Record<string, boolean>
}
```

### Filter Operators

```typescript
// Exact match
filter: { status: "active" }

// Operators
filter: { price: { gte: 100, lte: 500 } }
filter: { name: { contains: "phone" } }
filter: { category: { in: ["electronics", "gadgets"] } }

// Logical operators
filter: { OR: [{ status: "active" }, { featured: true }] }
filter: { AND: [{ price: { gte: 100 } }, { stock: { gt: 0 } }] }
filter: { NOT: { deleted: true } }
```

### FilterOperators

```typescript
interface FilterOperators<T> {
  equals?: T
  not?: T
  in?: T[]
  notIn?: T[]
  lt?: T
  lte?: T
  gt?: T
  gte?: T
  contains?: string
  startsWith?: string
  endsWith?: string
}
```

---

## create()

```typescript
const { data, error } = await client.users.create({
  email: "john@example.com",
  name: "John Doe",
})

// data = { id: "user_123", email: "...", name: "...", createdAt: "..." }
```

---

## get()

```typescript
const { data, error } = await client.users.get("user_123")

if (error) {
  console.error(error.message) // "User not found"
}
```

---

## update()

```typescript
const { data, error } = await client.users.update("user_123", {
  name: "Jane Doe",
})
```

---

## delete()

```typescript
const { data, error } = await client.users.delete("user_123")
```

---

## count()

```typescript
const { data } = await client.users.count({ role: "admin" })
// data = { count: 5 }
```

---

## action()

Call entity actions:

```typescript
// Resource action (with ID)
await client.orders.action("checkout", "order_123", {
  paymentMethodId: "pm_xxx",
})

// Resource action (no input)
await client.posts.action("publish", "post_123")

// Collection action (no ID)
await client.products.action("bulkPublish", {
  ids: ["prod_1", "prod_2"],
})
```

---

## Type Inference

Full E2E type safety from server using `createTypedClient`:

::: code-group

```typescript [src/nevr.config.ts]
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { user, product } from "./entities/index.js"

export const config = defineConfig({
  database: "sqlite",
  entities: [user, product],
  plugins: [auth()],
})

export default config
```

```typescript [src/server.ts]
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

export const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
export type API = typeof api
```

```typescript [src/client.ts]
import { createTypedClient, entityClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server"

export const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [
    entityClient({ entities: ["user", "product"] }),
    authClient(),
  ],
})

// Fully typed entities!
const { data } = await client.users.list()
const { data: product } = await client.products.create({ name: "Widget" })

// Fully typed plugin methods!
await client.auth.signIn.email({ email: "...", password: "..." })
```

:::

> [!NOTE]
> The `import type { API }` is required for entity type safety. This is a TypeScript requirement - runtime strings like `["user"]` cannot carry type information.



## Examples

### Paginated List

```typescript
async function getPage(page: number, pageSize = 10) {
  return client.products.list({
    take: pageSize,
    skip: (page - 1) * pageSize,
    sort: { createdAt: "desc" },
    select: { id: true, name: true, price: true },
  })
}
```

### Search

```typescript
async function search(query: string) {
  return client.products.list({
    filter: {
      OR: [
        { name: { contains: query } },
        { description: { contains: query } },
      ]
    }
  })
}
```

### Filter by Relation

```typescript
const { data } = await client.orders.list({
  filter: { customerId: "user_123", status: "pending" },
  include: ["items", "customer"],
})
```
### Filter by selected Fields

```typescript
const { data } = await client.users.list({
  filter: { role: "admin" },
  select: { id: true, email: true, name: true }
})
```


## Next Steps

- [React Integration](/client/react)
- [Client Overview](/client/overview)
