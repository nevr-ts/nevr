# Remote Joiner

> 🔗 **API-level data stitching for cross-service data without database foreign keys.**

Enables true domain isolation where plugins like Stripe, Auth, and external services can be separate yet transparently joined in API responses.

---

## Why Remote Joiner?

### The Problem: Your Data Lives in Multiple Places

You have users in your database, but subscriptions in Stripe. How do you join them?

| Approach | Problem |
|----------|----------|
| **Sync Stripe data to your database** | Complex, data duplication, stale data |
| **Make separate API calls on frontend** | Slow, N+1 queries, complex client code |
| **GraphQL federation** | Complex setup, overkill for simple needs |
| **Nevr Remote Joiner** | ✅ Simple, automatic, transparent to client |

> 🟢 **Beginner Tip**: Think of Remote Joiner as "virtual foreign keys" that work across services. You define the relationship once, and Nevr handles fetching and joining automatically.

## The Nevr Solution

```typescript
const user = entity("user", {
  name: string,
  email: string,
  stripeCustomerId: string,
  // Join Stripe subscription at API level - no database FK needed
  subscription: belongsTo(() => Subscription)
    .remote("stripeService")
    .foreignKey("stripeCustomerId"),
})
```

Client gets a unified response:

```json
{
  "id": "user_123",
  "name": "John",
  "email": "john@example.com",
  "subscription": {
    "id": "sub_abc",
    "plan": "premium",
    "status": "active"
  }
}
```

---

## Setup

### 1. Define Remote Relation

```typescript
import { entity, string, belongsTo } from "nevr"

const user = entity("user", {
  email: string.email(),
  stripeCustomerId: string,

  // Remote relation - fetched from Stripe, not database
  subscription: belongsTo(() => Subscription)
    .remote("stripeService")
    .foreignKey("stripeCustomerId")
    .references("customerId"),
})
```

### 2. Register Remote Service

```typescript
import { nevr } from "nevr"

const api = nevr({
  entities: [user],
  driver: prisma(db),
})

// Register the service that provides remote data
api.registerService("stripeService", () => ({
  async fetchByIds(entityName: string, ids: string[], options?: any) {
    const subscriptions = await stripe.subscriptions.list({
      customer: { $in: ids },
    })
    return subscriptions.data.map(sub => ({
      id: sub.id,
      customerId: sub.customer,
      plan: sub.items.data[0]?.price.nickname,
      status: sub.status,
    }))
  }
}))
```

### 3. Query with Include

```typescript
const users = await api.findMany("user", {
  include: { subscription: true }
})
// Each user now has their Stripe subscription attached
```

---

## API Reference

### Exports

| Export | Type | Description |
|:--|:--|:--|
| `createRemoteJoiner` | `Function` | Factory to create RemoteJoiner instance |
| `RemoteJoiner` | `Class` | Main class for stitching remote data |
| `RemoteService` | `Interface` | Interface for remote data providers |
| `hasRemoteRelations` | `Function` | Check if entity has remote relations |
| `getRemoteRelationFields` | `Function` | Get field names of remote relations |
| `splitIncludes` | `Function` | Separate local and remote includes |
| `validateRemoteRelations` | `Function` | Validate all services are registered |

### `createRemoteJoiner(options?)` Options

| Option | Type | Default | Description |
|:--|:--|:--|:--|
| `batchSize` | `number` | `100` | Maximum IDs per fetch batch |
| `timeout` | `number` | `5000` | Request timeout in milliseconds |
| `cache` | `boolean` | `true` | Enable caching of remote results |

### `RemoteJoiner` Methods

| Method | Parameters | Returns | Description |
|:--|:--|:--|:--|
| `stitch` | `(records, entity, include, ctx)` | `Promise<T[]>` | Stitch remote relations onto records |
| `stitchRelation` | `(records, fieldName, relation, includeConfig, ctx)` | `Promise<void>` | Stitch a single remote relation |
| `fetchRemoteData` | `(entityName, ids, relation, includeConfig, ctx)` | `Promise<RemoteFetchResult>` | Fetch remote data by IDs |

