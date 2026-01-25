# Magic Link Authentication

Passwordless authentication via email magic links.

## Installation

The magic-link plugin is included with the auth plugin.

```typescript
import { auth } from "nevr/plugins/auth"
import { magicLink } from "nevr/plugins/auth/plugins/magic-link"

const api = nevr({
  plugins: [
    auth({
      plugins: [
        magicLink({
          sendMagicLink: async ({ email, url, token }) => {
            await sendEmail(email, `Sign in: ${url}`)
          },
        }),
      ],
    }),
  ],
})
```

## Configuration

```typescript
magicLink({
  // Required: Send the magic link email
  sendMagicLink: async ({ email, url, token }) => {
    await emailService.send({
      to: email,
      subject: "Sign in to Your App",
      html: `<a href="${url}">Click to sign in</a>`,
    })
  },

  // Optional: Link expiration (default: 5 minutes)
  expiresIn: 300,

  // Optional: Auto-create user if not exists (default: true)
  allowSignUp: true,

  // Optional: Callback URL after verification
  callbackURL: "/dashboard",
})
```

## Endpoints

### Send Magic Link

```
POST /auth/magic-link/send
```

**Request:**
```json
{
  "email": "user@example.com",
  "callbackURL": "/dashboard"
}
```

**Response:**
```json
{
  "success": true
}
```

### Verify Magic Link

```
GET /auth/magic-link/verify?token=xxx&callbackURL=/dashboard
```

**Response:**
Redirects to callback URL with session cookie set.

## Client Usage

```typescript
import { createTypedClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import { magicLinkClient } from "nevr/plugins/auth/plugins/magic-link/client"

const client = createTypedClient<API>({
  baseURL: "/api",
  plugins: [authClient(), magicLinkClient()],
})

// Send magic link
await client.auth.sendMagicLink({
  email: "user@example.com",
})

// User clicks link in email -> automatically verified
```

## Security

- Tokens are single-use and expire after configured time
- Links are cryptographically signed

## Rate Limiting

Built-in rate limiting protects against abuse. Fully configurable:

```typescript
// Custom limits
magicLink({
  sendMagicLink: async ({ email, url }) => {...},
  rateLimit: { window: 60000, max: 3 }, // 3/min (stricter)
})

// Disable (use external limiter)
magicLink({
  sendMagicLink: async ({ email, url }) => {...},
  rateLimit: false,
})
```

**Default:** 5 requests per 60 seconds

| Endpoints | Window | Max |
|-----------|--------|-----|
| `/sign-in/magic-link`, `/magic-link/verify` | 60s | 5 |

