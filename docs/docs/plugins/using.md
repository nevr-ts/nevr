# Using Plugins

How to add and configure plugins.

## Installation

Plugins are included with Nevr. Import them directly from their subpaths:

```typescript
import { auth } from "nevr/plugins/auth"
import { timestamps } from "nevr/plugins/timestamps"
```

## Registering Plugins

Pass plugins to the `nevr()` function in the `plugins` array:

```typescript
import { nevr } from "nevr"
import { auth } from "nevr/plugins/auth"

const api = nevr({
  // ... entities ...
  plugins: [
    auth(),
  ],
})
```

## Configuration

Most plugins accept an options object.

```typescript
auth({
  session: {
    expiresIn: "7d",
    updateAge: "1d",
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
})
```

## Using Multiple Plugins

Plugins are loaded in order.

```typescript
import { auth } from "nevr/plugins/auth"
import { timestamps } from "nevr/plugins/timestamps"

const api = nevr({
  plugins: [
    timestamps(), // 1. Adds createdAt/updatedAt
    auth(),       // 2. Adds Users/Sessions
  ],
})
```

## Accessing Plugin Entities

Once registered, plugin entities behave exactly like your own.

```typescript
// Get plugin entity definition
const User = api.getEntity("user")

// Query plugin data using the driver
const users = await api.driver.findMany("user", {
    where: { email: { contains: "@gmail.com" } }
})
```

## Plugin Routes

Plugins automatically register their routes.

```
POST /auth/sign-up
POST /auth/sign-in
...
```

See the specific plugin documentation for available routes.
