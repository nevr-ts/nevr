# nevr()

Create and configure a Nevr API instance. This is the main entry point for your application.

## Signature

```typescript
function nevr<TEntities extends Entity[]>(
  config: NevrConfig<TEntities>
): NevrInstance<TEntities>
```

---

## NevrConfig

Full configuration options:

```typescript
interface NevrConfig<TEntities> {
  /** Entity definitions */
  entities: TEntities

  /** Database driver */
  driver: Driver

  /** Plugins to use */
  plugins?: Plugin[]

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

```typescript
import { nevr, entity, string, int, text, belongsTo } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { auth } from "nevr/plugins/auth"
import { PrismaClient } from "@prisma/client"

// Define entities
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

// Create API
const api = nevr({
  entities: [user, post],
  driver: prisma(new PrismaClient()),
  plugins: [
    auth({
      session: { expiresIn: "7d" },
      emailAndPassword: { enabled: true },
    }),
  ],
  cors: {
    origin: ["http://localhost:3000"],
    credentials: true,
  },
})

// Register services
api.registerService("stripe", () => new Stripe(process.env.STRIPE_KEY))
api.registerService("mailer", () => new MailerService())

// Export for adapter
export { api }
```

---

## See Also

- [entity()](/reference/entity) - Entity definition
- [Fields](/reference/fields) - Field types
- [Actions](/reference/actions) - Action builder
- [Drivers](/database/drivers) - Database drivers
- [Plugins](/plugins/overview) - Plugin system
