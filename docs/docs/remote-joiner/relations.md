# Remote Relations

> 🔗 **Define relations to external services that fetch data at API-level, not database-level.**

## Why Remote Relations?

### The Problem: Data Spread Across Services

| You want to... | But... |
|----------------|--------|
| Show user's Stripe subscription | Data is in Stripe, not your database |
| Display order + shipping status | Shipping is a separate microservice |
| Include product analytics | Analytics are in a data warehouse |

### The Solution: Remote Relations

Define the relationship in your entity, and Nevr fetches from the external service automatically:

```typescript
const user = entity("user", {
  name: string,
  stripeCustomerId: string,
  // 🔗 Remote relation - fetched from Stripe, not database
  subscription: belongsTo(() => Subscription).remote("stripeService"),
})
```

> 🟢 **Beginner Tip**: Remote relations look and work exactly like regular relations from the client's perspective. The "stitching" happens automatically on the server.

---

## Relation Types

### belongsTo (Remote)

Fetch a single related record from an external service:

```typescript
// Many-to-one: Each user has one subscription (in Stripe)
subscription: belongsTo(() => Subscription)
  .remote("stripeService")
  .foreignKey("stripeCustomerId")
```

**Use cases:**
- User → Stripe subscription
- Order → Payment details
- Product → Analytics snapshot

---

### hasMany (Remote)

Fetch multiple related records from an external service:

```typescript
// One-to-many: Each user has many orders (in order microservice)
orders: hasMany(() => Order)
  .remote("orderService")
  .foreignKey("customerId")
```

**Use cases:**
- User → All orders from order service
- Store → All products from catalog service
- Customer → All invoices from billing service

---

### hasOne (Remote)

Fetch a single optional related record:

```typescript
// One-to-one: Product has one analytics record (in data warehouse)
analytics: hasOne(() => ProductAnalytics)
  .remote("analyticsService")
  .foreignKey("sku")
```

---

## Configuration

### .remote(serviceId)

Mark a relation as remote and specify which service fetches the data:

```typescript
subscription: belongsTo(() => Subscription).remote("stripeService")
//                                                   ^
//        Must match api.registerService("stripeService", ...)
```

### .foreignKey(fieldName)

Specify which local field stores the ID used to fetch remote data:

```typescript
subscription: belongsTo(() => Subscription)
  .foreignKey("stripeCustomerId")  // Local field containing Stripe customer ID
  .remote("stripeService")
```

### .references(fieldName)

Specify which field on the remote data to match against (default: `id`):

```typescript
subscription: belongsTo(() => Subscription)
  .foreignKey("stripeCustomerId")  // Local: stripeCustomerId
  .references("customerId")         // Remote: match where customerId = stripeCustomerId
  .remote("stripeService")
```

---

## Querying Remote Relations

Remote relations are included just like regular relations:

```bash
# Include remote data in response
GET /api/users?include=subscription
```

Response:
```json
{
  "id": "user_1",
  "name": "John",
  "stripeCustomerId": "cus_abc123",
  "subscription": {
    "id": "sub_xyz",
    "plan": "pro",
    "status": "active"
  }
}
```

> 🟡 **Intermediate Tip**: The client code doesn't need to know which relations are local vs remote. The API response shape is identical!

---

## Full Example

```typescript
import { entity, string, float, belongsTo, hasMany } from "nevr"

// User entity with both local and remote relations
const user = entity("user", {
  name: string,
  email: string.email(),
  stripeCustomerId: string,
  
  // Local relation (same database)
  posts: hasMany(() => post),
  
  // Remote relation (Stripe)
  subscription: belongsTo(() => Subscription)
    .remote("stripeService")
    .foreignKey("stripeCustomerId"),
  
  // Remote relation (microservice)
  orders: hasMany(() => Order)
    .remote("orderService")
    .foreignKey("id")  // Orders reference user.id as customerId
    .references("customerId"),
})
```

---

## Next Steps

- [External Services](/remote-joiner/services) - How to implement remote services
- [Overview](/remote-joiner/overview) - How Remote Joiner works
