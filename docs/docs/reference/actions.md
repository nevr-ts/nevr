# Actions Reference

Complete reference for actions and workflows.

## action()

Create an action builder.

```typescript
function action<TInput, TOutput>(name?: string): ActionBuilder
```

## ActionBuilder Methods

### .input(schema)

Define input validation.

```typescript
.input({
  email: string.email(),
  message: text,
})
```

### .handler(fn)

Set action handler.

```typescript
.handler(async (ctx) => {
  return { success: true }
})
```

### .onResource()

Require resource ID.

```typescript
.onResource()
// Creates: POST /api/entities/:id/action
```

### .rules(...rules)

Set authorization rules.

```typescript
.rules("owner", "admin")
.rules("authenticated")
```

### .method(method)

Set HTTP method.

```typescript
.method("GET")
.method("PUT")
.method("DELETE")
```

### .path(path)

Set custom action path (overrides default).

```typescript
.path("/custom/url/activate")
```

### .get() / .post()

Method shortcuts.

```typescript
.get()  // GET method
.post() // POST method (default)
```

### .workflow(steps, options?)

Define workflow.

```typescript
.workflow([
  step("reserve", execute, compensate),
  step("charge", execute, compensate),
])
```

### .meta(metadata)

Add metadata.

```typescript
.meta({
  description: "Process payment",
  rateLimit: 10,
})
```

## Action Context

```typescript
interface ActionContext {
  input: TInput           // Validated input
  resourceId?: string     // Resource ID (if onResource)
  user: User | null       // Current user
  driver: Driver          // Database driver
  resolve: (id) => any    // Service resolver
  entity: Entity          // Entity definition
}
```

## step()

Create a workflow step.

```typescript
function step<TResult>(
  name: string,
  execute: (ctx: WorkflowContext) => Promise<TResult>,
  compensate?: (ctx: WorkflowContext, result: TResult) => Promise<void>
): WorkflowStep
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Step name |
| `execute` | `function` | Execute function |
| `compensate` | `function` | Compensation function (optional) |

### Workflow Context

```typescript
interface WorkflowContext {
  input: TInput              // Action input
  data: Record<string, any>  // Accumulated data
  stepResults: Record<string, any>  // Previous step results
  driver: Driver             // Database driver
  resolve: (id) => any       // Service resolver
}
```

## Workflow Options

```typescript
.workflow([...steps], {
  useTransaction: true,  // Use database transaction
  timeout: 30000,        // Timeout in ms
  initialData: {},       // Initial data
})
```

## Pre-built Actions

### softDeleteAction

```typescript
import { softDeleteAction } from "nevr"

.actions({
  softDelete: softDeleteAction,
})
```

### restoreAction

```typescript
import { restoreAction } from "nevr"

.actions({
  restore: restoreAction,
})
```

### archiveAction / unarchiveAction

```typescript
import { archiveAction, unarchiveAction } from "nevr"

.actions({
  archive: archiveAction,
  unarchive: unarchiveAction,
})
```

### cloneAction

```typescript
import { cloneAction } from "nevr"

.actions({
  clone: cloneAction,
})
```

### bulkUpdateAction / bulkDeleteAction

```typescript
import { bulkUpdateAction, bulkDeleteAction } from "nevr"

.actions({
  bulkUpdate: bulkUpdateAction,
  bulkDelete: bulkDeleteAction,
})
```

### toggleAction

```typescript
import { toggleAction } from "nevr"

.actions({
  toggle: toggleAction("isActive"),
})
```

### countAction / existsAction

```typescript
import { countAction, existsAction } from "nevr"

.actions({
  count: countAction,
  exists: existsAction,
})
```

### exportAction

```typescript
import { exportAction } from "nevr"

.actions({
  export: exportAction,
})
```

## Examples

### Simple Action

```typescript
.actions({
  greet: action()
    .handler(async () => ({ message: "Hello!" })),
})
```

### With Input

```typescript
.actions({
  invite: action()
    .input({ email: string.email() })
    .rules("authenticated")
    .handler(async (ctx) => {
      await sendInvite(ctx.input.email)
      return { sent: true }
    }),
})
```

### Resource Action

```typescript
.actions({
  publish: action()
    .onResource()
    .rules("owner")
    .handler(async (ctx) => {
      return ctx.driver.update(
        "post",
        { id: ctx.resourceId },
        { published: true }
      )
    }),
})
```

### Workflow

```typescript
.actions({
  checkout: action()
    .input({ paymentMethodId: string })
    .workflow([
      step("reserve",
        async (ctx) => ctx.resolve("inventory").reserve(ctx.input),
        async (ctx, result) => ctx.resolve("inventory").release(result)
      ),
      step("charge",
        async (ctx) => ctx.resolve("stripe").charge(ctx.input),
        async (ctx, result) => ctx.resolve("stripe").refund(result)
      ),
    ], { useTransaction: true }),
})
```

## See Also

- [Creating Actions](/actions/creating)
- [Workflows](/actions/workflows)
- [Saga Pattern](/actions/saga-pattern)
