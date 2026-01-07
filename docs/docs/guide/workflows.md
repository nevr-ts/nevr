# Workflows (Saga Pattern)

Workflows are multi-step operations with automatic rollback. If any step fails, all previous steps are compensated in reverse order - this is the **Saga Pattern**.

## Why Workflows?

Consider an e-commerce checkout:

1. Reserve inventory
2. Charge payment
3. Create shipment
4. Update order status

If step 3 fails, you need to:
- Refund the payment (undo step 2)
- Release the inventory (undo step 1)

Manually handling this is error-prone. Workflows automate it.

## Basic Workflow

```typescript
import { entity, action, step, string } from "nevr"

const order = entity("order", {
  status: string.default("pending"),
}).actions({
  checkout: action()
    .workflow([
      step("validate",
        async (ctx) => {
          // Validate order
          return { valid: true }
        }
      ),
      step("process",
        async (ctx) => {
          // Process order
          await ctx.driver.update("order", { id: ctx.resourceId }, { status: "completed" })
          return { processed: true }
        }
      ),
    ])
})
```

## Step with Compensation

```typescript
step("charge-payment",
  // Execute function
  async (ctx) => {
    const stripe = ctx.resolve("stripe")
    const charge = await stripe.charges.create({
      amount: ctx.input.amount,
      currency: "usd",
    })
    return charge  // Return value passed to compensate
  },
  // Compensate function (runs on later step failure)
  async (ctx, charge) => {
    const stripe = ctx.resolve("stripe")
    await stripe.refunds.create({ charge: charge.id })
  }
)
```

## Full E-Commerce Example

```typescript
const order = entity("order", {
  items: string,  // JSON
  total: float,
  status: string.default("pending"),
  chargeId: string.optional(),
  shipmentId: string.optional(),
}).actions({
  checkout: action()
    .input({ paymentMethodId: string })
    .workflow([
      // Step 1: Reserve inventory
      step("reserve-inventory",
        async (ctx) => {
          const inventory = ctx.resolve("inventoryService")
          const items = JSON.parse(ctx.resource.items)
          const reservation = await inventory.reserve(items)
          ctx.set("reservationId", reservation.id)
          return reservation
        },
        async (ctx, reservation) => {
          const inventory = ctx.resolve("inventoryService")
          await inventory.release(reservation.id)
        }
      ),

      // Step 2: Charge payment
      step("charge-payment",
        async (ctx) => {
          const stripe = ctx.resolve("stripeService")
          const charge = await stripe.charge({
            amount: ctx.resource.total,
            paymentMethod: ctx.input.paymentMethodId,
          })
          ctx.set("chargeId", charge.id)
          return charge
        },
        async (ctx, charge) => {
          const stripe = ctx.resolve("stripeService")
          await stripe.refund(charge.id)
        }
      ),

      // Step 3: Create shipment
      step("create-shipment",
        async (ctx) => {
          const shipping = ctx.resolve("shippingService")
          const shipment = await shipping.create({
            orderId: ctx.resourceId,
            items: ctx.resource.items,
          })
          ctx.set("shipmentId", shipment.id)
          return shipment
        }
        // No compensation - can't un-ship
      ),

      // Step 4: Update order
      step("finalize",
        async (ctx) => {
          await ctx.driver.update("order", { id: ctx.resourceId }, {
            status: "completed",
            chargeId: ctx.get("chargeId"),
            shipmentId: ctx.get("shipmentId"),
          })
          return { success: true }
        }
      ),
    ], { useTransaction: true })
})
```

## Workflow Options

```typescript
.workflow(steps, {
  useTransaction: true  // Wrap in database transaction
})
```

When `useTransaction: true`:
- All database operations are in one transaction
- If any step fails, the transaction rolls back automatically
- Compensation functions still run for non-DB side effects

## Sharing Data Between Steps

Use `ctx.set()` and `ctx.get()`:

```typescript
step("step1",
  async (ctx) => {
    const result = await doSomething()
    ctx.set("userId", result.userId)  // Store for later steps
    return result
  }
),

step("step2",
  async (ctx) => {
    const userId = ctx.get("userId")  // Retrieve from previous step
    // Use userId
  }
)
```

## Retry Configuration

```typescript
step("flaky-api-call",
  async (ctx) => {
    return await unreliableApi.call()
  },
  async (ctx, result) => {
    await unreliableApi.undo(result)
  },
  {
    retry: {
      maxAttempts: 3,
      delay: 1000,      // 1 second between retries
      backoff: 2,       // Exponential backoff multiplier
    }
  }
)
```

## Workflow Result

The workflow action returns the last step's result:

```typescript
// POST /orders/:id/checkout
{
  "success": true,
  "chargeId": "ch_123",
  "shipmentId": "ship_456"
}
```

On failure:

```typescript
{
  "error": "Payment failed",
  "code": "ACTION_ERROR",
  "failedStep": "charge-payment",
  "compensatedSteps": ["reserve-inventory"]
}
```

## Standalone Workflow Engine

You can also use workflows outside of entities:

```typescript
import { workflow, executeWorkflow } from "nevr"

const importWorkflow = workflow("import-data")
  .step("download", async (ctx) => {...})
  .step("validate", async (ctx) => {...})
  .step("import", async (ctx) => {...}, async (ctx, result) => {...})
  .withData({ batchSize: 100 })
  .transactional()
  .build()

const result = await executeWorkflow(driver, importWorkflow)
```

## Shortcuts

### runWorkflow

Execute a workflow definition in a single function call:

```typescript
import { runWorkflow } from "nevr"

const result = await runWorkflow(driver, "import-data", [
  step("download", async () => { ... }),
  step("process", async () => { ... })
], {
  initialData: { batchSize: 100 }
})
```

## Entity Workflow Helpers

Pre-built steps for common entity operations:

```typescript
import { createEntityStep, updateEntityStep, deleteEntityStep } from "nevr"

const steps = [
  createEntityStep("create-user", "user",
    (ctx) => ({ email: ctx.input.email, name: ctx.input.name }),
    { storeAs: "userId", compensate: true }
  ),

  updateEntityStep("set-role", "user",
    (ctx) => ({ id: ctx.get("userId") }),
    (ctx) => ({ role: "verified" }),
    { compensate: true }
  ),
]
```

## Best Practices

1. **Always compensate side effects** - If a step calls an external API, provide compensation
2. **Use transactions for DB operations** - Set `useTransaction: true`
3. **Keep steps focused** - One logical operation per step
4. **Store intermediate results** - Use `ctx.set()` for data needed by later steps
5. **Order matters** - Steps run in order, compensation runs in reverse

## Error Handling

```typescript
step("risky-operation",
  async (ctx) => {
    try {
      return await riskyApi.call()
    } catch (error) {
      // Transform error if needed
      throw new Error(`API failed: ${error.message}`)
    }
  },
  async (ctx, result) => {
    // Compensation is best-effort
    // Errors here are logged but don't stop other compensations
    await riskyApi.rollback(result)
  }
)
```

## Next Steps

- [Actions](/guide/actions) - Simple actions without workflows
- [Service Container](/guide/services) - Register and use services
- [Transactions](/guide/transactions) - Database transactions
