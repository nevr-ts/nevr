# Introduction

Nevr is a **Framework Agnostic API Builder** designed to take you from zero to a production-ready API in seconds.

It solves the "glue code" nightmare by letting you define your domain entities once, and then automatically generating:
- REST API endpoints
- Database schema (Prisma)
- TypeScript types
- Input validation
- Authorization rules
- API Client

## Why Nevr?

Building APIs often involves repetitive boilerplate:
- Setting up an Express/Fastify/Hono server
- Defining database schemas
- Writing validation logic
- Implementing authentication & authorization
- Creating CRUD endpoints
- Keeping TypeScript types in sync

Nevr eliminates this by separating concerns into three layers:
1.  **Adapters**: The HTTP Server (Express, Hono, etc.)
2.  **Drivers**: The Database (Prisma, Drizzle, etc.)
3.  **Plugins**: The Features (Auth, CRUD, etc.)

With Nevr, you define your data model in a simple, fluent API. Nevr handles the rest.
