# Auth Plugin

The Auth plugin provides a comprehensive authentication solution powered by **Better Auth**. It handles sessions, OAuth, email verification, and more, while letting Nevr manage the database schema.

## Usage

We recommend configuring the auth plugin in a separate file.

**`src/plugins/auth.ts`**
```typescript
import { auth } from "nevr/plugins/auth"

export const authPlugin = auth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: "http://localhost:3000",
  
  // Auth modes
  mode: "session", // or "jwt", "bearer"
  
  // Providers
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    }
  }
})
```

**`src/config.ts`**
```typescript
import { nevr } from "nevr"
import { authPlugin } from "./plugins/auth"

export const api = nevr({
  plugins: [
    authPlugin
  ]
})
```

## Schema

The plugin adds the following entities required by Better Auth:
- **session**: Active sessions
- **account**: OAuth accounts
- **verification**: Email/password tokens

It extends your `user` entity with:
- `email` (unique)
- `emailVerified`
- `image`

## Customization

You can extend the auth schema just like any other plugin.

```typescript
auth({
  extend: {
    entities: {
      user: {
        fields: {
          role: { add: { type: "string", default: "user" } }
        }
      }
    }
  }
})
```

## Routes

The plugin mounts all Better Auth routes under `/auth` (configurable via `basePath`).

- `POST /auth/sign-up`
- `POST /auth/sign-in`
- `POST /auth/sign-out`
- `GET /auth/session`
- ...and all other Better Auth endpoints.

## Access Control

You can use the `authenticated` rule in your entities to protect resources.

```typescript
export const post = entity("post", {
  title: string
}).rules({
  create: ["authenticated"],
  update: ["owner"],
  delete: ["admin"]
})
```

