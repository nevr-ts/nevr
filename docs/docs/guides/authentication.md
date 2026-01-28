# Authentication Guide

Implement authentication in your Nevr application.

## Using the Auth Plugin

The fastest way to add auth — add the plugin to your config:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { post } from "./entities/post.js"

export const config = defineConfig({
  database: "sqlite",
  entities: [post],
  plugins: [
    auth({
      session: { expiresIn: "7d" },
      emailAndPassword: { enabled: true },
    }),
  ],
})

export default config
```

Then your server picks it up:

```typescript
// src/server.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
```

This provides:
- User registration
- Email/password login
- Session management
- Protected routes

## Protecting Routes

### Entity-Level

```typescript
const post = entity("post", {
  title: string,
  author: belongsTo(() => user),
})
  .ownedBy("author")
  .rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner"],
    delete: ["owner", "admin"],
  })
```

### Action-Level

```typescript
.actions({
  publish: action()
    .onResource()
    .rules("owner")
    .handler(async (ctx) => {
      // ctx.user is guaranteed to exist
    }),
})
```

## Accessing Current User

In actions and hooks:

```typescript
.handler(async (ctx) => {
  const user = ctx.user
  // { id, email, name, role, ... }

  if (!user) {
    throw unauthorizedError("Login required")
  }
})
```

## Frontend Integration

### React

```tsx
import { useSession } from "@nevr/client/react"

function App() {
  const { user, isLoading } = useSession()

  if (isLoading) return <div>Loading...</div>

  return user ? <Dashboard /> : <LoginForm />
}
```

### Login Form

```tsx
function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await client.auth.signIn.email({ email, password })
    } catch (error) {
      alert(error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Sign In</button>
    </form>
  )
}
```

## Custom Auth Logic

### Custom Rules

```typescript
import { defineRule } from "nevr"

const premiumUser = defineRule("premium", async (ctx) => {
  if (!ctx.user) return false
  const sub = await ctx.driver.findOne("subscription", {
    where: { userId: ctx.user.id, status: "active" },
  })
  return sub?.plan === "premium"
})

const post = entity("post", { ... })
  .rules({
    create: [premiumUser],
  })
```

## OAuth Providers

```typescript
auth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
})
```

## Role-Based Access

```typescript
const user = entity("user", {
  email: string.email().unique(),
  role: string.default("user"), // "user" | "admin" | "moderator"
})

const admin = defineRule("admin", (ctx) => ctx.user?.role === "admin")
const moderator = defineRule("moderator", (ctx) =>
  ["admin", "moderator"].includes(ctx.user?.role)
)

const post = entity("post", { ... })
  .rules({
    delete: [admin],
    update: ["owner", moderator],
  })
```

## Next Steps

- [Auth Plugin](/plugins/auth)
- [Authorization Rules](/entities/authorization)
- [Field Access Policies](/fields/access-policies)
