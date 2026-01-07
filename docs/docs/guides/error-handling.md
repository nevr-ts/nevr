# Error Handling

Handle errors in Nevr applications.

## Built-in Errors

Nevr provides error builders:

```typescript
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
  internalError,
} from "nevr"
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

## Throwing Errors

### In Actions

```typescript
.actions({
  publish: action()
    .onResource()
    .handler(async (ctx) => {
      const post = await ctx.driver.findOne("post", { id: ctx.resourceId })

      if (!post) {
        throw notFoundError("Post not found")
      }

      if (post.published) {
        throw conflictError("Post already published")
      }

      return ctx.driver.update("post", { id: post.id }, { published: true })
    }),
})
```

### Validation Errors

```typescript
throw validationError([
  { field: "email", message: "Invalid email format" },
  { field: "password", message: "Must be at least 8 characters" },
])
```

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

## Global Error Handler

```typescript
// Express
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message,
    }
  })
})
```

## Client Error Handling

```typescript
try {
  await client.user.create({ email: "invalid" })
} catch (error) {
  if (error.code === "VALIDATION_ERROR") {
    error.details.forEach(d => {
      console.log(`${d.field}: ${d.message}`)
    })
  }
}
```

## Custom Error Classes

```typescript
import { NevrErrorClass } from "nevr"

class PaymentError extends NevrErrorClass {
  constructor(message: string) {
    super("PAYMENT_ERROR", message, 402)
  }
}

throw new PaymentError("Card declined")
```

## Next Steps

- [CRUD Operations](/guides/crud)
- [Filtering & Sorting](/guides/filtering)
