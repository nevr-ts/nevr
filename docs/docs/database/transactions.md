# Transactions

Execute multiple operations atomically.

## Basic Transaction

```typescript
const result = await driver.transaction(async (tx) => {
  const user = await tx.create("user", { name: "John" })
  const profile = await tx.create("profile", { userId: user.id })
  return { user, profile }
})
```

## In Actions

```typescript
.actions({
  transfer: action()
    .input({ from: string, to: string, amount: int })
    .handler(async (ctx) => {
      return ctx.driver.transaction(async (tx) => {
        await tx.update("account", { id: ctx.input.from }, {
          balance: { decrement: ctx.input.amount }
        })
        await tx.update("account", { id: ctx.input.to }, {
          balance: { increment: ctx.input.amount }
        })
        return { success: true }
      })
    }),
})
```

## In Workflows

Workflows can use transactions automatically:

```typescript
.actions({
  checkout: action()
    .workflow([
      step("reserve", execute, compensate),
      step("charge", execute, compensate),
    ], { useTransaction: true }),
})
```

## Rollback

If any operation fails, all changes are rolled back:

```typescript
try {
  await driver.transaction(async (tx) => {
    await tx.create("user", { name: "John" })
    throw new Error("Something failed!")
    // User is NOT created
  })
} catch (error) {
  // Handle error
}
```

## Nested Transactions

Use savepoints for nested transactions:

```typescript
await driver.transaction(async (tx) => {
  await tx.create("order", { ... })

  try {
    await tx.transaction(async (tx2) => {
      await tx2.create("payment", { ... })
      throw new Error("Payment failed")
    })
  } catch {
    // Inner transaction rolled back
    // Outer transaction continues
  }

  await tx.update("order", { ... }, { status: "payment_failed" })
})
```

## Next Steps

- [Workflows](/actions/workflows)
- [Saga Pattern](/actions/saga-pattern)
