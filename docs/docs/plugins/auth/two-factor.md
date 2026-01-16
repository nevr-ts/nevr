# Two-Factor Authentication

TOTP, OTP, and backup codes for enhanced security.

## Installation

```typescript
import { auth } from "nevr/plugins/auth"
import { twoFactor } from "nevr/plugins/auth/plugins/two-factor"

const api = nevr({
  plugins: [
    auth({
      plugins: [
        twoFactor({
          issuer: "My App",
        }),
      ],
    }),
  ],
})
```

## Configuration

```typescript
twoFactor({
  // App name for authenticator apps
  issuer: "My App",

  // TOTP options
  totp: {
    digits: 6,        // Code length
    period: 30,       // Seconds per code
    window: 1,        // Validation window
  },

  // Email OTP options (optional)
  otp: {
    expiresIn: 300,   // 5 minutes
    length: 6,
    sendOTP: async ({ email, code, userId }) => {
      await sendEmail(email, `Your code: ${code}`)
    },
  },

  // Backup codes
  backupCodes: {
    count: 10,
    length: 8,
  },
})
```

## Endpoints

### Enable 2FA

```
POST /auth/two-factor/enable
```

**Request:**
```json
{
  "password": "current-password"
}
```

**Response:**
```json
{
  "totpUri": "otpauth://totp/MyApp:user@example.com?secret=...",
  "backupCodes": ["CODE1234", "CODE5678", ...],
  "secret": "BASE32SECRET"
}
```

### Verify Setup

```
POST /auth/two-factor/verify-setup
```

**Request:**
```json
{
  "code": "123456"
}
```

### Verify During Sign-in

When signing in with 2FA enabled, you'll get:
```json
{
  "twoFactorRedirect": true,
  "message": "Two factor verification required"
}
```

Then verify with TOTP:
```
POST /auth/two-factor/verify-totp
```

Or backup code:
```
POST /auth/two-factor/verify-backup-code
```

### Disable 2FA

```
POST /auth/two-factor/disable
```

### Generate New Backup Codes

```
POST /auth/two-factor/generate-backup-codes
```

## Client Usage

```typescript
import { twoFactorClient } from "nevr/plugins/auth/plugins/two-factor/client"

const client = createClient({
  plugins: [
    authClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        router.push("/verify-2fa")
      },
    }),
  ],
})

// Enable 2FA
const { data } = await client.twoFactor.enable({ password: "..." })
// Show QR code from data.totpUri
// Save data.backupCodes securely

// Verify setup
await client.twoFactor.verifySetup({ code: "123456" })

// During sign-in with 2FA
await client.twoFactor.verifyTotp({ code: "123456" })
// Or use backup code
await client.twoFactor.verifyBackupCode({ code: "ABCD1234" })
```

## Schema

The plugin adds:
- `twoFactorEnabled` field to User
- `twoFactor` entity for storing secrets
