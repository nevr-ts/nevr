# Nevr Architecture

Nevr is designed to be **framework agnostic**. It achieves this through three core concepts:

## 1. Drivers (The "Data")
Drivers determine **how** Nevr talks to your data.
*   **Examples:** Prisma, Drizzle, Mongoose, PostgreSQL.
*   **Role:** They provide a standard interface for Plugins to perform CRUD operations without knowing the specific database details.

## 2. Adapters (The "Where")
Adapters determine **where** Nevr runs. They wrap the underlying HTTP server.
*   **Examples:** Express, Hono, Fastify, AWS Lambda.
*   **Role:** They translate the incoming HTTP request (from any framework) into a standard Nevr Context, and translate the Nevr Response back to the framework's format.

## 3. Plugins (The "What")
Plugins determine **what** Nevr can do.
*   **Examples:** Authentication, Payment, Mail, File Upload.
*   **Role:** Reusable blocks of logic that hook into the Nevr lifecycle. Because they use the *Adapter* interface, a single Auth plugin works with Prisma, Drizzle, or Mongo automatically.

## Visual Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        ZAPI CORE                            │
│  Entity DSL │ Validation │ Rules │ Plugin System │ Router   │
└──────────────────────────┬──────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
 ┌───────────┐      ┌───────────┐      ┌─────────────┐
 │  Adapter  │      │  Driver   │      │   Plugin    │
 │  (HTTP)   │      │   (DB)    │      │  (Feature)  │
 └───────────┘      └───────────┘      └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
   Express             Prisma            timestamps
   (Hono)             (Drizzle)          soft-delete
   (Next.js)          (Kysely)           auth-better
                                         storage-s3
```
