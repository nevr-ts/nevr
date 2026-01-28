# nevr()

Create and configure a Nevr API instance. This is the main entry point for your application.

## Signature

```typescript
function nevr<TEntities extends readonly Entity[]>(
  config: NevrConfig & { entities: TEntities }
): TypedNevrInstance<TEntities>
```

---

## defineConfig()  {#defineconfig}

Create a type-safe configuration object. This is the recommended way to define your config so it can be shared between the **CLI** (generate, db:push) and the **runtime** (server).

### Signature

```typescript
function defineConfig<const T extends NevrConfig>(config: T): T
```

The `const` generic preserves the exact tuple type of your entities, so type inference (like `$Infer`) works when you spread the config into `nevr()`.

### Usage

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { user } from "./entities/user.js"
import { post } from "./entities/post.js"

export const config = defineConfig({
  database: "sqlite",
  entities: [user, post],
  plugins: [],
})

export default config
```

Then in your server:

```typescript
// src/server.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })

// Full type inference works:
type User = typeof api.$Infer.Entities["user"]
```

::: tip Why defineConfig?
- **Single source of truth** — entities and plugins defined once, used by both CLI and runtime
- **Type preservation** — the `const` generic preserves entity tuple types through the spread
- **CLI compatibility** — `npx nevr generate` and `npx nevr db:push` auto-discover `nevr.config.ts`
:::

---

## NevrConfig

Full configuration options:

```typescript
interface NevrConfig {
  /** Entity definitions */
  entities: readonly Entity[]

  /** Database driver (runtime only — not needed in defineConfig) */
  driver: Driver

  /** Plugins to use */
  plugins?: readonly Plugin[]

  /** Database type (for CLI schema generation) */
  database?: "sqlite" | "postgresql" | "mysql"

  /** CORS configuration */
  cors?: CorsOptions

  /** Security settings */
  security?: SecurityOptions
  /**
   * Request context factory - adds custom fields to each request
   */
  context?: (req: NevrRequest) => Record<string, unknown> | Promise<Record<string, unknown>>
  /**
   *  Nevr context for isolated state management
   */
  nevrContext?: NevrContext

   /**
   * Entity routing options
   */
  entityRoutes?:  {
    pluralize?: ((entityName: string) => string) | undefined;
    disablePluralization?: boolean | undefined;
    routes?: Record<string, string> | undefined;
} | undefined

}
```

::: tip
 `defineConfig()`. The config file focuses on entities, plugins, and database type for schema generation.
 so always use `defineConfig()` to create your config object(`nevr.config.ts`), then spread it into `nevr()` at runtime to add the driver and any runtime-only options.
:::

---

## Configuration Options

### entities (required)

Array of entity definitions:

```typescript
import { entity, string, int } from "nevr"

const user = entity("user", {
  email: string.email().unique(),
  name: string,
})

const post = entity("post", {
  title: string,
  views: int.default(0),
})

const api = nevr({
  entities: [user, post],
  driver: prisma(db),
})
```

### driver (required)

Database driver instance:

```typescript
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const api = nevr({
  entities: [user],
  driver: prisma(new PrismaClient()),
})
```

### plugins

Array of plugins:

```typescript
import { auth } from "nevr/plugins/auth"

const api = nevr({
  entities: [post],
  driver: prisma(db),
  plugins: [
    auth({
      session: { expiresIn: "7d" },
      emailAndPassword: { enabled: true },
    }),
  ],
})
```


### cors

CORS configuration:

```typescript
const api = nevr({
  entities: [user],
  driver: prisma(db),
  cors: {
    origin: ["http://localhost:3000", "https://myapp.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
})
```

### security

Security options:

```typescript
const api = nevr({
  entities: [user],
  driver: prisma(db),
  security: {
    helmet: true,
  },
})
```



## NevrInstance Methods

### handleRequest()

Process an HTTP request:

```typescript
const response = await api.handleRequest({
  method: "GET",
  path: "/api/users",
  headers: { authorization: "Bearer token" },
  query: { take: "10" },
  body: null,
})
```

### getEntity()

Get an entity definition by name:

```typescript
const userEntity = api.getEntity("user")
console.log(userEntity.config.fields)
```

### getDriver()

Get the database driver:

```typescript
const driver = api.getDriver()
const users = await driver.findMany("user")
```

### registerService()

Register a service in the container:

```typescript
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY), {
  lifecycle: "singleton",
  tags: ["payments"],
})

