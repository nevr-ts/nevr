# Phone Number Authentication

SMS-based OTP authentication for phone number sign-in.

## Installation

Add the phone-number plugin inside the auth plugin in your config:

```typescript
// nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { phoneNumber } from "nevr/plugins/auth/phone-number"

export const config = defineConfig({
  database: "sqlite",
  entities: [],
  plugins: [
    auth({
      plugins: [
        phoneNumber({
          sendOTP: async ({ phoneNumber, code }) => {
            await smsService.send(phoneNumber, `Your code: ${code}`)
          },
        }),
      ],
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
import { phoneNumberClient } from "nevr/plugins/auth/phone-number/client"
import type { API } from "./api"

const client = createClient<API>()({
  baseURL: "/api",
  plugins: [authClient(), phoneNumberClient()],
})
```

## Configuration

```typescript
phoneNumber({
  // Required: Send OTP via SMS
  sendOTP: async ({ phoneNumber, code, userId }) => {
    await twilioClient.messages.create({
      to: phoneNumber,
      from: "+1234567890",
      body: `Your verification code: ${code}`,
    })
  },

  // OTP expiration in seconds (default: 5 minutes)
  expiresIn: 300,

  // OTP length (default: 6)
  otpLength: 6,

  // Allow sign-up with phone (default: true)
  allowSignUp: true,

  // Require phone verification (default: true)
  requireVerification: true,
})
```

## Endpoints

### Send OTP

```
POST /auth/phone-number/send-otp
```

**Request:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "expiresIn": 300
}
```

### Sign In with Phone

```
POST /auth/sign-in/phone-number
```

**Request:**
```json
{
  "phoneNumber": "+1234567890",
  "code": "123456"
}
```

**Response:**
```json
{
  "token": "session-token",
  "user": {
    "id": "...",
    "phoneNumber": "+1234567890",
    "phoneNumberVerified": true
  }
}
```

### Verify Phone Number

For adding phone to existing account:

```
POST /auth/phone-number/verify
```

### Request Password Reset

```
POST /auth/phone-number/request-password-reset
```

**Request:**
```json
{
  "phoneNumber": "+1234567890"
}
```

### Reset Password

```
POST /auth/phone-number/reset-password
```

**Request:**
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456",
  "newPassword": "new-secure-password"
}
```

## Client Usage

```typescript
import { createClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import { phoneNumberClient } from "nevr/plugins/auth/phone-number/client"
import type { API } from "./api"

// Use curried pattern for full type inference
const client = createClient<API>()({
  plugins: [authClient(), phoneNumberClient()],
})

// Request OTP (under auth.phoneNumber namespace)
await client.auth.phoneNumber.sendOTP({ phoneNumber: "+1234567890" })

// Verify phone
await client.auth.phoneNumber.verify({ phoneNumber: "+1234567890", code: "123456" })

// Sign in with phone
await client.auth.signIn.phoneNumber({ phoneNumber: "+1234567890", code: "123456" })

// Password reset flow
await client.auth.phoneNumber.requestPasswordReset({ phoneNumber: "+1234567890" })
await client.auth.phoneNumber.resetPassword({
  phoneNumber: "+1234567890",
  otp: "123456",
  newPassword: "new-pass",
})
```

## Rate Limiting

Built-in rate limiting protects against OTP spam. Fully configurable:

```typescript
// Custom limits
phoneNumber({
  sendOTP: async ({ phoneNumber, code }) => {...},
  rateLimit: { window: 30000, max: 3 }, // 3 per 30s (stricter)
})

// Higher limits for high-traffic
phoneNumber({
  sendOTP: async ({ phoneNumber, code }) => {...},
  rateLimit: { window: 60000, max: 50 }, // 50/min
})

// Disable (use external limiter)
phoneNumber({
  sendOTP: async ({ phoneNumber, code }) => {...},
  rateLimit: false,
})
```

**Default:** 10 requests per 60 seconds

| Endpoints | Window | Max |
|-----------|--------|-----|
| `/phone-number/*`, `/sign-in/phone-number` | 60s | 10 |

## Schema

The plugin adds:
- `phoneNumber` field to User (optional, unique)
- `phoneNumberVerified` field to User
- Uses `verification` entity for OTP storage

