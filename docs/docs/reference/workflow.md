# Workflow Engine Reference

The Workflow Engine provides saga pattern support for complex multi-step operations with automatic compensation (rollback) on failure.

## Core Concepts

### Saga Pattern

Workflows execute a series of steps. If any step fails, previously completed steps are compensated (rolled back) in reverse order.

```
Step 1 → Step 2 → Step 3 (fails)
                    ↓
         Compensate Step 2 ← Compensate Step 1
```

---

## API Reference

### workflow()

Create a new workflow definition:

```typescript
import { workflow } from "nevr"

const orderWorkflow = workflow("createOrder")
  .step({
    name: "reserveInventory",
    run: async (ctx) => {
      // Reserve inventory
      return { reservationId: "res-123" }
    },
    compensate: async (ctx, result) => {
      // Release the reservation on failure
      await releaseReservation(result.reservationId)
    }
  })
  .step({
    name: "processPayment",
    run: async (ctx) => {
      // Charge customer
      return { paymentId: "pay-456" }
    },
    compensate: async (ctx, result) => {
      // Refund on failure
      await refundPayment(result.paymentId)
    }
  })
  .build()
```

### runWorkflow()

Execute a workflow:

```typescript
import { runWorkflow } from "nevr"

const result = await runWorkflow(orderWorkflow, {
  input: { orderId: "order-123", amount: 99.99 },
  context: { user: currentUser }
})

if (result.success) {
  console.log("Order created:", result.data)
} else {
  console.log("Order failed:", result.error)
  console.log("Compensated steps:", result.compensated)
}
```

---

## WorkflowStep Interface

```typescript
interface EntityWorkflowStep<TResult = unknown> {
  /** Step name (used for logging and compensation tracking) */
  name: string
  
  /** Execute the step - returns result passed to compensation */
  run: (ctx: EntityActionContext) => Promise<TResult>
  
  /** Optional: Compensate on failure - receives the run result */
  compensate?: (ctx: EntityActionContext, result: TResult) => Promise<void>
  
  /** Optional: Retry configuration */
  retry?: {
    attempts: number
    delay?: number
    backoff?: "linear" | "exponential"
  }
}
```

---

## Usage in Entity Actions

Workflows integrate with entity actions via the `.workflow()` method:

```typescript
const order = entity("order", {
  userId: string,
  total: float,
  status: string.default("pending"),
}).actions({
  checkout: action()
    .input({ paymentMethod: string })
    .workflow([
      step("validateCart")
        .run(async (ctx) => {
          const cart = await ctx.container.getDriver().findFirst("cart", {
            where: { userId: ctx.user.id }
          })
          if (!cart || cart.items.length === 0) {
            throw new Error("Cart is empty")
          }
          return cart
        }),
      
      step("reserveInventory")
        .run(async (ctx) => {
          // Reserve all items
          const reservations = await reserveItems(ctx.results.validateCart.items)
          return { reservations }
        })
        .compensate(async (ctx, result) => {
          // Release all reservations
          await releaseItems(result.reservations)
        }),
      
      step("processPayment")
        .run(async (ctx) => {
          const payment = await chargePayment({
            amount: ctx.results.validateCart.total,
            method: ctx.input.paymentMethod,
          })
          return payment
        })
        .compensate(async (ctx, result) => {
          await refundPayment(result.id)
        }),
      
      step("createOrder")
        .run(async (ctx) => {
          return ctx.container.getDriver().create("order", {
            userId: ctx.user.id,
            total: ctx.results.validateCart.total,
            status: "completed",
          })
        })
    ], { useTransaction: true })
})
```

---

## step() Helper

The `step()` helper provides a fluent API for defining workflow steps:

```typescript
import { step } from "nevr"

const myStep = step("stepName")
  .run(async (ctx) => {
    // Execute step logic
    return { result: "data" }
  })
  .compensate(async (ctx, result) => {
    // Rollback on failure
  })
  .retry({ attempts: 3, delay: 1000, backoff: "exponential" })
  .build()
```

---

## Compensation Results

When a workflow fails, compensation is tracked:

```typescript
interface CompensationResult {
  /** Successfully compensated step names */
  compensated: string[]
  
  /** Errors during compensation */
  errors: Array<{
    stepName: string
    error: Error
  }>
  
  /** Whether all compensations succeeded */
  success: boolean
}
```

---

## Error Handling

### CompensationFailedError

Thrown when compensation itself fails:

```typescript
import { CompensationFailedError } from "nevr"

try {
  await runWorkflow(myWorkflow, context)
} catch (error) {
  if (error instanceof CompensationFailedError) {
    console.log("Original error:", error.originalError)
    console.log("Compensation errors:", error.compensationErrors)
    console.log("Partially compensated:", error.compensatedSteps)
  }
}
```

---

## Transaction Support

Workflows can run inside database transactions:

```typescript
action()
  .workflow([...steps], { 
    useTransaction: true  // All steps run in a single transaction
  })
```

When `useTransaction: true`:
- All database operations share the same transaction
- On failure, the transaction is rolled back (no compensation needed for DB ops)
- Compensation is still run for external side effects (emails, payments, etc.)

---

## Accessing Previous Results

Each step can access results from previous steps:

```typescript
step("secondStep")
  .run(async (ctx) => {
    // Access result from first step
    const firstResult = ctx.results.firstStep
    
    // Access all previous results
    console.log(ctx.results)
    
    return { combined: firstResult.value + 10 }
  })
```

---

## Best Practices

1. **Always provide compensation** - Every step with side effects should have compensation
2. **Keep steps atomic** - Each step should do one thing
3. **Make compensation idempotent** - Compensation may be retried
4. **Use transactions for DB operations** - Let the database handle rollback
5. **Log compensation results** - Track what was compensated for debugging

```typescript
// Good: Atomic steps with compensation
step("sendEmail")
  .run(async (ctx) => {
    const emailId = await sendEmail(ctx.user.email, "Welcome!")
    return { emailId }
  })
  .compensate(async (ctx, result) => {
    // Mark email as cancelled (can't unsend, but can track)
    await markEmailCancelled(result.emailId)
  })
```

---

## Related

- [Entity Actions](/reference/actions) - Using workflows in actions
- [Service Container](/reference/container) - Accessing services in workflows
- [Error Handling](/reference/errors) - Workflow error types
