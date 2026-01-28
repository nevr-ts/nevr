# Authentication

Nevr provides a built-in auth plugin that handles user authentication without any external dependencies.

## Quick Start

Add the auth plugin to your config:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"

export const config = defineConfig({
  database: "sqlite",
  entities: [],
  plugins: [
    auth({
      mode: "session",
      emailAndPassword: true,
    })
  ],
})

export default config
```

Then create your server:

```typescript
// src/server.ts
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
```

Set the secret in your environment:

```bash
AUTH_SECRET="your-random-secret-key"
```

## How It Works

1. **User signs up** → Creates user + session
2. **User signs in** → Creates new session
3. **Session cookie** → Sent with every request
4. **Middleware extracts** → `req.user` available in handlers
5. **Rules enforce** → Access control on entities

## Protecting Entities

Use the auth plugin with entity rules:

```typescript
import { entity, string, text, belongsTo } from "nevr"

const user = entity("user", {
  name: string,
  email: string.unique(),
})

const post = entity("post", {
  title: string,
  body: text,
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

## Built-in Rules

| Rule | Meaning |
|------|---------|
| `everyone` | Public access |
| `authenticated` | Must be logged in |
| `owner` | Must own the resource |
| `admin` | Must have admin role |

## Custom Rules

Create custom authorization logic:

```typescript
const premiumOnly = (ctx) => {
  return ctx.user?.subscription === "premium"
}

const post = entity("post", { ... })
  .rules({
    create: [premiumOnly],
  })
```

## API Endpoints

The auth plugin adds these routes:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/sign-up` | Create account |
| POST | `/api/auth/sign-in` | Sign in |
| POST | `/api/auth/sign-out` | Sign out |
| GET | `/api/auth/session` | Get current session |

## Frontend Usage

```typescript
// Sign up
await fetch("/api/auth/sign-up", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123",
    name: "John Doe"
  })
})

// Sign in
await fetch("/api/auth/sign-in", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123"
  })
})

// Check session
const { user, session } = await fetch("/api/auth/session", {
  credentials: "include"
}).then(r => r.json())

if (user) {
  console.log("Logged in as:", user.email)
}

// Sign out
await fetch("/api/auth/sign-out", {
  method: "POST",
  credentials: "include"
})
```

## Configuration Options

```typescript
auth({
  // Required (or use AUTH_SECRET env)
  secret: "your-secret",

  // Auth mode: "session" | "bearer"
  mode: "session",

  // Enable email/password auth
  emailAndPassword: true,

  // Session settings
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieName: "nevr.session_token",
  },

  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: false,
    requireNumbers: false,
  }
})
```

## Bearer Token Mode

For mobile apps or API-only clients:

```typescript
auth({ mode: "bearer" })
```

Sign in returns a token:

```json
{
  "user": { "id": "abc", "email": "..." },
  "token": "eyJhbGc..."
}
```

Use in requests:

```typescript
fetch("/api/posts", {
  headers: {
    "Authorization": "Bearer eyJhbGc..."
  }
})
```

## No Auth Plugin?

If you don't need the auth plugin, you can still use header-based auth for development:

```typescript
import { expressAdapter, expressDevAuth } from "nevr/adapters/express"

app.use("/api", expressAdapter(api, {
  getUser: expressDevAuth // Uses X-User-Id header
}))
```

Or implement your own:

```typescript
app.use("/api", expressAdapter(api, {
  getUser: async (req) => {
    const token = req.headers.authorization?.replace("Bearer ", "")
    if (!token) return null
    // Your verification logic
    return { id: "user-id", role: "user" }
  }
}))
```
