# Social Sign-On

> 🔐 **OAuth authentication with 7 providers out of the box.**

## Why Social Sign-On?

### The Problem: OAuth is Complex

| Challenge | Without Nevr | With Nevr |
|-----------|--------------|-----------|
| Authorization URL | Build URL with 10+ params | `google({ clientId, clientSecret })` |
| Token exchange | Handle PKCE, state, refresh | Automatic |
| User info | Different endpoint per provider | Unified `user` object |
| Session management | Custom implementation | Built-in |

> 🟢 **Beginner Tip**: You just provide your app's credentials from the provider (e.g., Google Cloud Console), and Nevr handles the entire OAuth flow.

---

## Available Providers

| Provider | Function | Supports Refresh | Notes |
|----------|----------|------------------|-------|
| **Google** | `google()` | ✅ | OIDC, ID tokens |
| **GitHub** | `github()` | ✅ | Email scopes optional |
| **Apple** | `apple()` | ❌ | Sign in with Apple |

---

## Quick Setup

### 1. Install Auth Plugin

```typescript
import { nevr } from "nevr"
import { auth } from "nevr/plugins/auth"

const api = nevr({
  entities: [user],
  driver: prisma(db),
  
  plugins: [
    auth({
      baseURL: "http://localhost:3000",
      socialProviders: {
        google:{
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
        github:{
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      },
    }),
  ],
})
```

### 2. Configure Provider Credentials

Each provider requires credentials from their developer console:

| Provider | Console URL |
|----------|-------------|
| Google | [console.cloud.google.com](https://console.cloud.google.com/) |
| GitHub | [github.com/settings/developers](https://github.com/settings/developers) |
| Apple | [developer.apple.com](https://developer.apple.com/) |

### 3. Set Redirect URI

All providers need a redirect URI configured:

```
http://localhost:3000/auth/callback/{provider}
```

For example:
- Google: `http://localhost:3000/auth/callback/google`
- GitHub: `http://localhost:3000/auth/callback/github`

---

## Provider Configuration

### Google 🟢

```typescript

google:{
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  
  // Optional: Request additional scopes
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  
}
```

**Returns user profile:**
```typescript
{
  id: "google-id",
  name: "John Doe",
  email: "john@gmail.com",
  image: "https://...",
  emailVerified: true,
}
```

---

### GitHub 🟢

```typescript

github:{
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  
  // Optional: Request additional scopes
  scopes: ["user:email", "read:org"],
  
  
}
```

**Returns user profile:**
```typescript
{
  id: "github-id",
  name: "octocat",
  email: "octocat@github.com", // May be null if private
  image: "https://avatars.githubusercontent.com/...",
}
```

> 🟡 **Note**: GitHub email may be null if the user has a private email. Request the `user:email` scope and fetch from the emails endpoint.

---


### Apple 🟡

```typescript

apple:{
  clientId: process.env.APPLE_SERVICE_ID,
  clientSecret: process.env.APPLE_SECRET_KEY,
  

}
```

> 🟡 **Intermediate Note**: Apple Sign-In requires more setup than other providers. You need:
> 1. An Apple Developer account
> 2. A Service ID
> 3. A private key for generating client secrets

---




## OAuth Flow Endpoints

The auth plugin creates these routes automatically:

| Route | Description |
|-------|-------------|
| `GET /auth/signin/{provider}` | Start OAuth flow |
| `GET /auth/callback/{provider}` | Handle OAuth callback |
| `POST /auth/signout` | End session |

### Frontend Usage

```typescript
// Redirect to Google sign-in
window.location.href = "/auth/signin/google"

// Or GitHub
window.location.href = "/auth/signin/github"

// Alternatively, use the client SDK
await client.auth.signIn.social({ provider: "google" })

```

After successful authentication, the user is redirected to your app with a session cookie.

---



---

## Error Handling

```typescript
auth({
  socialProviders: [...],
  
  callbacks: {
    onError: async (error, provider) => {
      console.error(`OAuth error with ${provider}:`, error)
      // Redirect to error page
      return { redirect: "/auth/error" }
    },
    
    onSignIn: async (user, account, profile) => {
      // Validate user can sign in
      if (user.banned) {
        return { error: "Account suspended" }
      }
      return { success: true }
    },
  },
})
```

---

## Next Steps

- [Auth Plugin](/plugins/auth) - Full authentication system
- [Email & Password](/plugins/auth/email-password) - Traditional auth
- [Session Management](/plugins/auth/sessions) - Session configuration
