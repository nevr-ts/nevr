# Remote Joiner

Remote Joiner enables API-level data stitching for cross-service data. Connect external services (Stripe, Auth0, etc.) without database foreign keys.

## Why Remote Joiner?

Traditional ORMs require database foreign keys for relations. But what about:

- Stripe subscriptions (stored in Stripe, not your DB)
- External user profiles (Auth0, Firebase)
- Third-party inventory systems
- Microservices with separate databases

Remote Joiner solves this by joining data at the API level:

```typescript
// No foreign key in DB, but client gets joined data
const Customer = entity("customer", {
  email: string,
  stripeSubscriptionId: string,
  // Remote relation - joined at API level
  subscription: belongsTo(() => Subscription).remote("stripeService"),
})

// GET /customers/123?include=subscription
{
  "id": "123",
  "email": "john@example.com",
  "stripeSubscriptionId": "sub_abc123",
  "subscription": {
    "id": "sub_abc123",
    "plan": "Pro",
    "status": "active",
    "price": 2999
  }
}
```

## Defining Remote Relations

### Basic Remote Relation

```typescript
import { entity, string, belongsTo } from "nevr"

const Subscription = entity("subscription", {
  planName: string,
  status: string,
  price: int,
}).build()

const Customer = entity("customer", {
  email: string,
  stripeSubscriptionId: string,
  // Mark relation as remote with the service name
  subscription: belongsTo(() => Subscription).remote("stripeService"),
}).build()
```

### Remote Without Service

If you don't specify a service, it uses the default driver:

```typescript
// Remote relation but uses main database
subscription: belongsTo(() => Subscription).remote()
```

This is useful when you want API-level joining for performance reasons (no DB JOINs).

## Implementing Remote Services

Remote services must implement the `RemoteService` interface:

```typescript
import type { RemoteService } from "nevr"

class StripeService implements RemoteService {
  private stripe: Stripe

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey)
  }

  async fetchByIds(
    entityName: string,
    ids: string[],
    options?: { include?: boolean | IncludeConfig; select?: string[] }
  ): Promise<Record<string, unknown>[]> {
    if (entityName === "subscription") {
      const subscriptions = await Promise.all(
        ids.map(id => this.stripe.subscriptions.retrieve(id))
      )

      return subscriptions.map(sub => ({
        id: sub.id,
        planName: sub.items.data[0]?.plan.nickname || "Unknown",
        status: sub.status,
        price: sub.items.data[0]?.price.unit_amount || 0,
      }))
    }

    return []
  }
}

// Register the service
api.registerService("stripeService", () => new StripeService(process.env.STRIPE_KEY!))
```

## How Stitching Works

1. Client requests data with `include`:
   ```
   GET /customers?include=subscription
   ```

2. Nevr fetches local data from driver

3. Remote Joiner identifies remote relations in include

4. For each remote relation:
   - Collects all foreign key values (e.g., `stripeSubscriptionId`)
   - Batches them for efficient fetching
   - Calls the remote service's `fetchByIds`
   - Stitches the results onto the records

5. Response includes both local and remote data

## Configuration

### Create Remote Joiner

```typescript
import { createRemoteJoiner } from "nevr"

const joiner = createRemoteJoiner({
  batchSize: 100,   // Max IDs per batch (default: 100)
  timeout: 5000,    // Fetch timeout in ms (default: 5000)
  cache: true,      // Cache remote results (default: true)
})
```

### Manual Stitching

For advanced use cases, you can stitch manually:

```typescript
import { createRemoteJoiner, splitIncludes } from "nevr"

const joiner = createRemoteJoiner()

// Fetch local data
const customers = await driver.findMany("customer")

// Stitch remote data
const stitched = await joiner.stitch(
  customers,
  CustomerEntity,
  { subscription: true },
  { entities, container, driver }
)
```

## Helper Functions

### hasRemoteRelations

Check if entity has any remote relations:

```typescript
import { hasRemoteRelations } from "nevr"

if (hasRemoteRelations(CustomerEntity)) {
  // Entity has remote relations
}
```

### getRemoteRelationFields

Get field names of remote relations:

```typescript
import { getRemoteRelationFields } from "nevr"

const fields = getRemoteRelationFields(CustomerEntity)
// ["subscription"]
```

### splitIncludes

Separate local and remote includes:

