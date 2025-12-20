---
layout: home
hero:
  name: Nevr
  text: The Zero-API Framework.
  tagline: Define your entities once. Get a type-safe API, Database, and Frontend Client instantly.
  image:
    src: /hero.PNG
    alt: Nevr Hero Image
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/nevr-ts/nevr

features:
  - icon: 🚀
    title: Entity-First Design
    details: Define your data models with a fluent DSL. Nevr generates REST endpoints, database schema, and types.
  - icon: ⚡
    title: Zero-API Architecture
    details: No more Controllers, Services, or Routes. Your Entity is the API.
  - icon: 🧩
    title: Senior Knowledge, Plugged-in
    details: Encapsulate complex patterns like Auth and Payments into modular plugins.
  - icon: 🔌
    title: Framework Agnostic
    details: Works with Express, Hono, or any Node.js framework. Swap adapters without changing code.
  - icon: 🗄️
    title: Database Agnostic
    details: Powered by Prisma. Supports PostgreSQL, MySQL, SQLite, MongoDB, and more.
  - icon: 🛡️
    title: Mathematically Type-Safe
    details: End-to-end types. If your schema changes, your frontend build fails.
---

<br>

# Why Nevr?

Building APIs shouldn't require 6 files for every endpoint. Nevr lets you **define once, ship everywhere**.

---

<div class="side-by-side-grid">
  <div class="side-left">

  | Step | Files | Lines of Code |
  |------|-------|---------------|
  | Database Schema | `schema.prisma` | ~10 |
  | Validation | `user.schema.ts` | ~20 |
  | Controller | `user.controller.ts` | ~50 |
  | Router | `user.routes.ts` | ~15 |
  | Types | `user.types.ts` | ~20 |
  | **Total** | **5 files** | **~115 lines** |
  
  And you repeat this for **every entity**.
  
  </div>

  <div class="side-right">
  
   **The Nevr Solution**
  
  ```typescript
  // 1 file, 5 lines — that's it
  import { entity, string, email } from "nevr"
  
  export const user = entity("user", {
    name: string.min(1).max(100),
    email: email.unique(),
  })
  ```
  
  </div>
</div>



## Problem 2: The Type Safety Gap

In most stacks, your database types (SQL/Prisma), API types (DTOs), and Frontend types are separate.

- **Backend:** Changes `User.name` to `User.fullName`.
- **Frontend:** Still using `user.name`.
- **Result:** 💥 Runtime crash in production.

### The Nevr Solution

nevr generates the client **from the entity definition**. If you change the entity, the frontend build fails immediately.

```typescript
// Frontend code (Auto-generated)
import { nevr } from "@/lib/api"

// TypeScript knows exactly what fields exist
const user = await nevr.users.get("123")
console.log(user.fullName) // ✅ Typed!
console.log(user.name)     // ❌ Error: Property 'name' does not exist
```

## Problem 3: Authorization Nightmares

Implementing granular permissions (RBAC) usually involves complex middleware chains and easy-to-miss checks.

```typescript
// Traditional Express
app.put("/posts/:id", (req, res) => {
  const post = await db.post.find(req.params.id)
  if (post.authorId !== req.user.id && !req.user.isAdmin) {
    throw new Error("Unauthorized") // Easy to forget!
  }
  // ...
})
```

### The Nevr Solution

Authorization is declarative and part of the entity definition.

```typescript
export const post = entity("post", { ... })
  .ownedBy("author")
  .rules({
    read: ["everyone"],
    update: ["owner", "admin"], // 🔒 Enforced automatically
    delete: ["admin"]
  })
```

## Problem 4: Inconsistent Validation

You often define validation logic twice: once in your database (SQL constraints) and once in your API (Zod/Joi).

- **Database:** `VARCHAR(100)`
- **API:** `string.max(120)`
- **Result:** Database errors that leak to the user.

### The Nevr Solution

nevr is the **Single Source of Truth**.

```typescript
// Defines BOTH database schema AND runtime validation
name: string.min(1).max(100)
```

## Problem 5: Documentation Drift

Keeping Swagger/OpenAPI documentation in sync with your code is a chore.
- **Code:** You update the API to return `createdAt`.
- **Docs:** You forget to update the YAML file.
- **Result:** Frustrated consumers and broken integrations.

### The Nevr Solution

nevr **is** the documentation. Because the schema is the source of truth, nevr generates the OpenAPI spec automatically. It is mathematically impossible for the docs to be out of sync with the code.

---

## The Payoff

<div class="payoff-grid">
  <div class="payoff-input">
    <h3>Your Input</h3>

```typescript
import { entity, string, email } from "nevr"

export const user = entity("user", {
  name: string.min(1).max(100),
  email: email.unique(),
})
```

  </div>
  <div class="payoff-output">
    <h3>nevr Generates</h3>
    <div class="feature-list">
      <div class="feature-item">
        <div class="feature-icon">🔌</div>
        <div class="feature-content">
          <strong>Full REST API</strong>
          <span>GET, POST, PUT, DELETE endpoints</span>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">🗄️</div>
        <div class="feature-content">
          <strong>Database Schema</strong>
          <span>Optimized Prisma models</span>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">💎</div>
        <div class="feature-content">
          <strong>Type Safety</strong>
          <span>Shared types for Backend & Frontend</span>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">⚡</div>
        <div class="feature-content">
          <strong>API Client</strong>
          <span>Type-safe SDK for your frontend</span>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">📚</div>
        <div class="feature-content">
          <strong>Documentation</strong>
          <span>Auto-generated OpenAPI / Swagger</span>
        </div>
      </div>
    </div>
  </div>
</div>

