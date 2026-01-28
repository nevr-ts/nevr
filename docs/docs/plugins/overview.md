# Plugins Overview

> 🔌 **Plugins are modular extensions that add reusable features to your Nevr application.**

## Why Plugins?

### The Problem: Features That Every App Needs

| Feature | Without Plugins | With Plugins |
|---------|-----------------|---------------|
| **Authentication** | Write 500+ lines of auth code | `auth({ emailAndPassword: { enabled: true } })` |
| **Timestamps** | Add createdAt/updatedAt to every entity manually | One-line plugin for all entities |
| **Rate limiting** | Build custom middleware | `rateLimit({ max: 100 })` |
| **Logging** | Implement hooks everywhere | Plugin auto-hooks all requests |

> 🟢 **Beginner Tip**: Think of plugins as "drop-in features". You install them, configure them, and they just work—without writing the underlying code.

### What Plugins Can Add

| Capability | Description | Example |
|------------|-------------|----------|
| **Entities** | New database tables/models | User, Session, Account |
| **Endpoints** | Custom API operations | `/auth/sign-in`, `/auth/sign-out` |
| **Interceptors** | Request/response processing | Authentication checks, logging |
| **Entity Hooks** | CRUD lifecycle callbacks | `beforeCreate`, `afterDelete` |
| **Services** | Injectable utilities | Email service, Payment processor |

---

## Using Plugins

Add plugins to your `defineConfig` — they're picked up automatically by `nevr()`:

```typescript
// src/nevr.config.ts
import { defineConfig } from "nevr"
import { auth } from "nevr/plugins/auth"
import { timestamps } from "nevr/plugins/timestamps"
import { user } from "./entities/user.js"
import { post } from "./entities/post.js"

export const config = defineConfig({
  database: "sqlite",
  entities: [user, post],
  plugins: [
    // Official plugin with options
    auth({
      emailAndPassword: { enabled: true },
      socialProviders: {
        google: { clientId: "...", clientSecret: "..." },
        github: { clientId: "...", clientSecret: "..." },
      },
    }),

    // Official simple plugin
    timestamps(),

    // Your custom plugin
    myCustomPlugin({ apiKey: "..." }),
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

> 🟡 **Intermediate Tip**: Plugins are applied in order. If plugin B depends on plugin A, make sure A comes first in the array.

::: tip Recommended project structure
For projects with custom plugins, keep them in a dedicated `plugins/` folder:

**Express / Hono:**
```
src/
├── entities/
│   ├── user.ts
│   ├── post.ts
│   └── index.ts         # re-exports all entities
├── plugins/
│   ├── auth.ts          # auth plugin config
│   ├── my-plugin.ts     # your custom plugin
│   └── index.ts         # re-exports all plugins
├── nevr.config.ts       # defineConfig — entities + plugins
└── server.ts            # nevr({ ...config, driver })
```

**Next.js:**
```
lib/
├── entities/
│   └── index.ts
├── plugins/
│   ├── auth.ts
│   └── index.ts
├── nevr.config.ts
└── nevr.ts
app/
└── api/
    └── [...nevr]/
        └── route.ts
```

This keeps plugin configuration separate and your `nevr.config.ts` clean:
```typescript
import { defineConfig } from "nevr"
import * as entities from "./entities/index.js"
import { authPlugin, myPlugin } from "./plugins/index.js"

export default defineConfig({
  database: "sqlite",
  entities: Object.values(entities).filter(e => e && typeof e === "object"),
  plugins: [authPlugin, myPlugin],
})
```
:::

---

## Official Plugin Ecosystem

| Plugin | Package | Description | Status |
|--------|---------|-------------|--------|
| **Auth** | `nevr/plugins/auth` | Complete authentication system | ✅ Ready |
| **Timestamps** | `nevr/plugins/timestamps` | Auto `createdAt`/`updatedAt` | ✅ Ready |
| **Payments** | `nevr/plugins/payments` | Stripe payment integration | ✅ Ready|
| **Storage** | `nevr/plugins/storage` | File upload and management | ✅ Ready |
| **AI-Gateway** | `nevr/plugins/ai-gateway` | AI model integration | ✅ Ready |
| **RAG** | `nevr/plugins/rag` | Retrieval-Augmented Generation | ✅ Ready | 

---

## Creating Your Own Plugins

### Quick Example 🟢

```typescript
import { createPlugin, endpoint } from "nevr"

const helloWorld = createPlugin({
  id: "hello",
  name: "Hello World",
  version: "1.0.0",
  
  lifecycle: {
    onInit: () => console.log("👋 Hello from Plugin!")
  },
  
  endpoints: {
    hello: endpoint("/hello", {
      method: "GET",
      handler: async () => ({ message: "Hello World!" }),
    }),
  },
})
```

### Configurable Plugin 🟡

```typescript
interface Options {
  greeting: string
  shout?: boolean
}

const greetPlugin = createPlugin<Options>({
  id: "greet",
  name: "Greeting Plugin",
  version: "1.0.0",
  
  defaults: { shout: false },
  
  factory: (options) => ({
    endpoints: {
      greet: endpoint("/greet", {
        method: "GET",
        handler: async () => {
          const msg = options.greeting
          return { message: options.shout ? msg.toUpperCase() : msg }
        },
      }),
    },
  }),
})

// Usage in nevr.config.ts:
// plugins: [greetPlugin({ greeting: "Welcome!" })]
```

See [Creating Plugins](./creating) for the full guide.

---

## Plugin API at a Glance

| Function | Use Case | Level |
|----------|----------|-------|
| `createPlugin()` | Most plugins | 🟢 Recommended |
| `createPlugin()` with `factory` | Configurable plugins |

---

## Next Steps

- [Creating Plugins](./creating) - Build your own plugins
- [Auth Plugin](./auth) - Authentication system
- [Interceptors](./interceptors) - Request/response hooks
