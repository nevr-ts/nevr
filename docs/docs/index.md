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

# Why Zapi?

Building APIs shouldn't require 6 files for every endpoint. Zapi lets you **define once, ship everywhere**.

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
  
   **The Zapi Solution**
  
  ```typescript
  // 1 file, 5 lines — that's it
  import { entity, string, email } from "zapi"
  
  export const user = entity("user", {
    name: string.min(1).max(100),
    email: email.unique(),
  })
  ```
  
  </div>
</div>

<style>
.side-by-side-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  margin: 1rem 0;
}
@media (min-width: 960px) {
  .side-by-side-grid {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}
.side-right {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
}
</style>

## Problem 2: The Type Safety Gap

In most stacks, your database types (SQL/Prisma), API types (DTOs), and Frontend types are separate.

- **Backend:** Changes `User.name` to `User.fullName`.
- **Frontend:** Still using `user.name`.
- **Result:** 💥 Runtime crash in production.

### The Zapi Solution

Zapi generates the client **from the entity definition**. If you change the entity, the frontend build fails immediately.

```typescript
// Frontend code (Auto-generated)
import { zapi } from "@/lib/api"

// TypeScript knows exactly what fields exist
const user = await zapi.users.get("123")
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

### The Zapi Solution

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

### The Zapi Solution

Zapi is the **Single Source of Truth**.

```typescript
// Defines BOTH database schema AND runtime validation
name: string.min(1).max(100)
```

## Problem 5: Documentation Drift

Keeping Swagger/OpenAPI documentation in sync with your code is a chore.
- **Code:** You update the API to return `createdAt`.
- **Docs:** You forget to update the YAML file.
- **Result:** Frustrated consumers and broken integrations.

### The Zapi Solution

Zapi **is** the documentation. Because the schema is the source of truth, Zapi generates the OpenAPI spec automatically. It is mathematically impossible for the docs to be out of sync with the code.

---

## The Payoff

<div class="payoff-grid">
  <div class="payoff-input">
    <h3>Your Input</h3>

```typescript
import { entity, string, email } from "zapi"

export const user = entity("user", {
  name: string.min(1).max(100),
  email: email.unique(),
})
```

  </div>
  <div class="payoff-output">
    <h3>Zapi Generates</h3>
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

<style>
.payoff-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  margin-top: 1rem;
  margin-bottom: 3rem;
}
@media (min-width: 960px) {
  .payoff-grid {
    grid-template-columns: 1.2fr 1fr;
  }
}
.payoff-output {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--vp-c-divider);
}
.feature-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin-top: 1rem;
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.feature-icon {
  font-size: 1.5rem;
  background: var(--vp-c-bg);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.feature-content {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}
.feature-content strong {
  color: var(--vp-c-text-1);
  font-weight: 600;
}
.feature-content span {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}
@media (min-width: 600px) {
 .image-container img{
  max-width: 100%!important;
  height: auto;
  margin-top: 2rem;
}
}

</style>

