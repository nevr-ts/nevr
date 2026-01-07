# Cross-Field Validation

Cross-field validation ensures data consistency across multiple fields. it allows you to define business rules that span multiple properties.

## Basic Usage

Use the `.validate()` method to add cross-field validators:

```typescript
const event = entity("event", {
  name: string,
  startDate: datetime,
  endDate: datetime,
})
  .validate(
    (data) => data.startDate < data.endDate,
    "Start date must be before end date"
  )
```

## Validator Signature

```typescript
.validate(
  fn: (data: Record<string, unknown>) => boolean | Promise<boolean>,
  message: string,
  options?: {
    operations?: ("create" | "update")[]
    fields?: string[]
  }
)
```

**Parameters:**
- `fn` - Validation function that receives the record data
- `message` - Error message when validation fails
- `options.operations` - Limit to specific operations (default: both)
- `options.fields` - Fields that trigger this validation

## Multiple Validators

Chain multiple `.validate()` calls for complex rules:

```typescript
const order = entity("order", {
  quantity: int,
  maxQuantity: int,
  price: float,
  discount: float,
  total: float,
})
  .validate(
    (d) => d.quantity > 0,
    "Quantity must be positive"
  )
  .validate(
    (d) => d.quantity <= d.maxQuantity,
    "Quantity exceeds maximum allowed"
  )
  .validate(
    (d) => d.discount <= d.price,
    "Discount cannot exceed price"
  )
  .validate(
    (d) => d.total === (d.price - d.discount) * d.quantity,
    "Total calculation is incorrect"
  )
```

## Operation-Specific Validation

Limit validation to specific operations:

```typescript
const user = entity("user", {
  password: string,
  confirmPassword: string,
})
  .validate(
    (data) => data.password === data.confirmPassword,
    "Passwords must match",
    { operations: ["create"] }  // Only on create
  )

const subscription = entity("subscription", {
  plan: string,
  expiresAt: datetime,
})
  .validate(
    (data) => new Date(data.expiresAt) > new Date(),
    "Cannot update to expired date",
    { operations: ["update"] }  // Only on update
  )
```

## Field Dependencies

Specify which fields trigger validation:

```typescript
const product = entity("product", {
  price: float,
  salePrice: float.optional(),
  onSale: boolean,
})
  .validate(
    (d) => !d.onSale || (d.salePrice && d.salePrice < d.price),
    "Sale price must be less than regular price",
    { fields: ["price", "salePrice", "onSale"] }
  )
```

When `fields` is specified:
- Validation runs only when those fields are modified
- Optimizes performance for partial updates
- Skips unnecessary validation checks

## Async Validation

Validators can be async for database lookups:

```typescript
const order = entity("order", {
  productId: string,
  quantity: int,
})
  .validate(
    async (data, ctx) => {
      const product = await ctx.driver.findOne("product", {
        where: { id: data.productId }
      })
      return product && product.stock >= data.quantity
    },
    "Insufficient stock for this product"
  )
```

## Common Patterns

### Date Range Validation

```typescript
const reservation = entity("reservation", {
  checkIn: datetime,
  checkOut: datetime,
})
  .validate(
    (d) => d.checkIn < d.checkOut,
    "Check-in must be before check-out"
  )
  .validate(
    (d) => new Date(d.checkIn) >= new Date(),
    "Check-in cannot be in the past",
    { operations: ["create"] }
  )
```

### Password Confirmation

```typescript
const user = entity("user", {
  email: string.email(),
  password: string.password().omit(),
  confirmPassword: string.omit(),  // Virtual field for validation
})
  .validate(
    (d) => d.password === d.confirmPassword,
    "Passwords do not match",
    { operations: ["create"], fields: ["password", "confirmPassword"] }
  )
```

### Price Calculations

```typescript
const invoice = entity("invoice", {
  subtotal: float,
  taxRate: float,
  tax: float,
  total: float,
})
  .validate(
    (d) => Math.abs(d.tax - d.subtotal * d.taxRate) < 0.01,
    "Tax calculation is incorrect"
  )
  .validate(
    (d) => Math.abs(d.total - (d.subtotal + d.tax)) < 0.01,
    "Total calculation is incorrect"
  )
```

### Conditional Required Fields

```typescript
const shipping = entity("shipping", {
  method: string,
  trackingNumber: string.optional(),
  carrier: string.optional(),
})
  .validate(
    (d) => d.method !== "express" || !!d.trackingNumber,
    "Express shipping requires tracking number"
  )
  .validate(
    (d) => !d.trackingNumber || !!d.carrier,
    "Carrier is required when tracking number is provided"
  )
```

### Inventory Constraints

```typescript
const product = entity("product", {
  quantity: int,
  reservedQuantity: int,
  availableQuantity: int,
  lowStockThreshold: int,
})
  .validate(
    (d) => d.reservedQuantity <= d.quantity,
    "Reserved quantity cannot exceed total quantity"
  )
  .validate(
    (d) => d.availableQuantity === d.quantity - d.reservedQuantity,
    "Available quantity must equal quantity minus reserved"
  )
  .validate(
    (d) => d.lowStockThreshold >= 0,
    "Low stock threshold cannot be negative"
  )
```

