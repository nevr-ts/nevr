# Type Inference

> 🔮 **Nevr's type inference system provides end-to-end type safety from server to client without code generation.**

Nevr allows you to share strict TypeScript types between your server and client without code generation steps. This is powered by the `$Infer` pattern, similar to Better Auth and tRPC.

## Why Type Inference Matters

| Approach | DX | Safety | Maintenance |
|----------|-----|--------|-------------|
| **Manual Interfaces** | Write interfaces twice | ❌ Drift risk | ❌ High |
| **Code Generation** | Run generators | ⚠️ Stale types | ⚠️ Medium |
| **Nevr Inference** | Zero config | ✅ Always in sync | ✅ None |

---

## The $Infer Pattern

The `NevrInstance` exposes a special `$Infer` property that contains all inferred types for your application.

```typescript
// server.ts
import { nevr, entity, string, int, belongsTo } from "nevr"

const user = entity("user", {
  name: string,
  email: string.email().unique(),
})

const post = entity("post", {
  title: string,
  views: int.default(0),
  author: belongsTo(() => user),
})

export const api = nevr({
  entities: [user, post],
  driver: prisma(db),
})

// Just export the API type - that's all you need!
export type Api = typeof api
```

### Accessing Types from $Infer

```typescript
// The client or any other file can extract types from Api
import type { Api } from "./server"

// Access entity types directly
type User = Api["$Infer"]["Entities"]["user"]
type Post = Api["$Infer"]["Entities"]["post"]

// Or use a type alias for convenience
type Entities = Api["$Infer"]["Entities"]
type User = Entities["user"]
```

> **💡 DX Tip**: You only need to export `type Api = typeof api`. All entity types are accessible via `Api["$Infer"]["Entities"]["entityName"]`.

### DX Helper Types (New!)

For even cleaner code, use the new helper types:

```typescript
import type { EntityOf, EntityNamesOf, EntitiesOf } from "nevr"
import type { Api } from "./server"

// Instead of: Api["$Infer"]["Entities"]["user"]
type User = EntityOf<Api, "user">
type Product = EntityOf<Api, "product">

// Get all entity names as union
type Names = EntityNamesOf<Api>
// "user" | "product" | "order"

// Get all entities as mapped type
type Entities = EntitiesOf<Api>
// { user: User; product: Product; order: Order }
```

### What $Infer Exposes

| Property | Description |
|----------|-------------|
| `$Infer.Entities` | All entity types mapped by name |
| `$Infer.EntityNames` | Union of all entity name strings |

---

## Recommended Type Export Pattern

For best DX, create a `types.ts` file that re-exports everything:

```typescript
// types.ts (shared types file)
import type { Api } from "./server"
import type { InferCreateInput, InferUpdateInput } from "nevr"
import { user, post, product } from "./entities"

// === Entity Data Types ===
export type User = Api["$Infer"]["Entities"]["user"]
export type Post = Api["$Infer"]["Entities"]["post"]
export type Product = Api["$Infer"]["Entities"]["product"]

// === Input Types (for forms) ===
export type CreateUser = InferCreateInput<typeof user>
export type UpdateUser = InferUpdateInput<typeof user>
export type CreatePost = InferCreateInput<typeof post>

// === Type-safe Entity Names ===
export type EntityNames = Api["$Infer"]["EntityNames"]
// "user" | "post" | "product"
```

Then import from `types.ts` everywhere:

```typescript
// components/UserForm.tsx
import type { User, CreateUser } from "../types"

function UserForm({ user }: { user?: User }) {
  const [data, setData] = useState<CreateUser>({ name: "", email: "" })
  // ...
}
```

---

## Client-Side Usage

The most common use case is creating a type-safe client.

```typescript
// client.ts
import { createTypedClient, entityClient } from "nevr/client"
import type { Api } from "./server"

// 1. Create typed client with entity plugin
const client = createTypedClient<Api>({
  baseURL: "/api",
  plugins: [
    entityClient({ entities: ["user", "post"] })
  ]
})

// 2. Enjoy full autocomplete
const { data: users } = await client.users.list({
  filter: { email: { contains: "@gmail.com" } },
  sort: { createdAt: "desc" },
  take: 10,
})
// users is typed as User[]

// 3. Create with validation
const { data: newPost } = await client.posts.create({
  title: "Hello World",  // TypeScript knows this is required
  // views is optional (has default)
})
```

---

## Type Inference Reference

### Field Type Mapping

| Nevr Field | TypeScript Type |
|------------|-----------------|
| `string`, `text` | `string` |
| `int`, `float` | `number` |
| `boolean`, `bool` | `boolean` |
| `datetime` | `Date` |
| `json` | `Record<string, unknown>` |
| `jsonTyped<T>()` | `T` |
| `.optional()` | `T \| null` |

