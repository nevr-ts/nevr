# Adapters Concept

Adapters connect Nevr to your HTTP framework. They handle routing, request parsing, and response formatting.

## What is an Adapter?

An adapter is the HTTP layer. It integrates Nevr with frameworks like Express or Hono.

```typescript
import { nevr } from 'nevr';
import { expressAdapter } from 'nevr/adapters/express';

const api = nevr({
  entities: [User, Post],
  adapter: expressAdapter, // HTTP integration
});

app.use('/api', api.createRouter());
```

## Available Adapters

| Adapter | Package | Framework |
|---------|---------|-----------|
| **Express** | `nevr/adapters/express` | Express.js |
| **Hono** | `nevr/adapters/hono` | Hono (fast, lightweight) |

## Express Adapter

The default and most popular adapter.

### Usage

```typescript
import { expressAdapter } from 'nevr/adapters/express';

const api = nevr({
  adapter: expressAdapter,
});

app.use('/api', api.createRouter());
```

### Features
- Automatic route creation for all entities
- Parses JSON bodies
- Handles errors and validation
- Returns JSON responses

## Hono Adapter

A fast, minimal alternative for edge/serverless.

```typescript
import { honoAdapter } from 'nevr/adapters/hono';

const api = nevr({
  adapter: honoAdapter,
});

app.route('/api/*', api.createRouter());
```

## Adapter Interface

Adapters implement this interface:

```typescript
interface Adapter {
  name: string;
  createRouter(api: NevrInstance): any; // Returns router instance
}
```

## Custom Adapters

You can build your own adapter for any HTTP framework:

```typescript
const myAdapter = {
  name: 'my-adapter',
  createRouter(api) {
    // Return router for your framework
  },
};
```

## Adapter + Driver Flow

```
HTTP Request
    │
    ▼
┌─────────────┐
│  Adapter    │  ← Parses request, calls Nevr
└─────┬───────┘
      │
      ▼
┌─────────────┐
│  Nevr Core  │  ← Validates, checks rules
└─────┬───────┘
      │
      ▼
┌─────────────┐
│   Driver    │  ← Executes database query
└─────┬───────┘
      │
      ▼
  Database
```

## Best Practices

- Use Express for most projects
- Use Hono for edge/serverless
- Always use `api.createRouter()`
- Mount at `/api` for consistency

## Next Steps

- [Integration: Express](/docs/integration/express)
- [Integration: Hono](/docs/integration/hono)
- [Routing](/docs/concepts/routing)
