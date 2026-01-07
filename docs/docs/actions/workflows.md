# Workflows

> 🔄 **Multi-step operations with automatic rollback using the saga pattern.**

## Why Workflows?

Real applications often need to perform multiple operations that must succeed or fail together:

```
❌ Without Workflows (What Can Go Wrong)

1. Reserve inventory     ✔️ Success
2. Charge payment        ❌ FAILS!
3. (Inventory stuck reserved forever 😱)
```

```
✅ With Workflows (Automatic Recovery)

1. Reserve inventory     ✔️ Success
2. Charge payment        ❌ FAILS!
   ↓
   Compensation: Release inventory ✔️
   (System back to consistent state 🎉)
```

> 🟢 **Beginner Tip**: Think of workflows like a "transaction" that spans multiple services. If anything fails, previous steps are automatically undone.

> 🟡 **Intermediate Note**: Workflows implement the **Saga Pattern**, a well-established pattern for distributed transactions. Each step defines both an `execute` function and an optional `compensate` function.

---

## What Are Workflows?

Workflows execute multiple steps in sequence. If any step fails, previous steps are compensated (rolled back) in reverse order—this is the **saga pattern**.

```typescript
import { action, step } from "nevr"

const order = entity("order", { ... })
  .actions({
    checkout: action()
      .input({ paymentMethodId: string })
      .workflow([
        step("reserve", reserveInventory, releaseInventory),
        step("charge", chargePayment, refundPayment),
        step("fulfill", createShipment),
      ], { useTransaction: true }),
  })
```

---

## step() Function

Create workflow steps with execute and compensate functions:

```typescript
import { step } from "nevr"

const myStep = step<TResult>(
  name: string,
  execute: (ctx: WorkflowContext) => Promise<TResult>,
  compensate?: (ctx: WorkflowContext, result: TResult) => Promise<void>
)
```

### Basic Step

```typescript
const reserveStep = step("reserve-inventory",
  async (ctx) => {
    const inventory = ctx.resolve<InventoryService>("inventory")
    return inventory.reserve(ctx.input.items)
  },
  async (ctx, result) => {
    const inventory = ctx.resolve<InventoryService>("inventory")
    await inventory.release(result.reservationId)
  }
)
```

### Step Without Compensation

```typescript
const notifyStep = step("send-notification",
  async (ctx) => {
    const mailer = ctx.resolve<MailerService>("mailer")
    await mailer.send("order-confirmed", ctx.user.email)
    return { sent: true }
  }
  // No compensation - notifications can't be "unsent"
)
```

---

## WorkflowContext

Each step receives a context object:

```typescript
interface WorkflowContext<TData> {
  /** Database driver */
  driver: Driver

  /** Shared data between steps */
  data: TData

  /** Set data for next steps */
  set: <K extends keyof TData>(key: K, value: TData[K]) => void

  /** Get data from previous steps */
  get: <K extends keyof TData>(key: K) => TData[K] | undefined

  /** Current step index */
  stepIndex: number

  /** Total steps */
  totalSteps: number

  /** Workflow metadata */
  metadata: WorkflowMetadata
}
```

### Sharing Data Between Steps

```typescript
step("step-1", async (ctx) => {
  const result = await doSomething()
  ctx.set("orderId", result.id)
  return result
})

step("step-2", async (ctx) => {
  const orderId = ctx.get("orderId")
  return await processOrder(orderId)
})
```

---

## Workflow Options

```typescript
.workflow(steps, {
  // Wrap all steps in a database transaction
  useTransaction: true,

  // Timeout for entire workflow (ms)
  timeout: 30000,

  // Initial shared data
  initialData: { source: "web" },
})
```

---

## Pre-built Entity Steps

Nevr provides helper functions for common entity operations:

```typescript
import {
  createEntityStep,
  updateEntityStep,
  deleteEntityStep,
} from "nevr"

// Create with automatic delete compensation
const createOrder = createEntityStep("create-order", "order",
  (ctx) => ({ userId: ctx.user.id, items: ctx.input.items }),
  { storeAs: "orderId", compensate: true }
)

// Update with automatic restore compensation
const updateInventory = updateEntityStep("update-inventory", "product",
  (ctx) => ({ id: ctx.input.productId }),
  (ctx) => ({ stock: ctx.input.newStock }),
  { compensate: true }
)

// Delete with automatic recreate compensation
const deleteTemp = deleteEntityStep("cleanup", "tempRecord",
  (ctx) => ({ id: ctx.get("tempId") }),
  { compensate: true }
)
```

---

## Standalone Workflows

Use workflows outside of actions:

```typescript
import { workflow, executeWorkflow, runWorkflow } from "nevr"

// Builder pattern
const orderWorkflow = workflow<{ orderId: string }>("process-order")
  .step("validate", validateOrder)
  .step("reserve", reserveInventory, releaseInventory)
  .step("charge", chargePayment, refundPayment)
  .transactional()
  .withTimeout(30000)
  .build()

// Execute
const result = await executeWorkflow(driver, orderWorkflow)

// Or use runWorkflow for quick execution
const result = await runWorkflow(driver, "quick-workflow", [
  step("step1", fn1),
  step("step2", fn2),
], { useTransaction: true })
```

---

## WorkflowResult

```typescript
interface WorkflowResult<TData> {
  success: boolean
  data: TData
  error?: Error
  failedStep?: string
  compensatedSteps?: string[]
  duration: number
  metadata: WorkflowMetadata
}
```