### Entity Type Inference

```typescript
import type { 
  InferEntityData, 
  InferCreateInput, 
  InferUpdateInput,
  ListResponse,
  ApiResponse,
} from "nevr"

// Direct entity type inference
type User = InferEntityData<typeof user>
// { id: string; name: string; email: string; createdAt: Date; updatedAt: Date }

type CreateUser = InferCreateInput<typeof user>
// { name: string; email: string } - id and timestamps omitted

type UpdateUser = InferUpdateInput<typeof user>
// { name?: string; email?: string } - all optional

// Response type helpers
type UsersResponse = ListResponse<typeof user>
// { data: User[]; pagination: { total: number; limit: number; offset: number } }
```

---

## Entity Client - Full Type Safety

The `entityClient` plugin provides fully-typed CRUD operations.

### EntityMethods Interface

```typescript
interface EntityMethods<TData, TCreate> {
  list(options?: ListOptions<TData>): Promise<NevrFetchResponse<ListResponse<TData>>>
  create(data: TCreate): Promise<NevrFetchResponse<TData>>
  get(id: string): Promise<NevrFetchResponse<TData>>
  update(id: string, data: Partial<TCreate>): Promise<NevrFetchResponse<TData>>
  delete(id: string): Promise<NevrFetchResponse<void>>
  count(filter?: EntityFilter<TData>): Promise<NevrFetchResponse<{ count: number }>>
  action<TOutput, TInput>(name: string, idOrInput: string | TInput, input?: TInput): Promise<NevrFetchResponse<TOutput>>
}
```

### ListOptions - Typed Filtering & Sorting

```typescript
interface ListOptions<T> {
  filter?: EntityFilter<T>   // Typed filter for each field
  sort?: EntitySort<T>       // { fieldName: "asc" | "desc" }
  take?: number              // Limit
  skip?: number              // Offset
  include?: string[]         // Relations to include
}

// Example with full type safety
const { data } = await client.products.list({
  filter: {
    price: { gte: 100, lte: 500 },  // TypeScript knows price is number
    status: "active",                 // TypeScript knows status is string
    OR: [
      { category: "electronics" },
      { featured: true },
    ],
  },
  sort: { createdAt: "desc" },
  take: 20,
})
```

### Filter Operators

| Operator | Types | Example |
|----------|-------|---------|
| `equals` | All | `{ status: { equals: "active" } }` |
| `not` | All | `{ status: { not: "deleted" } }` |
| `in` | All | `{ status: { in: ["active", "pending"] } }` |
| `notIn` | All | `{ id: { notIn: ["1", "2"] } }` |
| `lt`, `lte` | number, Date | `{ price: { lt: 100 } }` |
| `gt`, `gte` | number, Date | `{ createdAt: { gte: new Date() } }` |
| `contains` | string | `{ email: { contains: "@gmail" } }` |
| `startsWith` | string | `{ name: { startsWith: "John" } }` |
| `endsWith` | string | `{ email: { endsWith: ".com" } }` |
| `AND`, `OR`, `NOT` | Compound | `{ OR: [{ a: 1 }, { b: 2 }] }` |

---

## Plugin Type Inference

Plugins also export their own types which are automatically merged into the main `Api` type.

```typescript
import { auth } from "nevr/plugins/auth"

const api = nevr({
  plugins: [auth()]
})

// Inferred type includes plugin methods
type AuthClient = Api["$Infer"]["Plugins"]["auth"]["client"]
// { login: (...), register: (...), ... }
```

### Auth Plugin Session Inference

```typescript
// Infer session type from auth plugin
type Session = typeof client.$Infer.Session
// { user: { id: string; email: string; ... }; expires: Date }

// Use in React components
function Profile() {
  const session = client.useSession.get()
  
  if (session.isPending) return <Loading />
  if (!session.data) return <LoginForm />
  
  // session.data.user is fully typed!
  return <div>Welcome, {session.data.user.name}</div>
}
```

---

## Advanced: Server Type Exports

### Complete Type Export Pattern

```typescript
// server/index.ts
import { nevr, entity, string, int } from "nevr"
import { auth } from "nevr/plugins/auth"

// Define entities
const user = entity("user", { name: string, email: string.email() })
const product = entity("product", { name: string, price: int })

// Create API
export const api = nevr({
  entities: [user, product],
  plugins: [auth()],
  driver: prisma(db),
})

// Export types for client consumption
export type Api = typeof api


```

### Client Setup with Full Inference

