# Auth Plugin

The Auth Plugin provides a complete authentication and user management system for Nevr applications. It includes features like email/password sign-up and sign-in, session management, OAuth social logins, password reset, email verification, account linking, and more.

## Why Use Auth Plugin?

| Challenge | Without Nevr | With Nevr Auth |
|-----------|--------------|----------------|
| Password hashing | Implement bcrypt/argon2 | Automatic PBKDF2 |
| Session tokens | Build token system | Secure sessions built-in |
| OAuth flow | PKCE, state, callbacks | One config object |
| Account security | Build from scratch | Fresh sessions, rate limits |

## Installation


###  Set your secret

Generate a high-entropy secret (minimum 32 characters):

```bash
# Generate a secure secret
openssl rand -base64 32
```

Add it to your `.env` file:

```bash
NEVR_AUTH_SECRET="paste-your-generated-secret-here"
```

::: warning Security
The secret must be at least **32 characters**. It's used for HMAC-SHA256 signing of sessions and tokens. Never commit it to version control.
:::

###  Add the auth plugin

```typescript
// nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"

export const config = defineConfig({
  database: "sqlite",
  entities: [],
  plugins: [
    auth({
      emailAndPassword: { enabled: true },
    }),
  ],
})

export default config
```

The plugin reads `NEVR_AUTH_SECRET` (or `AUTH_SECRET`) from your environment automatically — no need to pass `secret` in the options.

###  Create the server with `getUser`

The auth plugin creates sessions in the database. To resolve the authenticated user on each request, pass `sessionAuth()` as the `getUser` callback in your adapter.

::: code-group

```typescript [Express]
// src/server.ts
import "dotenv/config"
import express from "express"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter, sessionAuth } from "nevr/adapters/express"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = express()
app.use(express.json())
app.use("/api", expressAdapter(api, {
  getUser: sessionAuth(driver),
}))

app.listen(3000)
```

```typescript [Hono]
// src/server.ts
import "dotenv/config"
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { PrismaClient } from "@prisma/client"
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { honoAdapter, sessionAuth } from "nevr/adapters/hono"
import { config } from "./nevr.config.js"

const db = new PrismaClient()
const driver = prisma(db)

const api = nevr({ ...config, driver })

const app = new Hono()
app.route("/api", honoAdapter(api, {
  getUser: sessionAuth(driver),
}))

serve({ fetch: app.fetch, port: 3000 })
```

```typescript [Next.js — lib/nevr.ts]
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { nextCookies } from "nevr/adapters/nextjs"
import { config } from "./nevr.config"

const db = new PrismaClient()
const driver = prisma(db)

export const api = nevr({
  ...config,
  driver,
  plugins: [...(config.plugins ?? []), nextCookies()],
})
```

```typescript [Next.js — route.ts]
// app/api/[...nevr]/route.ts
import { toNextHandler, sessionAuth } from "nevr/adapters/nextjs"
import { api } from "@/lib/nevr"

export const { GET, POST, PUT, PATCH, DELETE } = toNextHandler(api, {
  getUser: sessionAuth(api),
})
```

:::

`sessionAuth()` reads the `nevr.session_token` cookie (or `Authorization: Bearer` header), finds the session in the database, validates expiry, and returns the user. Without it, `req.user` is always `null` and rules like `"authenticated"` or `"owner"` will deny access.

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
import type { API } from "./api"

