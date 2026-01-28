# Using Plugins

How to add and configure plugins.

## Installation

Plugins are included with Nevr. Import them directly from their subpaths:

```typescript
import { auth } from "nevr/plugins/auth"
import { timestamps } from "nevr/plugins/timestamps"
```

## Registering Plugins

Add plugins to your config file, and they're picked up automatically:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"

export const config = defineConfig({
  database: "sqlite",
  entities: [...],
  plugins: [
    auth(),
  ],
})

export default config
```

```typescript
// src/server.ts — plugins loaded automatically from config
import { nevr } from "nevr"
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"
import { config } from "./nevr.config.js"

const api = nevr({ ...config, driver: prisma(new PrismaClient()) })
```

::: tip
Using `defineConfig` in a separate config file is recommended — it enables CLI commands (`npx nevr generate`, `npx nevr db:push`) and keeps a single source of truth. See [defineConfig reference](/reference/nevr#defineconfig).
:::

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

const api = defineConfig({
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
