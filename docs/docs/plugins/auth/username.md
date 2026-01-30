# Username Authentication

Username-based authentication with case-insensitive sign-in.

## Installation

###  Add the username plugin inside the auth plugin in your config:

```typescript
//nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { username } from "nevr/plugins/auth/username"

export const config = defineConfig({
  database: "sqlite",
  entities: [],
  plugins: [
    auth({
      plugins: [username()],
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
import { usernameClient } from "nevr/plugins/auth/username/client"
import type { API } from "./api"

const client = createClient<API>()({
  baseURL: "/api",
  plugins: [authClient(), usernameClient()],
})
```
## Configuration

```typescript
username({
  // Minimum username length (default: 3)
  minUsernameLength: 3,

  // Maximum username length (default: 30)
  maxUsernameLength: 30,

  // Custom username validator
  usernameValidator: (username) => /^[a-zA-Z0-9_]+$/.test(username),

  // Custom display username validator
  displayUsernameValidator: (displayUsername) => displayUsername.length > 0,

  // Username normalization (default: toLowerCase)
  usernameNormalization: (username) => username.toLowerCase(),
  // Set to `false` to disable normalization

  // Display username normalization (default: no normalization)
  displayUsernameNormalization: false,

  // Validation order
  validationOrder: {
    username: "pre-normalization",      // or "post-normalization"
    displayUsername: "pre-normalization",
  },

  // Require email verification for sign-in
  requireEmailVerification: false,

  // Rate limiting (default: 10/min)
  rateLimit: { window: 60000, max: 10 },
  // Set to `false` to disable
})
```

## Endpoints

### Sign In with Username

```
POST /auth/sign-in/username
```

**Request:**
```json
{
  "username": "johndoe",
  "password": "password123",
  "rememberMe": true
}
```

**Response:**
```json
{
  "token": "session-token",
  "user": {
    "id": "...",
    "email": "john@example.com",
    "username": "johndoe",
    "displayUsername": "JohnDoe"
  }
}
```

### Check Username Availability

```
POST /auth/is-username-available
```

**Request:**
```json
{
  "username": "newuser"
}
```

**Response:**
```json
{
  "available": true
}
```

## Client Usage

```typescript
import { createClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import { usernameClient } from "nevr/plugins/auth/username/client"
import type { API } from "./api"

// Use curried pattern for full type inference
const client = createClient<API>()({
  plugins: [authClient(), usernameClient()],
})

//add username during sign-up
const { data } = await client.auth.signUp.email({
  email: "john@example.com",
  password: "password123",
  username: "johndoe",
  displayUsername: "JohnDoe",
})

// Sign in with username (under auth namespace)
const { data } = await client.auth.signIn.username({
  username: "johndoe",
  password: "password123",
})

// Check username availability
const { data } = await client.auth.isUsernameAvailable({ username: "newuser" })
console.log(data.available) // true or false
```

## Schema

The plugin extends the User entity with:

| Field | Type | Description |
|-------|------|-------------|
| `username` | `string` | Unique, normalized (lowercase), indexed |
| `displayUsername` | `string` | Original casing preserved |

## Rate Limiting

Built-in rate limiting protects against brute-force attacks. Fully configurable:

```typescript
// Custom limits
username({
  rateLimit: { window: 30000, max: 5 }, // 5 per 30s (stricter)
})

// Disable (use external limiter)
username({
  rateLimit: false,
})
```

**Default:** 10 requests per 60 seconds

| Endpoints | Window | Max |
|-----------|--------|-----|
| `/sign-in/username`, `/is-username-available` | 60s | 10 |

## Username vs Display Username

- **username**: Normalized (lowercase), used for lookups, must be unique
- **displayUsername**: Original casing preserved, shown to users

Example: User registers as "JohnDoe" → `username: "johndoe"`, `displayUsername: "JohnDoe"`

## Error Codes

| Code | Message |
|------|---------|
| `INVALID_USERNAME_OR_PASSWORD` | Invalid credentials |
| `EMAIL_NOT_VERIFIED` | Email verification required |
| `USERNAME_IS_ALREADY_TAKEN` | Username taken |
| `USERNAME_TOO_SHORT` | Below min length |
| `USERNAME_TOO_LONG` | Above max length |
| `INVALID_USERNAME` | Failed validation |
| `INVALID_DISPLAY_USERNAME` | Display username invalid |
