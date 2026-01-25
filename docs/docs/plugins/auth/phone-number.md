# Phone Number Authentication

SMS-based OTP authentication for phone number sign-in.

## Installation

```typescript
import { auth } from "nevr/plugins/auth"
import { phoneNumber } from "nevr/plugins/auth/plugins/phone-number"

const api = nevr({
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
import { phoneNumberClient } from "nevr/plugins/auth/plugins/phone-number/client"

const client = createTypedClient<API>({
  plugins: [authClient(), phoneNumberClient()],
})

// Request OTP
await client.phoneNumber.sendOTP({ phoneNumber: "+1234567890" })

// Verify phone
await client.phoneNumber.verify({ phoneNumber: "+1234567890", code: "123456" })

// Sign in with phone
await client.signIn.phoneNumber({ phoneNumber: "+1234567890", password: "..." })

// Password reset flow
await client.phoneNumber.requestPasswordReset({ phoneNumber: "+1234567890" })
await client.phoneNumber.resetPassword({
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

