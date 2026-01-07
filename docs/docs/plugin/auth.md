# Auth Plugin

The Auth plugin provides **self-contained authentication** for Nevr. No external dependencies required.

## Installation

The auth plugin is included with Nevr:

```bash
npm install nevr
```

## Quick Start

```typescript
import { nevr } from "nevr"
import { auth } from "nevr/plugins/auth"
import { prisma } from "nevr/drivers/prisma"

const api = nevr({
  entities: [],
  driver: prisma(db),
  plugins: [
    auth({
      mode: "session",
      emailAndPassword: true,
    })
  ]
})
```

## Configuration

### Environment Variables

```bash
# Required
AUTH_SECRET="your-secret-key-here"

# Optional
AUTH_URL="http://localhost:3000"
```

### Options

```typescript
auth({
  // Secret for signing tokens (or use AUTH_SECRET env)
  secret: process.env.AUTH_SECRET,

  // Base URL for callbacks
  baseURL: "http://localhost:3000",

  // Auth mode
  mode: "session",  // "session" | "bearer"

  // Enable email/password authentication
  emailAndPassword: true,

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 days
    cookieName: "nevr.session_token",
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    }
  },

  // Password requirements
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: false,
    requireNumbers: false,
  }
})
```

## Entities Created

The auth plugin creates these entities automatically:

### `user`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| email | string | User email (unique) |
| password | string | Hashed password |
| name | string? | Display name |
| image | string? | Profile image URL |
| emailVerified | boolean | Email verified status |
| createdAt | datetime | Account creation time |
| updatedAt | datetime | Last update time |

### `session`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Session identifier |
| token | string | Session token |
| userId | string | Reference to user |
| expiresAt | datetime | Expiration time |
| ipAddress | string? | Client IP address |
| userAgent | string? | Browser user agent |

## API Endpoints

All routes are mounted under `/api/auth/*`:

### Sign Up

```http
POST /api/auth/sign-up
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "id": "sess_123",
    "expiresAt": "2024-01-07T00:00:00.000Z"
  }
}
```

### Sign In

```http
POST /api/auth/sign-in
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Sign Out

```http
POST /api/auth/sign-out
```

### Get Session

```http
GET /api/auth/session
```

Returns the current user and session, or `null` if not authenticated.

## Using Auth in Entities

The auth plugin automatically extracts the user from sessions and populates `req.user`.

### Protect Routes

```typescript
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

### Built-in Rules

| Rule | Description |
|------|-------------|
| `everyone` | Anyone can access |
| `authenticated` | Logged-in users only |
| `owner` | Resource owner only |
| `admin` | Users with role "admin" |

## Auth Modes

### Session Mode (Default)

Uses HTTP-only cookies for secure session storage:

```typescript
auth({ mode: "session" })
```

- Sessions stored in database
- Cookie automatically set on sign-in
- Best for web applications

### Bearer Mode

Uses bearer tokens in Authorization header:

```typescript
auth({ mode: "bearer" })
```

- Token returned in response body
- Client sends `Authorization: Bearer <token>`
- Best for mobile/API clients

## Frontend Integration

### With Cookies (Session Mode)

```typescript
// Sign in
const res = await fetch("/api/auth/sign-in", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // Important!
  body: JSON.stringify({ email, password })
})

// Get session
const session = await fetch("/api/auth/session", {
  credentials: "include"
}).then(r => r.json())
```

### With Bearer Token

```typescript
// Sign in
const { token } = await fetch("/api/auth/sign-in", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
}).then(r => r.json())

// Store token
localStorage.setItem("token", token)

// Use in requests
fetch("/api/posts", {
  headers: {
    "Authorization": `Bearer ${token}`
  }
})
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_EMAIL` | 400 | Email format invalid |
| `PASSWORD_REQUIRED` | 400 | Password missing |
| `PASSWORD_TOO_WEAK` | 400 | Password doesn't meet requirements |
| `EMAIL_ALREADY_EXISTS` | 409 | Email already registered |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `SESSION_NOT_FOUND` | 401 | Session expired or invalid |

## Security

The auth plugin includes these security features:

- **Password hashing**: Uses scrypt by default
- **Session tokens**: Cryptographically secure random tokens
- **HTTP-only cookies**: Prevents XSS attacks (session mode)
- **IP tracking**: Logs IP address for audit
- **Automatic expiration**: Sessions expire after configured time
