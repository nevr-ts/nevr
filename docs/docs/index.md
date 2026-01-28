---
layout: home
hero:
  name: Nevr
  text: The Entity-First TypeScript Framework
  tagline: Define your data model once. Get a type-safe API, database schema, auth, and client — automatically.
  image:
    src: /hero.PNG
    alt: Nevr Framework Hero
  actions:
    - theme: brand
      text: Get Started
      link: /get-started/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/nevr-ts/nevr

features:
  - icon: ⚡
    title: Entity-First Architecture
    details: Define your data model once. Nevr generates your database schema, REST API, auth rules, and client SDK automatically.
  - icon: 🛡️
    title: End-to-End Type Safety
    details: Types flow from entity to database to client. Change a field — your entire stack updates instantly. No codegen.
  - icon: 🔌
    title: Plugin Ecosystem
    details: Drop-in Auth, Payments, Storage, RAG, and AI Gateway. One line each. Type-safe and production-ready.
  - icon: 🔄
    title: Workflow Engine
    details: Multi-step business operations with automatic rollback. Built-in saga pattern for complex transactions.
  - icon: 🧩
    title: Service Container
    details: Functional dependency injection without boilerplate. Register services and resolve them anywhere.
  - icon: 🌐
    title: Remote Joiner
    details: Stitch data from external services (Stripe, CMS) directly into your API responses.
---

<style>
.landing-page {
  text-align: center;
  margin-top: 4rem;
}
.landing-page p {
  max-width: 60%;
  font-size: 1.1rem;
  margin: 0 auto 2rem auto;
}

.landing-page h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  background: -webkit-linear-gradient(315deg, #42d392 25%, #647eff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.landing-page h2 {
  font-size: 2rem;
  margin-top: 3rem;
  margin-bottom: 2rem;
  border-top: none;
}

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 2rem 0;
  text-align: left;
}

@media (max-width: 768px) {
  .comparison-grid {
    grid-template-columns: 1fr;
  }
}

.comparison-item {
  padding: 1.5rem;
  border-radius: 12px;
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
}

.comparison-item h3 {
  margin-top: 0;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.comparison-item ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.comparison-item li {
  margin-bottom: 0.5rem;
  padding-left: 1.5rem;
  position: relative;
}

.comparison-item.traditional li::before {
  content: "❌";
  position: absolute;
  left: 0;
  font-size: 0.8rem;
  top: 4px;
}

.comparison-item.nevr {
  background-color: rgba(66, 211, 146, 0.1);
  border-color: #42d392;
}

.comparison-item.nevr li::before {
  content: "✅";
  position: absolute;
  left: 0;
  font-size: 0.8rem;
  top: 4px;
}

.pillars-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1.5rem;
  text-align: left;
}

@media (max-width: 960px) {
  .pillars-grid {
    grid-template-columns: 1fr;
  }
}

.code-showcase {
  text-align: left;
  margin: 2rem auto;
  max-width: 800px;
}

.what-you-get {
  text-align: left;
  max-width: 700px;
  margin: 1rem auto 2rem auto;
}

.what-you-get ul {
  list-style: none;
  padding: 0;
}

.what-you-get li {
  margin-bottom: 0.4rem;
  padding-left: 1.5rem;
  position: relative;
}

.what-you-get li::before {
  content: "✅";
  position: absolute;
  left: 0;
  font-size: 0.8rem;
  top: 4px;
}

.cta-section {
  margin-top: 5rem;
  padding: 3rem;
  background: var(--vp-c-bg-soft);
  border-radius: 16px;
  text-align: center;
}

.cta-button {
  display: inline-block;
  background-color: #647eff;
  color: white !important;
  padding: 0.8rem 2rem;
  border-radius: 24px;
  font-weight: 600;
  margin-top: 1rem;
  text-decoration: none !important;
  transition: all 0.2s;
}

.cta-button:hover {
  background-color: #4b66fa;
  transform: translateY(-2px);
}
</style>

<div class="landing-page">

# Why Nevr?

<p>Building backends today means gluing together an ORM, a framework, validation libraries, and auth middleware — then manually keeping types in sync.</p>

**Nevr changes that.** Define your entity once, and everything else is derived from it.

</div>

---

<div class="landing-page">

## What You Get

<div class="code-showcase">

```typescript
// Define your entity — this is your entire backend for a resource
const post = entity("post", {
  title: string.min(1).max(200),
  content: text,
  author: belongsTo(() => user),
})
.ownedBy("author")
.rules({
    create: ["authenticated"],
    read: ["everyone"],
    update: ["owner"],
    delete: ["owner", "admin"],
  })
```

</div>

<div class="what-you-get">

From this single definition, you get:

- `POST /api/posts` — Create (validated, auth-protected)
- `GET /api/posts` — List (filtered, sorted, paginated)
- `GET /api/posts/:id` — Read (with relation includes)
- `PUT /api/posts/:id` — Update (ownership enforced)
- `DELETE /api/posts/:id` — Delete (ownership enforced)
- Prisma schema auto-generated
- TypeScript types inferred end-to-end (from DB to React)

</div>

---

## The Nevr Difference

<div class="comparison-grid">
  <div class="comparison-item traditional">
    <h3>The Traditional Way</h3>
    <ul>
      <li>Manual controller files</li>
      <li>Validation logic scattered</li>
      <li>Types synced manually</li>
      <li>Auth middleware spaghetti</li>
      <li>No built-in rollback</li>
    </ul>
  </div>
  <div class="comparison-item nevr">
    <h3>The Nevr Way</h3>
    <ul>
      <li><strong>Entity-First:</strong> One definition powers everything</li>
      <li><strong>Automatic API:</strong> CRUD + Custom Actions</li>
      <li><strong>Type-Safe:</strong> DB to React inference</li>
      <li><strong>Workflow Engine:</strong> Built-in Sagas</li>
      <li><strong>Plugins:</strong> Drop-in Auth & Payments</li>
    </ul>
  </div>
</div>

---

## Beyond CRUD

Nevr provides the architectural primitives needed to build scalable, real-world applications.

<div class="pillars-grid">

<div>

### Robust Workflows
Define complex multi-step operations with automatic failure handling.

```typescript
action().workflow([
  step("reserve", inventory.reserve, inventory.release),
  step("charge", stripe.charge, stripe.refund),
  step("fulfill", shipping.create),
])
```

</div>

<div>

### Service Container
Functional dependency injection that keeps your code testable and decoupled.

```typescript
// Register once, use anywhere
api.register(Payment, new Stripe())

const payments = ctx.resolve(Payment)
```

</div>

<div>

### Remote Data
Merge data from external APIs as if it were in your local database.

```typescript
// User in DB, Sub in Stripe
belongsTo(() => sub).remote("stripe")

// API Response: { user, sub }
```

</div>

</div>

<div class="cta-section">
  <h2>Ready to build?</h2>
  <p>Start building in 60 seconds.</p>
  <a href="get-started/introduction" class="cta-button">Get Started →</a>
</div>

</div>