api.registerService("mailer", (ctx) => {
  return new MailerService(ctx.resolve("smtp"))
})
```

### resolve() / resolveAsync()

Resolve a service:

```typescript
const stripe = api.resolve<Stripe>("stripe")
const db = await api.resolveAsync<Database>("database")
```

### hasService()

Check if service exists:

```typescript
if (api.hasService("stripe")) {
  const stripe = api.resolve("stripe")
}
```

### addRoute()

Add a custom route:

```typescript
api.addRoute({
  method: "GET",
  path: "/health",
  handler: async (ctx) => {
    return { status: "ok", timestamp: new Date() }
  },
})

api.addRoute({
  method: "POST",
  path: "/webhooks/stripe",
  handler: async (ctx) => {
    const event = ctx.body
    // Process webhook
    return { received: true }
  },
})
```

### addMiddleware()

Add middleware after initialization:

```typescript
api.addMiddleware({
  name: "custom-auth",
  fn: async (ctx, next) => {
    // Custom logic
    return next()
  },
})
```

### getRoutes()

Get all registered routes:

```typescript
const routes = api.getRoutes()
routes.forEach(route => {
  console.log(`${route.method} ${route.path}`)
})
```

### executeAction()

Execute an entity action programmatically:

```typescript
const result = await api.executeAction("post", "publish", {
  resourceId: "post_123",
  input: {},
  user: currentUser,
})
```

---

## Type Inference

Infer types from your API:

```typescript
const api = nevr({
  entities: [user, post, comment],
  driver: prisma(db),
})

// Infer entity types
type User = typeof api.$Infer.Entities["user"]
type Post = typeof api.$Infer.Entities["post"]

// Infer entity names
type EntityNames = typeof api.$Infer.EntityNames
// "user" | "post" | "comment"

// Use in functions
function getUser(id: string): Promise<User> {
  return api.getDriver().findOne("user", { id })
}
```

---

## Integration Examples

### Next.js

```typescript
import { toNextHandler } from "nevr/adapters/nextjs"
import { api } from "@/lib/nevr"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api)
```

### Express

```typescript
import express from "express"
import { expressAdapter } from "nevr/adapters/express"

const app = express()
app.use("/api", expressAdapter(api))
app.listen(3000)
```

### Hono

```typescript
import { Hono } from "hono"
import { honoAdapter} from "nevr/adapters/hono"

const app = new Hono()
app.route("/api", honoAdapter(api))
export default app
```



## Full Example 

Using `defineConfig` with the config spread pattern:

::: code-group

```typescript [src/nevr.config.ts]
import { defineConfig, entity, string, int, text, bool, belongsTo } from "nevr"
import { auth } from "nevr/plugins/auth"

const user = entity("user", {
  email: string.email().unique(),
  name: string.trim(),
  role: string.default("user"),
})

const post = entity("post", {
  title: string.min(3).max(200),
  content: text,
  published: bool.default(false),
  views: int.default(0),
  author: belongsTo(() => user),
})
  .ownedBy("author")
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner", "admin"],
    delete: ["owner", "admin"],
  })

export const config = defineConfig({
  database: "postgresql",
  entities: [user, post],
  plugins: [
    auth({
      session: { expiresIn: "7d" },
      emailAndPassword: { enabled: true },
    }),
  ],
})

export default config
```

```typescript [src/server.ts]
import express from "express"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter } from "nevr/adapters/express"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const api = nevr({
  ...config,
  driver: prisma(new PrismaClient()),
  cors: {
    origin: ["http://localhost:3000"],
    credentials: true,
  },
})

// Register services
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY))
api.registerService("mailer", () => new MailerService())

// Mount
const app = express()
app.use(express.json())
app.use("/api", expressAdapter(api))
app.listen(3000)
```

:::

## See Also

- [entity()](/reference/entity) - Entity definition
- [Fields](/reference/fields) - Field types
- [Actions](/reference/actions) - Action builder
- [Drivers](/database/drivers) - Database drivers
- [Plugins](/plugins/overview) - Plugin system
