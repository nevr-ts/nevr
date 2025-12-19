# The Nevr Philosophy

Nevr was born from a simple observation: **Backend development has become an exercise in gluing together the same libraries over and over again.**

## 1. The 80/20 Rule

In almost every backend project, the code distribution looks like this:

- **80% Repetitive Patterns**: CRUD endpoints, validation, authentication, database schemas, type definitions, error handling.
- **20% Unique Logic**: The specific business rules that make your app unique.

Most frameworks (like NestJS or Express) give you tools to write the 80%, but you still have to *write* it.

**Nevr's Goal**: Automate the 80% completely. You define the "What" (Entities), and Nevr generates the "How". This frees you to spend 100% of your time on the unique 20%.

## 2. Standing on Giants

We believe in using the best tools for the job, not reinventing the wheel. Nevr is an abstraction layer over the ecosystem's most battle-tested libraries:

| Feature | Powered By | Why? |
|---------|------------|------|
| **Database** | [Prisma](https://www.prisma.io/) | Best-in-class ORM and migration tool. |
| **Validation** | [Zod](https://zod.dev/) | The standard for TypeScript schema validation. |
| **Auth** | [Better Auth](https://better-auth.com/) | The most comprehensive auth solution. |
| **Server** | [Express](https://expressjs.com/) / [Hono](https://hono.dev/) | The most popular and fastest web standards. |

Nevr isn't a "new way" to do things; it's the **best way** to wire these existing tools together.

## 3. Data = Schema + Rules

In traditional development, "Schema" (Database) and "Rules" (Logic) are separated.
- **Schema**: `schema.prisma` or SQL migrations.
- **Rules**: Controllers, Services, Middleware.

We believe this separation is artificial. In the backend, **Data is the Logic**.

When you say "A User has a unique email," that is both a database constraint (Schema) and a validation rule (Logic). By defining them together in a Nevr **Entity**, you create a Single Source of Truth that drives your entire stack.

## 4. Freedom of Choice (The "Twist")

Nevr is designed to be **Framework Agnostic**.

We know that "Magic Frameworks" (like Strapi or Firebase) are great until you hit a wall. That's why Nevr runs *inside* your favorite server framework.

- Need standard CRUD? **Use Nevr.**
- Need a complex, custom WebSocket endpoint? **Write a raw Express route.**
- Need to optimize a specific SQL query? **Use the raw Prisma client.**

You never lose control. You just write less boilerplate.

## 5. The Learning Curve

**Does it take weeks to learn Nevr? No. It takes hours.**

Because Nevr is built on standards, there is almost nothing new to learn.

- **Do you know TypeScript?** Then you know how to define fields.
- **Do you know Prisma?** Then you know how the database works.
- **Do you know Express?** Then you know how the server works.

The only "new" thing is the **Entity DSL**, which is designed to be intuitive and readable. You can master the core concepts in a single afternoon.
