# Two-Factor Authentication

Multi-method 2FA: TOTP, OTP (email/SMS), and backup codes.

## Installation

Add the two-factor plugin inside the auth plugin in your config:

```typescript
// nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { twoFactor } from "nevr/plugins/auth/two-factor"

export const config = defineConfig({
  database: "sqlite",
  entities: [],
  plugins: [
    auth({
      plugins: [twoFactor()],
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
import { twoFactorClient } from "nevr/plugins/auth/two-factor/client"
import type { API } from "./api"

const client = createClient<API>()({
  baseURL: "/api",
  plugins: [authClient(), twoFactorClient()],
})
```

## Configuration

```typescript
twoFactor({
  // App name for authenticator
  issuer: "My App",

  // TOTP options
  totp: {
    digits: 6,        // 6 or 8
    period: 30,       // seconds
    window: 1,        // validation window
  },

  // Email/SMS OTP options
  otp: {
    expiresIn: 300,   // 5 minutes
    length: 6,
    sendOTP: async ({ email, code, userId }) => {
      await sendEmail({ to: email, code })
    },
  },

  // Backup codes
  backupCodes: {
    count: 10,
    length: 8,
  },

  // Rate limiting (default: 3/10s)
  rateLimit: { window: 10000, max: 3 },
  // Set to `false` to disable
})
```

## Endpoints

### Enable 2FA
```
POST /two-factor/enable
{ "password": "...", "issuer": "..." }
→ { "totpUri": "otpauth://...", "backupCodes": [...], "secret": "..." }
```

### Verify Setup
```
POST /two-factor/verify-setup
{ "code": "123456" }
→ { "success": true, "twoFactorEnabled": true }
```

### Disable 2FA
```
POST /two-factor/disable
{ "password": "..." }
→ { "success": true, "twoFactorEnabled": false }
```

### Verify TOTP (Sign-in)
```
POST /two-factor/verify-totp
{ "code": "123456" }
→ { "token": "...", "user": {...} }
```

### Get TOTP URI
```
POST /two-factor/get-totp-uri
{ "password": "..." }
→ { "totpUri": "otpauth://..." }
```

### Send OTP
```
POST /two-factor/send-otp
→ { "success": true }
```

### Verify OTP
```
POST /two-factor/verify-otp
{ "code": "123456" }
→ { "token": "...", "user": {...} }
```

### Verify Backup Code
```
POST /two-factor/verify-backup-code
{ "code": "ABCD1234" }
→ { "token": "...", "user": {...}, "remainingBackupCodes": 9 }
```

### Generate New Backup Codes
```
POST /two-factor/generate-backup-codes
{ "password": "..." }
→ { "backupCodes": [...] }
```

## Client Usage

```typescript
import { createClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import { twoFactorClient } from "nevr/plugins/auth/two-factor/client"
import type { API } from "./api"

// Use curried pattern for full type inference
const client = createClient<API>()({
  plugins: [authClient(), twoFactorClient()],
})

// Enable 2FA (under auth.twoFactor namespace)
const { data } = await client.auth.twoFactor.enable({ password: "..." })
// Show QR code for data.totpUri

// Verify setup
await client.auth.twoFactor.verifySetup({ code: "123456" })

// During sign-in (if twoFactorRedirect: true)
await client.auth.twoFactor.verifyTotp({ code: "123456" })
```

## Sign-in Flow

1. User signs in with email/password
2. If `twoFactorEnabled`, response: `{ twoFactorRedirect: true }`
3. Client prompts for TOTP/OTP/backup code
4. Call appropriate verify endpoint
5. Returns session token

## Rate Limiting

Default: 3 requests per 10 seconds on all `/two-factor/*` endpoints.

```typescript
twoFactor({
  rateLimit: { window: 5000, max: 2 }, // stricter
  // or: rateLimit: false, // disable
})
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_PASSWORD` | Wrong password |
| `TWO_FACTOR_NOT_ENABLED` | 2FA not set up |
| `INVALID_TOTP_CODE` | Wrong TOTP code |
| `INVALID_BACKUP_CODE` | Wrong backup code |
| `INVALID_CODE` | Invalid OTP |
| `OTP_EXPIRED` | OTP expired |
| `INVALID_TWO_FACTOR_COOKIE` | Session expired |
