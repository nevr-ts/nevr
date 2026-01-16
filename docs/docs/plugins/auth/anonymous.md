# Anonymous Authentication

Guest user accounts with optional account linking.

## Installation

```typescript
import { auth } from "nevr/plugins/auth"
import { anonymous } from "nevr/plugins/auth/plugins/anonymous"

const api = nevr({
  plugins: [
    auth({
      plugins: [anonymous()],
    }),
  ],
})
```

## Configuration

```typescript
anonymous({
  // Session expiration for anonymous users (default: 30 days)
  expiresIn: 30 * 24 * 60 * 60,

  // Allow linking to full account (default: true)
  allowLinking: true,

  // Rate limit anonymous user creation
  rateLimit: {
    maxPerHour: 100,
    maxPerDay: 1000,
  },
})
```

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
import { anonymousClient } from "nevr/plugins/auth/plugins/anonymous/client"

const client = createClient({
  plugins: [authClient(), anonymousClient()],
})

// Create anonymous session
const { data } = await client.auth.signInAnonymous()

// Later, link to full account
await client.anonymous.linkAccount({
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