const client = createClient<API>()({
  baseURL: "/api",
  plugins: [authClient()],
})
```
---

## Configuration Reference

### Core Options

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `secret` | `string` | `NEVR_AUTH_SECRET` or `AUTH_SECRET` env | **Required.** Min 32 chars. Signing key for tokens/sessions. Auto-reads from env. |
| `baseURL` | `string` | - | Base URL for OAuth callbacks |

### Email & Password

```typescript
auth({
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: false,
    disableSignUp: false,
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: false,
    sendResetPassword: async ({ user, url, token }) => {
      await sendEmail(user.email, `Reset: ${url}`)
    },
    onPasswordReset: async ({ user }) => {
      console.log(`${user.email} reset password`)
    },
  },
})
```

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `enabled` | `boolean` | `true` | Enable email/password auth |
| `minPasswordLength` | `number` | `8` | Minimum password characters |
| `maxPasswordLength` | `number` | `128` | Maximum password characters |
| `autoSignIn` | `boolean` | `true` | Auto-signin after signup |
| `requireEmailVerification` | `boolean` | `false` | Block signin until verified |
| `disableSignUp` | `boolean` | `false` | Disable new registrations |
| `resetPasswordTokenExpiresIn` | `number` | `3600` | Reset token TTL (seconds) |
| `revokeSessionsOnPasswordReset` | `boolean` | `false` | Logout all on password change |
| `sendResetPassword` | `function` | - | Custom reset email sender |
| `onPasswordReset` | `function` | - | Post-reset callback |

### Session Options

```typescript
auth({
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 days
    updateAge: 60 * 60 * 24,      // Refresh after 1 day
    freshAge: 300,                // 5 min for sensitive ops
    cookieName: "nevr.session_token",
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      domain: undefined,
    },
  },
})
```

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `expiresIn` | `number` | `604800` (7d) | Session TTL in seconds |
| `updateAge` | `number` | `86400` (1d) | Refresh threshold in seconds |
| `freshAge` | `number` | - | "Fresh" session window for sensitive ops |
| `cookieName` | `string` | `nevr.session_token` | Session cookie name |
| `cookie.secure` | `boolean` | `true` in prod | HTTPS only |
| `cookie.httpOnly` | `boolean` | `true` | No JS access |
| `cookie.sameSite` | `string` | `lax` | CSRF protection |
| `cookie.path` | `string` | `/` | Cookie path |
| `cookie.domain` | `string` | - | Cookie domain |

### Email Verification

```typescript
auth({
  emailVerification: {
    enabled: true,
    expiresIn: 3600,
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      await sendEmail(user.email, `Verify: ${url}`)
    },
    onEmailVerification: async (user) => {
      console.log(`${user.email} verified`)
    },
  },
})
```

### Password Hashing

```typescript
auth({
  password: {
    cost: 100000,  // PBKDF2 iterations
    hash: async (password, cost) => customHash(password),
    verify: async (password, hash) => customVerify(password, hash),
  },
})
```

### OAuth Providers

```typescript
auth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      scope: ["email", "profile"],
      accessType: "offline",  // Get refresh token
      hd: "company.com",      // Restrict to domain
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      scope: ["user:email"],
      allowSignup: true,
    },
    apple: {
      clientId: process.env.APPLE_SERVICE_ID,
      clientSecret: process.env.APPLE_SECRET,
      appBundleIdentifier: "com.yourapp",
    },
  },
})
```

### Account Linking

```typescript
auth({
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],  // Auto-link these providers
      allowDifferentEmails: false,
    },
  },
})
```

### Extending User Schema

```typescript
auth({
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true, returned: true },
      role: { type: "string", required: false, input: false, returned: true },
      premium: { type: "boolean", required: false, input: false, returned: true },
    },
  },
})
```

---

## Generated Entities

### User

| Field | Type | Description |
|:------|:-----|:------------|
| `id` | `string` | UUID |
| `email` | `string` | Unique, lowercase, trimmed |
| `name` | `string` | Display name |
| `emailVerified` | `boolean` | Verification status |
| `image` | `string?` | Avatar URL |
| `createdAt` | `Date` | Creation timestamp |
| `updatedAt` | `Date` | Last update |

### Session

| Field | Type | Description |
|:------|:-----|:------------|
| `id` | `string` | UUID |
| `token` | `string` | Secure session token (hidden) |
| `userId` | `string` | User reference |
| `expiresAt` | `Date` | Expiration time |
| `ipAddress` | `string?` | Client IP |
| `userAgent` | `string?` | Browser info |
| `createdAt` | `Date` | Creation time |

### Account

| Field | Type | Description |
|:------|:-----|:------------|
| `id` | `string` | UUID |
| `userId` | `string` | User reference |
| `providerId` | `string` | `"credential"`, `"google"`, `"github"`, etc. |
| `accountId` | `string` | Provider user ID |
| `password` | `string?` | Hashed password (credential only) |
| `accessToken` | `string?` | OAuth access token (hidden) |
| `refreshToken` | `string?` | OAuth refresh token (hidden) |
| `expiresAt` | `Date?` | Token expiration |
| `scope` | `string?` | Granted scopes |

### Verification

| Field | Type | Description |
|:------|:-----|:------------|
| `id` | `string` | UUID |
| `identifier` | `string` | Purpose (email, password-reset) |
| `value` | `string` | Token value (hidden) |
| `expiresAt` | `Date` | Token expiration |

---

## API Endpoints

### Authentication

| Method | Path | Description |
|:-------|:-----|:------------|
| `POST` | `/auth/sign-up/email` | Create account with email/password |
| `POST` | `/auth/sign-in/email` | Sign in with email/password |
| `POST` | `/auth/sign-out` | Sign out (clear session) |

### Session Management

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/auth/session` | Get current session + user |
| `GET` | `/auth/list-sessions` | List all user sessions |
| `POST` | `/auth/revoke-session` | Revoke specific session |
| `POST` | `/auth/revoke-sessions` | Revoke all sessions |
| `POST` | `/auth/revoke-other-sessions` | Revoke all except current |