### Status Transitions

```typescript
const order = entity("order", {
  status: string,
  previousStatus: string.optional(),
  paidAt: datetime.optional(),
  shippedAt: datetime.optional(),
})
  .validate(
    (d) => {
      const validTransitions: Record<string, string[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["paid", "cancelled"],
        paid: ["shipped", "refunded"],
        shipped: ["delivered", "returned"],
        delivered: ["returned"],
      }

      if (!d.previousStatus) return true  // New order
      return validTransitions[d.previousStatus]?.includes(d.status) ?? false
    },
    "Invalid status transition",
    { operations: ["update"], fields: ["status"] }
  )
  .validate(
    (d) => d.status !== "shipped" || !!d.paidAt,
    "Cannot ship unpaid orders"
  )
```

### Mutual Exclusivity

```typescript
const notification = entity("notification", {
  email: string.optional(),
  sms: string.optional(),
  pushToken: string.optional(),
})
  .validate(
    (d) => !!(d.email || d.sms || d.pushToken),
    "At least one notification method is required"
  )
```

### Range Constraints

```typescript
const priceRange = entity("priceRange", {
  minPrice: float,
  maxPrice: float,
  suggestedPrice: float,
})
  .validate(
    (d) => d.minPrice < d.maxPrice,
    "Minimum price must be less than maximum"
  )
  .validate(
    (d) => d.suggestedPrice >= d.minPrice && d.suggestedPrice <= d.maxPrice,
    "Suggested price must be within range"
  )
```

## Error Handling

When cross-field validation fails, the API returns:

```json
{
  "error": "Validation failed",
  "code": "CROSS_FIELD_VALIDATION_ERROR",
  "message": "Start date must be before end date",
  "details": {
    "validator": "cross-field",
    "fields": ["startDate", "endDate"]
  }
}
```

Multiple validation failures:

```json
{
  "error": "Validation failed",
  "code": "CROSS_FIELD_VALIDATION_ERROR",
  "details": [
    {
      "message": "Quantity exceeds maximum",
      "fields": ["quantity", "maxQuantity"]
    },
    {
      "message": "Total calculation is incorrect",
      "fields": ["price", "discount", "quantity", "total"]
    }
  ]
}
```

## Error Classes

You can also catch these errors programmatically using the exported error classes:

```typescript
import { CrossFieldValidationError } from "nevr"

try {
  await api.create("order", data)
} catch (error) {
  if (error instanceof CrossFieldValidationError) {
    console.log(error.details) // Array of validation failures
    // [
    //   { message: "Quantity exceeds max", fields: ["quantity", "maxQuantity"] }
    // ]
  }
}
```

## Validation Order

Cross-field validation runs after field-level validation:

1. **Type validation** - Field types match
2. **Required validation** - Required fields present
3. **Field transforms** - trim, lower, upper
4. **Field validation** - min, max, email, regex, etc.
5. **Cross-field validation** - `.validate()` rules
6. **Authorization** - Permission checks

This ensures cross-field validators receive clean, validated data.

## Best Practices

### 1. Keep Validators Focused

```typescript
// ✅ Good: single responsibility
.validate((d) => d.startDate < d.endDate, "Invalid date range")
.validate((d) => d.quantity > 0, "Invalid quantity")

// ❌ Bad: multiple concerns in one validator
.validate(
  (d) => d.startDate < d.endDate && d.quantity > 0,
  "Invalid data"
)
```

### 2. Provide Clear Error Messages

```typescript
// ✅ Good: specific, actionable message
.validate(
  (d) => d.discount <= d.price * 0.5,
  "Discount cannot exceed 50% of the price"
)

// ❌ Bad: vague message
.validate(
  (d) => d.discount <= d.price * 0.5,
  "Invalid discount"
)
```

### 3. Specify Field Dependencies

```typescript
// ✅ Good: explicit field dependencies
.validate(
  (d) => d.password === d.confirmPassword,
  "Passwords must match",
  { fields: ["password", "confirmPassword"] }
)

// ❌ Bad: runs on every field change
.validate(
  (d) => d.password === d.confirmPassword,
  "Passwords must match"
)
```

### 4. Use Operation-Specific Validation

```typescript
// ✅ Good: create-only validation
.validate(
  (d) => d.startDate > new Date(),
  "Start date must be in the future",
  { operations: ["create"] }
)

// ❌ Bad: blocks valid updates
.validate(
  (d) => d.startDate > new Date(),
  "Start date must be in the future"
)
```

### 5. Handle Optional Fields

```typescript
// ✅ Good: account for null/undefined
.validate(
  (d) => !d.salePrice || d.salePrice < d.price,
  "Sale price must be less than regular price"
)

// ❌ Bad: crashes on null
.validate(
  (d) => d.salePrice < d.price,  // Error if salePrice is null
  "Sale price must be less than regular price"
)
```

## Next Steps

- [Field Validation](/fields/validation) - Single-field validation
- [Authorization Rules](/entities/authorization) - Access control
- [Defining Entities](/entities/defining) - Complete entity guide
