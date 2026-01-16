# Auth Plugin

Self-contained authentication for Nevr. Supports email/password, OAuth providers, session management, and account linking.

## Why Use Auth Plugin?

| Challenge | Without Nevr | With Nevr Auth |
|-----------|--------------|----------------|
| Password hashing | Implement bcrypt/argon2 | Automatic PBKDF2 |
| Session tokens | Build token system | Secure sessions built-in |
| OAuth flow | PKCE, state, callbacks | One config object |
| Account security | Build from scratch | Fresh sessions, rate limits |

## Quick Start

```typescript
import { nevr } from "nevr"
import { auth } from "nevr/plugins/auth"

const api = nevr({
  entities: [post],
  driver: prisma(db),
  plugins: [
    auth({
      secret: process.env.AUTH_SECRET,  // Required
      baseURL: "http://localhost:3000",
      emailAndPassword: { enabled: true },
    }),
  ],
})
```

---

## Configuration Reference

### Core Options

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `secret` | `string` | `AUTH_SECRET` env | **Required.** Encryption key for tokens |
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
import { createTypedClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

const client = createTypedClient<API>({
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
