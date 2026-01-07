# The Nevr Philosophy
> Nevr is built on the belief that backend development should be simple, efficient, and focused on delivering value—not on reinventing the wheel.

Nevr was born from a simple observation: **Backend development has become an exercise in gluing together the same libraries and patterns over and over again.** We believe that developers shouldn't be architects of boilerplate; they should be architects of value.

---

## 1. Beyond the 80/20 Rule (Zero-API)

In almost every backend project, 80% of the code consists of repetitive patterns: CRUD endpoints, validation, authentication, database schemas, and type definitions. The remaining 20% is the unique business logic that actually makes your application valuable.

**The Nevr Mission**: To push that 80% to **Zero**. 

By adopting a "Zero-API" approach, you define the **Entity**, and Nevr generates the "How." We don't just give you tools to write the 80%—we automate it entirely so you can spend 100% of your time on the unique 20% that matters.

---

## 2. The Trinity: Adapters, Drivers, and Plugins

We believe in extreme modularity and using the best tools for the job without reinventing the wheel. Nevr is an abstraction layer built on three pillars:

| Pillar | Purpose | Philosophy |
| :--- | :--- | :--- |
| **Adapters** | The "Where" | Support every framework (Express, Hono, Next.js). No magic boxes—Nevr runs *inside* your favorite server. |
| **Drivers** | The "How" | Support every database ORM (Prisma, Drizzle, Kysely). Leverage battle-tested giants. |
| **Plugins** | The "What" | **Everything in Nevr is a plugin.** Auth, Payments, Search, and Storage are just 1-line additions. |

---

## 3. Encapsulated Expertise (The "Embedded Senior" Philosophy)

The biggest bottleneck in development isn't code—it's **knowledge**.

Traditional frameworks require a Senior Developer to architect the "right way" to handle security, auth, or real-time data. In Nevr, **Senior-level knowledge is encapsulated into the System.**

* **Best Practices by Default**: Our plugin system uses standards like Zod for validation and a self-contained auth plugin for authentication. You get industry best practices without needing to research or implement them yourself.
* **Rapid Proficiency**: Because Nevr uses an intuitive Entity DSL, a junior or mid-level developer can deploy a professional-grade, type-safe backend in a single afternoon.
* **Architectural Guardrails**: The system prevents common "junior mistakes" (like N+1 queries, exposing password hashes, or missing authorization checks) by default. You stay safe while you learn.

---

## 4. Data-Centric Architecture: Logic is the Entity

In traditional development, "Schema" (Database) and "Rules" (Logic) are separated into different files and layers. We believe this separation is artificial.

In the backend, **Data is the Logic.**

When you define a field as unique or owned by a specific user, that is a database constraint, a security rule, and an API requirement all at once. By defining them together in a Nevr **Entity**, you create a Single Source of Truth that drives your entire stack.

---

## 5. Assemble, Don't Build

We believe the future of software isn't "writing more code," but "assembling better modules." Nevr is designed to give you speed without taking away your freedom.

* **Need standard CRUD?** Let Nevr handle it.
* **Need a complex, custom WebSocket?** Write a raw route.
* **Need to optimize a query?** Use the raw driver client.

You never lose control. You just stop wasting time on things that should be automatic.

---

## 6. The "Never" Promise

We named it **Nevr** because there are things you should **never** have to do again:

* **Never** manually sync your Frontend types with your Backend.
* **Never** write another repetitive CRUD controller.
* **Never** spend days researching how to "correctly" implement Auth or Payments.
* **Never** worry about your Documentation drifting from your Code.

**Focus on your product. Let Nevr handle the rest.**