### Email Verification

| Method | Path | Description |
|:-------|:-----|:------------|
| `POST` | `/auth/send-verification-email` | Send verification email |
| `GET` | `/auth/verify-email` | Verify email token |

### Password Reset

| Method | Path | Description |
|:-------|:-----|:------------|
| `POST` | `/auth/request-password-reset` | Request reset email |
| `GET` | `/auth/reset-password/callback` | Verify reset token |
| `POST` | `/auth/reset-password` | Set new password |

### User Management

| Method | Path | Description |
|:-------|:-----|:------------|
| `POST` | `/auth/update-user` | Update name, image, etc. |
| `POST` | `/auth/change-password` | Change password (requires current) |
| `POST` | `/auth/change-email` | Change email (sends verification) |
| `POST` | `/auth/delete-user` | Delete account permanently |

### Account Management

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/auth/list-accounts` | List linked providers |
| `POST` | `/auth/unlink-account` | Unlink a provider |

### OAuth

| Method | Path | Description |
|:-------|:-----|:------------|
| `POST` | `/auth/sign-in/:provider` | Start OAuth flow |
| `GET` | `/auth/callback/:provider` | Handle OAuth callback |
| `POST` | `/auth/link-social` | Link OAuth to existing account |

---

## Client Methods

```typescript
import { createClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

// Use curried pattern for full type inference
const client = createClient<API>()({
  baseURL: "http://localhost:3000",
  basePath: "/api",
  plugins: [authClient()],
})

// Authentication
await client.auth.signUp.email({ email, password, name })
await client.auth.signIn.email({ email, password })
await client.auth.signOut()

// Session
const { user, session } = await client.auth.getSession()
const sessions = await client.auth.listSessions()
await client.auth.revokeSession({ token })
await client.auth.revokeOtherSessions()

// Profile
await client.auth.updateUser({ name: "New Name" })
await client.auth.changePassword({ currentPassword, newPassword })
await client.auth.changeEmail({ newEmail })
await client.auth.deleteUser({ password })

// Accounts
const { accounts } = await client.auth.listAccounts()
await client.auth.unlinkAccount({ providerId: "google" })

// OAuth
const { url } = await client.auth.signIn.social({ provider: "google" })
await client.auth.linkSocial({ providerId: "github" })
```

---

## Hooks

Register callbacks for auth events:

```typescript
import { registerAuthHooks } from "nevr/plugins/auth"

registerAuthHooks({
  beforeCreateUser: async (data) => {
    data.role = "member"
    return data
  },
  afterCreateUser: async (user) => {
    await sendWelcomeEmail(user.email)
  },
  beforeSignIn: async (email) => {
    // Rate limiting, etc.
  },
  afterSignIn: async (user, session) => {
    await logSignIn(user.id, session.ipAddress)
  },
  beforeCreateSession: async (userId) => {},
  afterCreateSession: async (session) => {},
  beforeSignOut: async (userId) => {},
  afterSignOut: async (userId) => {},
  afterEmailVerified: async (user) => {},
})
```

---

## Error Codes

| Code | Message |
|:-----|:--------|
| `USER_ALREADY_EXISTS` | Email already registered |
| `INVALID_EMAIL` | Invalid email format |
| `PASSWORD_TOO_SHORT` | Password below minimum length |
| `PASSWORD_TOO_LONG` | Password above maximum length |
| `INVALID_EMAIL_OR_PASSWORD` | Wrong credentials |
| `EMAIL_NOT_VERIFIED` | Email verification required |
| `ACCOUNT_NOT_FOUND` | No account found |
| `CREDENTIAL_ACCOUNT_NOT_FOUND` | No password set |
| `SESSION_NOT_FOUND` | Invalid session |
| `SESSION_EXPIRED` | Session has expired |
| `SESSION_NOT_FRESH` | Session too old for sensitive op |
| `VERIFICATION_TOKEN_EXPIRED` | Token has expired |
| `INVALID_VERIFICATION_TOKEN` | Invalid token |
| `UNAUTHORIZED` | Not authenticated |
| `FORBIDDEN` | Not authorized |

---

## Rate Limiting

Built-in rate limiting protects against brute-force and credential stuffing attacks. Fully configurable per endpoint type.

### Configuration

```typescript
auth({
  // Default rate limiting (enabled by default)
  rateLimit: {
    signIn: { window: 60000, max: 10 },      // 10/min
    signUp: { window: 60000, max: 10 },      // 10/min
    passwordReset: { window: 60000, max: 5 }, // 5/min
    emailVerification: { window: 60000, max: 5 },
  },
})

// Stricter limits for high-security apps
auth({
  rateLimit: {
    signIn: { window: 60000, max: 5 },       // 5/min
    signUp: { window: 300000, max: 3 },      // 3/5min
    passwordReset: { window: 60000, max: 3 },
  },
})

// Disable rate limiting (use external WAF/Cloudflare)
auth({
  rateLimit: false,
})
```

### Default Limits

| Endpoint Type | Window | Max Requests |
|:--------------|:-------|:-------------|
| `signIn` | 60s | 10 |
| `signUp` | 60s | 10 |
| `passwordReset` | 60s | 5 |
| `emailVerification` | 60s | 5 |

---

## Security Features

- **PKCE** for OAuth (RFC 7636)
- **AES-256-GCM** encrypted state
- **PBKDF2** password hashing (100k iterations)
- **Fresh sessions** for sensitive operations
- **Automatic token expiry** (10 min for OAuth state)
- **Session binding** to IP/User-Agent

---

## Auth Sub-Plugins

Extend authentication with additional capabilities:

- [Magic Link](/plugins/auth/magic-link) - Passwordless email authentication
- [Two Factor](/plugins/auth/two-factor) - TOTP-based 2FA with backup codes
- [Phone Number](/plugins/auth/phone-number) - SMS-based OTP authentication
- [Anonymous](/plugins/auth/anonymous) - Guest users with account linking

## Related Plugins

- [Organization Plugin](/plugins/organization) - Multi-tenant teams and roles
- [Payment Plugin](/plugins/payment) - Subscription billing with Stripe
- [Storage Plugin](/plugins/storage) - S3-compatible file storage

## Other Auth Guides
- [Email & Password](/plugins/auth/email-password)
- [Session Management](/plugins/auth/sessions)