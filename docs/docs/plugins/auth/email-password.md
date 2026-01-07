# Email & Password

> 🔐 **Traditional authentication with email and password.**

## Why Email & Password?

| Scenario | Best Choice |
|----------|-------------|
| Users without social accounts | ✅ Email & Password |
| Enterprise/B2B apps | ✅ Email & Password |
| Privacy-conscious users | ✅ Email & Password |
| Quick sign up experience | Social Sign-On |

> 🟢 **Beginner Tip**: Email & Password is the most universal auth method. Even if you add social login, always offer email as a fallback.

---

## Setup

### Server Configuration

```typescript
import { nevr } from "nevr"
import { auth } from "nevr/plugins/auth"

const api = nevr({
  entities: [user],
  driver: prisma(db),
  
  plugins: [
    auth({
      baseURL: process.env.BASE_URL,
      
      emailAndPassword: {
        enabled: true,
        
        // Require email verification before login
        requireEmailVerification: false,
        
        // Password requirements
        password: {
          minLength: 8,
          requireUppercase: false,
          requireNumbers: false,
          requireSymbols: false,
        },
      },
    }),
  ],
})
```

---

## Client Usage

### Setup Client

```typescript
import { createTypedClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import type { API } from "./server/api"

export const client = createTypedClient<API>({
  baseURL: "http://localhost:3000/api",
  plugins: [authClient()],
})
```

### Sign Up

```typescript
const { data, error } = await client.auth.signUp({
  email: "user@example.com",
  password: "securePassword123",
  name: "John Doe",  // Optional additional fields
})

if (error) {
  console.error("Sign up failed:", error.message)
} else {
  console.log("Account created!", data.user)
}
```

### Sign In

```typescript
const { data, error } = await client.auth.signIn({
  email: "user@example.com",
  password: "securePassword123",
})

if (error) {
  console.error("Sign in failed:", error.message)
} else {
  console.log("Welcome back!", data.user.name)
}
```

### Sign Out

```typescript
await client.auth.signOut()
```

---

## React Integration

```tsx
import { client } from "./lib/client"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    
    const { data, error } = await client.auth.signIn({ email, password })
    
    if (error) {
      setError(error.message)
    } else {
      window.location.href = "/dashboard"
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      {error && <p className="error">{error}</p>}
      <button type="submit">Sign In</button>
    </form>
  )
}
```

---

## Password Reset

### Request Reset

```typescript
// Send password reset email
const { error } = await client.auth.forgotPassword(
  "user@example.com",
  "/reset-password"  // Redirect URL after clicking email link
)

if (!error) {
  console.log("Check your email for reset link")
}
```

### Complete Reset

```typescript
// On password reset page, get token from URL
const token = new URLSearchParams(window.location.search).get("token")

const { error } = await client.auth.resetPassword(token, "newSecurePassword123")

if (!error) {
  console.log("Password updated! You can now sign in.")
}
```

---

## Email Verification

### Send Verification Email

```typescript
await client.auth.sendVerificationEmail(
  "user@example.com",
  "/verify-email"  // Callback URL
)
```

### Server Configuration

```typescript
auth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,  // Block login until verified
    
    // Email sending (implement your own)
    sendVerificationEmail: async ({ email, url, token }) => {
      await sendEmail({
        to: email,
        subject: "Verify your email",
        html: `<a href="${url}">Verify Email</a>`,
      })
    },
  },
})
```

---

## Change Password

```typescript
const { error } = await client.auth.changePassword(
  "currentPassword123",
  "newSecurePassword456"
)

if (!error) {
  console.log("Password changed successfully")
}
```

---

## API Endpoints

The auth plugin creates these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/sign-up` | POST | Create new account |
| `/auth/sign-in` | POST | Sign in with email/password |
| `/auth/sign-out` | POST | End session |
| `/auth/forgot-password` | POST | Request password reset |
| `/auth/reset-password` | POST | Reset password with token |
| `/auth/send-verification-email` | POST | Send verification email |
| `/auth/verify-email` | POST | Verify email with token |
| `/auth/change-password` | POST | Change password |

---

## Best Practices

1. **Always hash passwords**: Nevr uses scrypt by default
2. **Rate limit auth endpoints**: Prevent brute force attacks
3. **Use HTTPS**: Never send passwords over HTTP
4. **Implement email verification**: Especially for B2B apps
5. **Provide password reset**: Users will forget passwords

---

## Next Steps

- [Session Management](/plugins/auth/sessions) - Configure sessions
- [Social Sign-On](/plugins/auth/social) - Add OAuth providers
- [Auth Plugin](/plugins/auth) - Full auth configuration
