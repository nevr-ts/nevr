# Saga Pattern

> 🛡️ **Distributed transactions with automatic compensation.**

## Why the Saga Pattern?

### The Problem: Distributed Systems Can't Use Traditional Transactions

In a monolithic app, database transactions handle rollbacks for you:

```typescript
// ✅ This works in a single database
await db.transaction(async () => {
  await db.createOrder()
  await db.updateInventory()  // If this fails, order is rolled back
})
```

But real applications span **multiple services**:

```typescript
// ❌ This DOESN'T work across services!
await db.transaction(async () => {
  await stripe.charge()        // External payment service
  await inventory.reserve()    // Separate microservice  
  await email.send()           // External email service
})  // Transaction can't span these!
```

> 🟢 **Beginner Tip**: A database transaction can only rollback operations within that database. When you call Stripe, send an email, or hit another microservice, you need a different strategy.

### The Solution: Saga Pattern

The Saga pattern breaks operations into **steps with compensating actions**:

```
          Execute                    Compensate (on failure)
          ───────                    ────────────────────────
 Step 1:  Reserve inventory    →    Release inventory  
Step 2:  Charge payment        →    Refund payment
Step 3:  Create shipment       →    Cancel shipment
Step 4:  Send email            →    (no compensation needed)
```

> 🟡 **Intermediate Note**: The term "Saga" comes from a 1987 database research paper. It's now the standard pattern for distributed transactions in microservices architectures.

> 🔴 **Advanced**: Nevr supports both **choreography** (steps trigger next steps) and **orchestration** (central coordinator) saga styles. The `workflow()` function implements orchestration.

---

## What is the Saga Pattern?

The Saga pattern manages distributed transactions by breaking them into a sequence of local transactions. Each step has a compensating action that undoes its work if a later step fails.

```
Step 1 → Step 2 → Step 3 (fails)
                    ↓
         Compensate Step 2
                    ↓
         Compensate Step 1
```

## Why Use Sagas?

Traditional transactions don't work across services:

```typescript
// This doesn't work across Stripe + Database + Email
await db.transaction(async () => {
  await stripe.charge()      // External service
  await db.createOrder()     // Database
  await sendEmail()          // External service
})
```

Sagas solve this:

```typescript
workflow([
  step("charge", chargeCard, refundCard),
  step("order", createOrder, cancelOrder),
  step("email", sendEmail),  // No compensation needed
])
```

## Compensation Rules

1. **Reverse Order**: Compensations run in reverse order
2. **Best Effort**: Compensations should be idempotent
3. **Optional**: Not all steps need compensation

## Example: E-commerce Checkout

```typescript
const checkoutWorkflow = [
  // Step 1: Reserve inventory
  step("reserve",
    async (ctx) => {
      const result = await ctx.resolve("inventory").reserve(ctx.input.items)
      return { reservationId: result.id, items: result.items }
    },
    async (ctx, result) => {
      await ctx.resolve("inventory").release(result.reservationId)
    }
  ),

  // Step 2: Charge payment
  step("charge",
    async (ctx) => {
      const stripe = ctx.resolve("stripe")
      const charge = await stripe.charges.create({
        amount: ctx.stepResults.reserve.total,
        source: ctx.input.paymentMethodId,
      })
      return { chargeId: charge.id }
    },
    async (ctx, result) => {
      const stripe = ctx.resolve("stripe")
      await stripe.refunds.create({ charge: result.chargeId })
    }
  ),

  // Step 3: Create shipment
  step("ship",
    async (ctx) => {
      const shipping = ctx.resolve("shipping")
      return shipping.createLabel(ctx.input.address)
    },
    async (ctx, result) => {
      const shipping = ctx.resolve("shipping")
      await shipping.cancelLabel(result.trackingId)
    }
  ),

  // Step 4: Send confirmation (no compensation)
  step("notify",
    async (ctx) => {
      const mailer = ctx.resolve("mailer")
      await mailer.send("order-confirmation", ctx.input.email)
    }
  ),
]
```

## Failure Scenarios

### Step 3 Fails

```
reserve ✓ → charge ✓ → ship ✗
                         ↓
              refund charge ✓
                         ↓
              release inventory ✓
```

### Compensation Fails

If compensation fails, it's logged but the chain continues:

```
reserve ✓ → charge ✓ → ship ✗
                         ↓
              refund charge ✗ (logged, continue)
                         ↓
              release inventory ✓
```

## Best Practices

1. **Idempotent Compensations**: Can run multiple times safely
2. **Store State**: Keep enough data to compensate
3. **Timeout Handling**: Set appropriate timeouts
4. **Logging**: Log all steps for debugging
5. **Retry Logic**: Implement retries in compensations

## Next Steps

- [Workflows](/actions/workflows)
- [Transactions](/database/transactions)
