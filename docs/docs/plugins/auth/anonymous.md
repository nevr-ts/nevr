# Anonymous Authentication

Guest user accounts with optional account linking.

## Installation

Add the anonymous plugin inside the auth plugin in your config:

```typescript
// nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { anonymous } from "nevr/plugins/auth/anonymous"

export const config = defineConfig({
  database: "sqlite",
  entities: [],
  plugins: [
    auth({
      plugins: [anonymous()],
    }),
  ],
})

export default config
```

Your server picks it up automatically with `nevr({ ...config, driver })`.

###  Generate and push or migrate the database

```bash
npx nevr generate    # Generates user + session tables
npx nevr db:push     # Push to database
# or
npx nevr db:migrate  # Create migration files
```

###  Client Setup

```typescript
import { createClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import { anonymousClient } from "nevr/plugins/auth/anonymous/client"
import type { API } from "./api"

const client = createClient<API>()({
  baseURL: "/api",
  plugins: [authClient(), anonymousClient()],
})
```

## Configuration

```typescript
anonymous({
  // Session expiration for anonymous users (default: 30 days)
  expiresIn: 30 * 24 * 60 * 60,

  // Allow linking to full account (default: true)
  allowLinking: true,
})
```

## Rate Limiting

Built-in rate limiting protects against abuse. Fully configurable:

```typescript
// Custom limits
anonymous({
  rateLimit: { window: 30000, max: 5 }, // 5 per 30s (stricter)
})

// Disable (use external limiter)
anonymous({
  rateLimit: false,
})
```

**Default:** 10 requests per 60 seconds

| Endpoint | Window | Max |
|----------|--------|-----|
| `/sign-in/anonymous` | 60s | 10 |

## Endpoints

### Create Anonymous User

```
POST /auth/sign-in/anonymous
```

**Request:**
```json
{}
```

**Response:**
```json
{
  "token": "session-token",
  "user": {
    "id": "anon_abc123",
    "isAnonymous": true,
    "createdAt": "..."
  }
}
```

### Link to Full Account

Convert anonymous user to a full account:

```
POST /auth/anonymous/link
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "anon_abc123",
    "email": "user@example.com",
    "isAnonymous": false
  }
}
```

## Client Usage

```typescript
import { createClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import { anonymousClient } from "nevr/plugins/auth/anonymous/client"
import type { API } from "./api"

// Use curried pattern for full type inference
const client = createClient<API>()({
  plugins: [authClient(), anonymousClient()],
})

// Create anonymous session (under auth.signIn namespace)
const { data } = await client.auth.signIn.anonymous()

// Later, link to full account (under auth.anonymous namespace)
await client.auth.anonymous.linkAccount({
  email: "user@example.com",
  password: "securepassword123",
  name: "John Doe",
})
```

## Use Cases

- Guest checkout in e-commerce
- Try-before-signup experiences
- Progressive onboarding
- Temporary user sessions

## Schema

The plugin adds:
- `isAnonymous` field to User (boolean)
- `anonymousId` field for tracking (optional)