---

## Full E-commerce Example

```typescript
const order = entity("order", {
  status: string.default("pending"),
  items: json,
  total: float,
  paymentId: string.optional(),
  customer: belongsTo(() => user),
})
  .ownedBy("customer")
  .actions({
    checkout: action()
      .onResource()
      .input({ paymentMethodId: string })
      .rules("owner")
      .workflow([
        // Step 1: Reserve inventory
        step("reserve-inventory",
          async (ctx) => {
            const inventory = ctx.resolve<InventoryService>("inventory")
            const reservation = await inventory.reserve(ctx.resource.items)
            ctx.set("reservationId", reservation.id)
            return reservation
          },
          async (ctx, reservation) => {
            const inventory = ctx.resolve<InventoryService>("inventory")
            await inventory.release(reservation.id)
          }
        ),

        // Step 2: Charge payment
        step("charge-payment",
          async (ctx) => {
            const stripe = ctx.resolve<Stripe>("stripe")
            const charge = await stripe.paymentIntents.create({
              amount: Math.round(ctx.resource.total * 100),
              currency: "usd",
              payment_method: ctx.input.paymentMethodId,
              confirm: true,
            })
            ctx.set("paymentId", charge.id)
            return charge
          },
          async (ctx, charge) => {
            const stripe = ctx.resolve<Stripe>("stripe")
            await stripe.refunds.create({ payment_intent: charge.id })
          }
        ),

        // Step 3: Update order status
        step("update-order",
          async (ctx) => {
            return ctx.driver.update("order",
              { id: ctx.resourceId },
              {
                status: "paid",
                paymentId: ctx.get("paymentId"),
                paidAt: new Date(),
              }
            )
          },
          async (ctx) => {
            await ctx.driver.update("order",
              { id: ctx.resourceId },
              { status: "pending", paymentId: null, paidAt: null }
            )
          }
        ),

        // Step 4: Send confirmation (no compensation)
        step("send-confirmation",
          async (ctx) => {
            const mailer = ctx.resolve<MailerService>("mailer")
            await mailer.send("order-confirmation", ctx.user.email, {
              orderId: ctx.resourceId,
              total: ctx.resource.total,
            })
            return { emailSent: true }
          }
        ),
      ], { useTransaction: true }),
  })
```

---

## Retry Configuration

Add retry logic to individual steps:

```typescript
step({
  name: "call-external-api",
  execute: async (ctx) => {
    return await externalApi.call(ctx.input)
  },
  retry: {
    maxAttempts: 3,
    delay: 1000,      // 1 second initial delay
    backoff: 2,       // Exponential backoff multiplier
  },
  timeout: 5000,      // 5 second timeout per attempt
})
```

---

## Lifecycle Hooks

```typescript
workflow("order-process")
  .step(...)
  .withHooks({
    onStart: async (ctx) => {
      console.log(`Starting workflow ${ctx.metadata.id}`)
    },
    onStepComplete: async (stepName, result, ctx) => {
      console.log(`Step ${stepName} completed`)
    },
    onStepFailed: async (stepName, error, ctx) => {
      console.error(`Step ${stepName} failed:`, error)
    },
    onCompensate: async (stepName, ctx) => {
      console.log(`Compensating ${stepName}`)
    },
    onComplete: async (result) => {
      console.log(`Workflow completed in ${result.duration}ms`)
    },
    onFailed: async (result) => {
      console.error(`Workflow failed at ${result.failedStep}`)
    },
  })
  .build()
```

---

## WorkflowBuilder API

Use the fluent builder for complex workflows:

```typescript
import { workflow, executeWorkflow } from "nevr"

const checkoutWorkflow = workflow<CheckoutData>("checkout")
  .step("reserve", reserveFn, releaseFn)
  .step("charge", chargeFn, refundFn)
  .withData({ orderId: "123" })
  .transactional()
  .withTimeout(30000)
  .withHooks({ onComplete: async (r) => log(r) })
  .build()

const result = await executeWorkflow(driver, checkoutWorkflow)
```

### Builder Methods

| Method | Description |
|--------|-------------|
| `step(name, execute, compensate?)` | Add step |
| `addStep(stepConfig)` | Add step with full config |
| `withData(initialData)` | Set initial workflow data |
| `transactional()` | Enable database transaction |
| `withTimeout(ms)` | Set timeout |
| `withHooks(hooks)` | Add lifecycle hooks |
| `build()` | Build config |

---

## Pre-built Entity Steps

Common entity operations as reusable steps:

```typescript
import { createEntityStep, updateEntityStep, deleteEntityStep } from "nevr"

workflow("order-process")
  .step(createEntityStep("order", (ctx) => ({
    userId: ctx.get("userId"),
    total: ctx.get("total")
  })))
  .step(updateEntityStep("inventory", (ctx) => ({
    where: { productId: ctx.get("productId") },
    data: { quantity: { decrement: 1 } }
  })))
  .build()
```

---

## Standalone Workflows

Run workflows outside of entity actions:

```typescript
import { runWorkflow, workflow } from "nevr"

const result = await runWorkflow(driver, {
  name: "batch-import",
  steps: [
    step("fetch", fetchData),
    step("transform", transform),
    step("save", saveData)
  ]
})
```

---

## Next Steps

- [Saga Pattern](/actions/saga-pattern) - Distributed transaction patterns
- [Pre-built Actions](/actions/prebuilt) - Ready-to-use actions
- [Service Container](/services/container) - Dependency injection
