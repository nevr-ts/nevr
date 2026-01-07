---
layout: home
hero:
  name: Nevr
  text: The Full Stack TypeScript Framework
  tagline: Build industrial-grade applications with entity definitions. Workflows, Services, and Remote Data — fully type-safe from database to client.
  image:
    src: /hero.PNG
    alt: Nevr Framework Hero
  actions:
    - theme: brand
      text: Get Started 🚀
      link: /get-started/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/nevr-ts/nevr

features:
  - icon: ⚡
    title: Entity-First Architecture
    details: Define your data model once. Nevr generates your database schema, API, auth rules, and client SDK automatically.
  - icon: 🔄
    title: Workflow Engine
    details: Handle complex business logic with ease. Define multi-step sagas with automatic rollback compensation.
  - icon: 🧩
    title: Service Container
    details: Powerful dependency injection without the boilerplate. Register services and resolve them anywhere.
  - icon: 🌐
    title: Remote Joiner
    details: Stitch data from external services (Stripe, CMS) directly into your API responses.
  - icon: 🔌
    title: Unified Plugin System
    details: Add Auth, Payments, and Storage with a single line. Extensible, type-safe, and production-ready.
  - icon: 🛡️
    title: End-to-End Type Safety
    details: Zero-latency feedback loop. Change an entity, and your entire stack — server, API, client — updates instantly.
---

<style>
.landing-page {
  /* display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center; */
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

# The Missing Layer for Modern Backends

<p>Building production-ready backends today is too hard. You glue together an ORM, a framework, validation libraries, and auth middleware, then manually keep types in sync.</p>

**Nevr changes the game.**

</div>

---

<div class="landing-page">

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

## 3 Pillars of Industrial-Grade Apps

Nevr isn't just a CRUD generator. It provides the architectural primitives needed to build scalable, real-world applications.

<div class="pillars-grid">

<div>

### 1. Robust Workflows
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

### 2. Service Container
Functional dependency injection that keeps your code testable and decoupled.

```typescript
// Register once, use anywhere
api.register(Payment, new Stripe())

const payments = ctx.resolve(Payment)
```

</div>

<div>

### 3. Remote Data
Merge data from external APIs as if it were in your local database.

```typescript
// User in DB, Sub in Stripe
belongsTo(() => sub).remote("stripe")

// API Response: { user, sub } ✅
```

</div>

</div>

---

## Experience the Speed

<div class="code-showcase">

```typescript
// 1. Define Entity
const order = entity("order", {
  total: float,
  status: string.default("pending"),
  items: hasMany(() => orderItem),
})
  .ownedBy("customer")
  .actions({
    checkout: action().handler(async (ctx) => {
      // Implement checkout logic...
    })
  })

// 2. That's it. You have:
// 🚀 POST /api/orders/checkout  (Authenticated)
// 🛡️ Automatic Validation & Authorization
// 📦 Generated Database Schema
// 💻 Fully Typed Client SDK
```

</div>

<div class="cta-section">
  <h2>Ready to build better backends?</h2>
  <p>Join thousands of developers building type-safe APIs faster.</p>
  <a href="get-started/introduction" class="cta-button">Start the Guide →</a>
</div>

</div>
