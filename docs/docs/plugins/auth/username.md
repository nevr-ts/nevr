# Username Authentication

Username-based authentication with case-insensitive sign-in.

## Installation

```typescript
import { auth } from "nevr/plugins/auth"
import { username } from "nevr/plugins/auth/plugins/username"

const api = nevr({
  plugins: [
    auth({
      plugins: [username()],
    }),
  ],
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
import { usernameClient } from "nevr/plugins/auth/plugins/username/client"

const client = createTypedClient<API>({
  plugins: [authClient(), usernameClient()],
})

// Sign in with username
const { data } = await client.signIn.username({
  username: "johndoe",
  password: "password123",
})

// Check username availability
const { data } = await client.isUsernameAvailable({ username: "newuser" })
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
