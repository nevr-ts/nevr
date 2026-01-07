# Errors Reference

Complete reference for Nevr's error handling utilities.

## Error Builders

### validationError()

Create a 400 Bad Request error for validation failures.

```typescript
import { validationError } from "nevr"

throw validationError("Invalid email format", {
  field: "email",
  value: input.email
})
```

### unauthorizedError()

Create a 401 Unauthorized error.

```typescript
import { unauthorizedError } from "nevr"

throw unauthorizedError("Authentication required")
```

### forbiddenError()

Create a 403 Forbidden error.

```typescript
import { forbiddenError } from "nevr"

throw forbiddenError("You don't have permission to access this resource")
```

### notFoundError()

Create a 404 Not Found error.

```typescript
import { notFoundError } from "nevr"

throw notFoundError("User not found", { id: userId })
```

### conflictError()

Create a 409 Conflict error.

```typescript
import { conflictError } from "nevr"

throw conflictError("Email already exists", { email })
```

### internalError()

Create a 500 Internal Server Error.

```typescript
import { internalError } from "nevr"

throw internalError("Database connection failed")
```

---

## Error Classes

### NevrErrorClass

Base error class with status code and metadata.

```typescript
import { NevrErrorClass } from "nevr"

const error = new NevrErrorClass("Something went wrong", {
  code: "CUSTOM_ERROR",
  status: 422,
  details: { field: "value" }
})
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Error message |
| `code` | `string` | Error code |
| `status` | `number` | HTTP status |
| `details` | `object` | Additional data |

---

## Utility Functions

### createErrorResponse()

Convert an error to a standard API response.

```typescript
import { createErrorResponse } from "nevr"

const response = createErrorResponse(error)
// { error: { code: "...", message: "...", details: {...} } }
```

### handleError()

Central error handler for middleware.

```typescript
import { handleError } from "nevr"

app.use((err, req, res, next) => {
  const response = handleError(err)
  res.status(response.status).json(response.body)
})
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

---

## See Also

- [Validation](/fields/validation)
- [Authorization](/entities/authorization)