```typescript
import { splitIncludes } from "nevr"

const include = {
  subscription: true,  // Remote
  orders: true,        // Local
}

const { local, remote } = splitIncludes(CustomerEntity, include)
// local: { orders: true }
// remote: { subscription: true }
```

### validateRemoteRelations

Validate that all remote relations have valid service definitions:

```typescript
import { validateRemoteRelations } from "nevr"

// Throws if a remote service is missing or misconfigured
validateRemoteRelations(entities, container)
```

## E-Commerce Example

Complete example with Stripe subscriptions:

```typescript
// entities/customer.ts
const Customer = entity("customer", {
  email: string.unique(),
  name: string,
  stripeSubscriptionId: string.optional(),
  subscription: belongsTo(() => Subscription).remote("stripeService"),
})
  .rules({
    read: ["authenticated"],
    update: ["owner"],
  })
  .build()

// services/stripe.ts
class StripeRemoteService implements RemoteService {
  constructor(private stripe: Stripe) {}

  async fetchByIds(entityName: string, ids: string[]) {
    if (entityName === "subscription") {
      const results: Record<string, unknown>[] = []

      for (const id of ids) {
        try {
          const sub = await this.stripe.subscriptions.retrieve(id)
          results.push({
            id: sub.id,
            planName: sub.items.data[0]?.plan.nickname,
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            price: sub.items.data[0]?.price.unit_amount,
          })
        } catch {
          // Subscription not found, skip
        }
      }

      return results
    }

    return []
  }
}

// index.ts
const api = nevr({
  entities: [Customer],
  driver: prisma(new PrismaClient()),
})

api.registerService("stripeService", () =>
  new StripeRemoteService(new Stripe(process.env.STRIPE_KEY!))
)
```

Client usage:

```typescript
// Get customer with subscription data
const response = await fetch("/customers/123?include=subscription")

// Response
{
  "id": "123",
  "email": "john@example.com",
  "name": "John Doe",
  "stripeSubscriptionId": "sub_abc123",
  "subscription": {
    "id": "sub_abc123",
    "planName": "Pro Monthly",
    "status": "active",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "price": 2999
  }
}
```

## Multi-Service Example

Joining data from multiple external services:

```typescript
const User = entity("user", {
  email: string,
  auth0Id: string,
  stripeCustomerId: string,

  // Auth0 profile
  auth0Profile: belongsTo(() => Auth0Profile).remote("auth0Service"),

  // Stripe customer
  stripeCustomer: belongsTo(() => StripeCustomer).remote("stripeService"),
})

// Register both services
api.registerService("auth0Service", () => new Auth0Service())
api.registerService("stripeService", () => new StripeService())

// GET /users/123?include=auth0Profile,stripeCustomer
{
  "id": "123",
  "email": "john@example.com",
  "auth0Id": "auth0|abc123",
  "stripeCustomerId": "cus_xyz789",
  "auth0Profile": {
    "nickname": "johndoe",
    "picture": "https://...",
    "lastLogin": "2024-01-15T10:30:00Z"
  },
  "stripeCustomer": {
    "balance": 0,
    "currency": "usd",
    "defaultPaymentMethod": "pm_..."
  }
}
```

## Error Handling

Remote Joiner handles errors gracefully:

```typescript
// If remote service fails, field is set to null
{
  "id": "123",
  "email": "john@example.com",
  "stripeSubscriptionId": "sub_abc123",
  "subscription": null  // Service error
}
```

Errors are logged but don't fail the entire request.

## Performance Considerations

### Batching

Remote Joiner batches IDs to minimize API calls:

```typescript
// 50 customers with subscriptions
// Without batching: 50 API calls
// With batching (batchSize: 100): 1 API call
```

### Caching

Enable caching for repeated requests:

```typescript
const joiner = createRemoteJoiner({ cache: true })
```

### Selective Includes

Only include remote relations when needed:

```typescript
// Don't include remote data for list views
GET /customers

// Include remote data for detail views
GET /customers/123?include=subscription
```

## Best Practices

1. **Batch efficiently** - Set appropriate batch size for your external APIs
2. **Handle failures** - Remote services can fail; handle null gracefully
3. **Cache when possible** - Remote data often doesn't change frequently
4. **Selective loading** - Only include remote data when the client needs it
5. **Timeout appropriately** - Set reasonable timeouts for external services

## Next Steps

- [Service Container](/guide/services) - Registering remote services
- [Actions](/guide/actions) - Using remote data in actions
- [Workflows](/guide/workflows) - Multi-step operations with remote services