```typescript
// client/api.ts
import { createTypedClient, entityClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { Api } from "../server"


// Create fully typed client
export const client = createTypedClient<Api>({
  baseURL: process.env.API_URL,
  plugins: [
    entityClient({ entities: ["user", "product"] }),
    authClient(),
  ],
})

// Export typed client for use in app
export type Client = typeof client
```


---

## Type Inference Exports Reference

| Type | Import | Description |
|------|--------|-------------|
| `$Infer<T>` | `nevr` | Extract all types from server |
| `EntityOf<Api, Name>` | `nevr` | **DX Helper** - Get entity type by name |
| `EntityNamesOf<Api>` | `nevr` | **DX Helper** - Get all entity names as union |
| `EntitiesOf<Api>` | `nevr` | **DX Helper** - Get all entities as mapped type |
| `InferEntityData<E>` | `nevr` | Entity data type |
| `InferCreateInput<E>` | `nevr` | Create input (no id/timestamps) |
| `InferUpdateInput<E>` | `nevr` | Update input (all optional) |
| `InferEntity<S, Name>` | `nevr` | Get entity by name from server |
| `InferEndpoints<S>` | `nevr` | All endpoints from server |
| `InferErrorCodes<S>` | `nevr` | All error codes from server |
| `ListResponse<E>` | `nevr` | List response with pagination |
| `SingleResponse<E>` | `nevr` | Single entity response |
| `ApiResponse<T>` | `nevr` | Response wrapper with error |
| `EntityPaths<Name>` | `nevr` | CRUD paths for entity |
| `FieldTypeToTS<F>` | `nevr` | Map field type to TS type |

---

## Client Type Inference Exports

| Type | Import | Description |
|------|--------|-------------|
| `InferClientAPI<O>` | `nevr/client` | Infer API from client options |
| `InferActions<O>` | `nevr/client` | Infer actions from plugins |
| `InferAtoms<O>` | `nevr/client` | Infer reactive atoms |
| `InferErrorCodes<O>` | `nevr/client` | Infer error codes |
| `InferSessionFromClient<C>` | `nevr/client` | Infer session type |
| `InferUserFromClient<C>` | `nevr/client` | Infer user type |
| `EntityMethods<T>` | `nevr/client` | CRUD methods interface |
| `ListOptions<T>` | `nevr/client` | List query options |
| `EntityFilter<T>` | `nevr/client` | Typed filter |
| `EntitySort<T>` | `nevr/client` | Typed sort |
| `TypedClient<API>` | `nevr/client` | Full typed client |

---

## Best Practices

### 1. Export Only `Api` Type (Keep It Simple)

You only need to export the API type. Individual entity types are accessible via `$Infer`:

```typescript
// ✅ server.ts - Just export Api
export const api = nevr({ entities: [user, product, order] })
export type Api = typeof api

// ❌ Don't do this - it's redundant
export type User = Api["$Infer"]["Entities"]["user"]
export type Product = Api["$Infer"]["Entities"]["product"]
// ...repeating for every entity
```

### 2. Create a Shared `types.ts` (Optional)

If you need to use entity types frequently, create a central types file:

```typescript
// types.ts
import type { Api } from "./server"

// One-time extraction
type E = Api["$Infer"]["Entities"]

// Now export what you need
export type User = E["user"]
export type Product = E["product"]
export type Order = E["order"]
```

### 3. Use Type-Only Imports

Always use `import type` for server types to avoid bundling server code:

```typescript
// ✅ Correct - type-only import
import type { Api } from "./server"

// ❌ Wrong - may bundle server code
import { Api } from "./server"
```

### 4. Leverage Autocomplete

With `createTypedClient<Api>`, you get full autocomplete without explicit types:

```typescript
const client = createTypedClient<Api>({ ... })

// No need to type these - TypeScript infers everything
const { data: users } = await client.users.list()
//           ^? User[]

const { data: product } = await client.products.get("123")
//           ^? Product
```

---

## Summary: Minimal Export Pattern

The recommended pattern for best DX:

```typescript
// === server.ts ===
export const api = nevr({
  entities: [user, product, order],
  plugins: [auth()],
})

export type Api = typeof api  // That's it!
```

```typescript
// === client.ts ===
import { createTypedClient, entityClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { Api } from "./server"

const client = createTypedClient<Api>({
  baseURL: "/api",
  plugins: [entityClient({ entities: ["user", "product", "order"] }), authClient()],
})

// Everything is typed automatically!
const { data } = await client.users.create({ name: "John", email: "john@test.com" })

// Access types when needed
type User = Api["$Infer"]["Entities"]["user"]
```

---

## Next Steps

- [Client Overview](/client/overview) - Full client documentation
- [Entity Client](/client/entity-client) - CRUD methods
- [React Integration](/client/react) - React hooks and patterns