### `RemoteService` Interface

| Method | Required | Description |
|:--|:--|:--|
| `fetchByIds(entityName, ids, options)` | ✅ | Fetch multiple records by IDs |
| `fetchById(entityName, id, options)` | - | Fetch single record by ID |

```typescript
interface RemoteService {
  fetchByIds(
    entityName: string,
    ids: string[],
    options?: { include?: IncludeConfig; select?: string[] }
  ): Promise<Record<string, unknown>[]>

  fetchById?(
    entityName: string,
    id: string,
    options?: { include?: IncludeConfig; select?: string[] }
  ): Promise<Record<string, unknown> | null>
}
```

### Helper Functions

| Function | Parameters | Returns | Description |
|:--|:--|:--|:--|
| `hasRemoteRelations` | `(entity: Entity)` | `boolean` | Check if entity has remote relations |
| `getRemoteRelationFields` | `(entity: Entity)` | `string[]` | Get field names of remote relations |
| `splitIncludes` | `(entity, include)` | `{ local, remote }` | Separate local and remote includes |
| `validateRemoteRelations` | `(entities, container)` | `string[]` | Validate services are registered |

---

## Relation Configuration

### `.remote(serviceName)`

Mark a relation as remote and specify the service that provides data:

```typescript
subscription: belongsTo(() => Subscription).remote("stripeService")
```

### `.foreignKey(fieldName)`

Specify the local field that stores the remote ID:

```typescript
subscription: belongsTo(() => Subscription)
  .remote("stripeService")
  .foreignKey("stripeCustomerId")  // Local field containing the ID
```

### `.references(fieldName)`

Specify which field on the remote entity to match:

```typescript
subscription: belongsTo(() => Subscription)
  .remote("stripeService")
  .foreignKey("stripeCustomerId")
  .references("customerId")  // Remote field to match against
```

### Relation Methods Summary

| Method | Description | Example |
|:--|:--|:--|
| `.remote(service)` | Mark as remote relation | `.remote("stripeService")` |
| `.foreignKey(field)` | Local field with remote ID | `.foreignKey("stripeCustomerId")` |
| `.references(field)` | Remote field to match | `.references("customerId")` |

---

## Real-World Examples

### Stripe Subscriptions

```typescript
const user = entity("user", {
  email: string.email(),
  stripeCustomerId: string,
  subscription: belongsTo(() => Subscription)
    .remote("stripeService")
    .foreignKey("stripeCustomerId"),
})

api.registerService("stripeService", () => ({
  async fetchByIds(entity, ids) {
    const subs = await stripe.subscriptions.list({
      customer: { $in: ids },
      expand: ["data.plan"],
    })
    return subs.data.map(sub => ({
      id: sub.id,
      customerId: sub.customer as string,
      plan: sub.items.data[0]?.price.nickname,
      status: sub.status,
    }))
  }
}))
```

### External Microservice

```typescript
const order = entity("order", {
  total: float,
  customerId: string,
  customer: belongsTo(() => Customer)
    .remote("userService")
    .foreignKey("customerId"),
})

api.registerService("userService", () => ({
  async fetchByIds(entity, ids) {
    const response = await fetch(`${USER_SERVICE_URL}/users/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    return response.json()
  }
}))
```

---

## Caching

Remote joiner supports caching to avoid redundant fetches:

```typescript
const joiner = createRemoteJoiner({
  cache: true,  // Enable caching
})

// First request fetches from Stripe
await api.findMany("user", { include: { subscription: true } })

// Second request uses cached subscription data
await api.findMany("user", { include: { subscription: true } })
```

---

## Next Steps

- [Remote Relations](/remote-joiner/relations) - Relation types
- [External Services](/remote-joiner/services) - Service implementation
