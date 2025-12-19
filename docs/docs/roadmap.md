# Roadmap

Nevr is evolving from a library into a full-fledged API framework. This roadmap outlines our vision for the future of Nevr.

## Current Status: v0.1.0-beta.1 (MVP)

The current version provides the core foundation for building type-safe, schema-first APIs.

- ✅ **Entity DSL**: Define data models with pure TypeScript.
- ✅ **Auto-Generated API**: Instant CRUD endpoints with validation.
- ✅ **Prisma Integration**: Seamless database management.
- ✅ **Plugin System**: Extensible architecture with dependency injection.
- ✅ **Core Plugins**: Authentication, Payments (Stripe), and Storage.
- ✅ **Adapters**: Support for Express and Hono.

---

## Future Versions

### v0.2.0: The "Batteries-Included" Framework

The next major release will focus on Developer Experience (DX), removing the need for boilerplate server code.

#### 1. The `nevr serve` Command
Instead of manually creating an Express server and mounting Nevr, you will be able to run your API directly.

```bash
nevr serve --config nevr.config.ts
```

This command will spin up a production-ready server with best practices built-in.

#### 2. Config-Driven Middleware
Security and performance features will be handled via configuration, not code.

```typescript
// nevr.config.ts
export const config = {
  security: {
    cors: ["https://myapp.com"],
    rateLimit: { window: "1m", max: 100 },
    helmet: true
  },
  // ...
}
```

#### 3. OpenAPI (Swagger) Generation
Since Nevr understands your schema and routes, it will automatically generate OpenAPI v3 specifications.
- **Interactive Documentation**: Auto-generated Swagger UI.
- **Client Generation**: Generate clients for Swift, Kotlin, Dart, etc.

### v0.3.0: Real-Time & Event Driven

#### 4. Webhooks Plugin
A dedicated plugin to handle incoming and outgoing webhooks.
- **Incoming**: Verify signatures (Stripe, GitHub) and trigger Nevr actions.
- **Outgoing**: Subscribe to entity events (`user.created`) and POST to external URLs.

#### 5. Real-Time / WebSockets
Native support for real-time updates.
- **Subscriptions**: Clients can subscribe to entity changes.
- **Events**: Server-sent events for custom triggers.

---

## Long-Term Vision

Our goal is to make Nevr the standard for building Node.js APIs. We aim to compete with frameworks like NestJS and Strapi by offering superior type safety and a better developer experience.
