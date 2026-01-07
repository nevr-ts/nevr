# External Services

> 🔌 **Connect external APIs as data sources for remote relations.**

## Why External Services?

### The Problem: APIs Have Different Shapes

| Source | API Shape | Challenge |
|--------|-----------|----------|
| Stripe | `stripe.subscriptions.list()` | Returns Stripe-specific format |
| Microservice | `fetch(url)` with custom auth | Different response structure |
| Data warehouse | SQL query | Completely different access pattern |

### The Solution: RemoteService Interface

Nevr provides a simple interface that adapts any external data source:

```typescript
interface RemoteService {
  fetchByIds(entityName: string, ids: string[]): Promise<any[]>
  fetchById?(entityName: string, id: string): Promise<any | null>
}
```

> 🟢 **Beginner Tip**: You implement `fetchByIds` with whatever logic your service needs—API call, database query, etc.—and return normalized data. Nevr handles the rest.

---

## Registering Services

```typescript
import { nevr } from "nevr"

const api = nevr({ entities: [user], driver: prisma(db) })

// Register a remote service
api.registerService("stripeService", () => ({
  async fetchByIds(entityName: string, ids: string[]) {
    // Fetch from Stripe and return normalized data
    const subscriptions = await stripe.subscriptions.list({
      customer: ids,
    })
    return subscriptions.data.map(sub => ({
      id: sub.id,
      customerId: sub.customer,
      plan: sub.items.data[0]?.price.nickname,
      status: sub.status,
    }))
  },
}))
```

> 🟡 **Intermediate Tip**: The service ID (`"stripeService"`) must match what you use in `.remote("stripeService")` on your entity relations.

---

## Service Patterns

### Pattern 1: External API (Stripe, etc.)

```typescript
api.registerService("stripeService", () => ({
  async fetchByIds(entityName: string, customerIds: string[]) {
    if (entityName !== "subscription") return []
    
    // Batch fetch from Stripe
    const results = await Promise.all(
      customerIds.map(id =>
        stripe.subscriptions.list({ customer: id, limit: 1 })
      )
    )
    
    return results.flatMap(r => r.data.map(sub => ({
      id: sub.id,
      customerId: sub.customer as string,
      plan: sub.items.data[0]?.price.nickname,
      status: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    })))
  }
}))
```

---

### Pattern 2: Microservice (HTTP)

```typescript
api.registerService("orderService", () => ({
  async fetchByIds(entityName: string, ids: string[]) {
    const response = await fetch(`${ORDER_SERVICE_URL}/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${INTERNAL_TOKEN}`,
      },
      body: JSON.stringify({ ids }),
    })
    
    if (!response.ok) {
      console.error(`Order service error: ${response.status}`)
      return []
    }
    
    return response.json()
  }
}))
```

---

### Pattern 3: Data Warehouse (SQL)

```typescript
api.registerService("analyticsService", () => ({
  async fetchByIds(entityName: string, skus: string[]) {
    if (entityName !== "productAnalytics") return []
    
    const results = await analyticsDB.query(`
      SELECT sku, views, purchases, conversion_rate
      FROM product_analytics
      WHERE sku = ANY($1)
    `, [skus])
    
    return results.rows.map(row => ({
      id: row.sku,  // Use sku as ID for matching
      views: row.views,
      purchases: row.purchases,
      conversionRate: row.conversion_rate,
    }))
  }
}))
```

---

## Error Handling

> 🔴 **Advanced**: Remote services should gracefully handle failures. Return empty arrays on error to avoid breaking the entire request.

```typescript
api.registerService("externalService", () => ({
  async fetchByIds(entityName: string, ids: string[]) {
    try {
      const data = await fetchExternal(ids)
      return data
    } catch (error) {
      // Log the error
      console.error(`[${entityName}] Remote fetch failed:`, error)
      
      // Return empty - relation will be null, not error
      return []
    }
  }
}))
```

### Why Return Empty on Error?

| Approach | What Happens |
|----------|-------------|
| **Throw error** | Entire API request fails ❌ |
| **Return empty** | Main data returns, relation is `null` ✅ |

Clients can handle `null` relations gracefully:

```typescript
const user = await client.users.findOne(id, { include: { subscription: true } })

if (user.subscription) {
  showSubscriptionDetails(user.subscription)
} else {
  showUpgradePrompt()
}
```

---

## Validation at Startup

Validate that all remote services are registered before your server starts:

```typescript
import { validateRemoteRelations } from "nevr"

const errors = validateRemoteRelations(entities, container)
if (errors.length > 0) {
  console.error("Missing remote services:")
  errors.forEach(err => console.error("  -", err))
  process.exit(1)
}

console.log("✅ All remote services registered")
```

---

## Full Example

```typescript
import { nevr, entity, string, belongsTo } from "nevr"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Entity with remote relation
const user = entity("user", {
  email: string.email(),
  stripeCustomerId: string,
  subscription: belongsTo(() => Subscription)
    .remote("stripeService")
    .foreignKey("stripeCustomerId"),
})

const api = nevr({ entities: [user], driver: prisma(db) })

// Register the service
api.registerService("stripeService", () => ({
  async fetchByIds(entityName: string, customerIds: string[]) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerIds,
      status: "active",
    })
    
    return subscriptions.data.map(sub => ({
      id: sub.id,
      customerId: sub.customer as string,
      plan: sub.items.data[0]?.price.nickname || "unknown",
      status: sub.status,
    }))
  }
}))

// Now queries work automatically!
// GET /api/users?include=subscription
```

---

## Next Steps

- [Remote Relations](/remote-joiner/relations) - How to define remote relations
- [Service Container](/services/container) - Dependency injection
- [Plugins](/plugins/overview) - Plugin-based remote data
