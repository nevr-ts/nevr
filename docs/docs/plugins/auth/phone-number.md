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

## Client Usage

```typescript
import { phoneNumberClient } from "nevr/plugins/auth/plugins/phone-number/client"

const client = createClient({
  plugins: [authClient(), phoneNumberClient()],
})

// Request OTP
await client.phoneNumber.sendOTP({
  phoneNumber: "+1234567890",
})

// Sign in with OTP
const { data } = await client.phoneNumber.signIn({
  phoneNumber: "+1234567890",
  code: "123456",
})
```

## Schema

The plugin adds:
- `phoneNumber` field to User (optional, unique)
- `phoneNumberVerified` field to User
- `phoneVerification` entity for OTP storage
