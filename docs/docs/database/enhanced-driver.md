# Enhanced Driver

The Enhanced Driver wraps your base database driver with automatic data processing - validation, transforms, security, cross-field validation, and field access policies.

## Overview

Data flows through the enhancement pipeline automatically:

```
Write (create/update):
Input → Field Access → Transforms → Validation → Cross-Field Validation → Security → Database

Read (findOne/findMany):
Database → Security (decrypt/omit) → Field Access (filter readable) → Output
```

---

## Creating an Enhanced Driver

```typescript
import { createEnhancedDriver } from "nevr"
import { prisma } from "nevr/drivers/prisma"

const baseDriver = prisma(new PrismaClient())

const driver = createEnhancedDriver(baseDriver, {
  encryptionKey: process.env.ENCRYPTION_KEY,
})
```

Or let Nevr create it automatically:

```typescript
import { nevr } from "nevr"

const api = nevr({
  entities: [user, post],
  driver: prisma(db),
  enhancements: {
    encryptionKey: process.env.ENCRYPTION_KEY,
  },
})
```

---

## Enhancement Pipeline

### Write Pipeline (create/update)

| Step | Description | Methods |
|------|-------------|---------|
| 1. Field Access | Filter writable fields based on policies | `.writable()`, `.adminOnly()` |
| 2. Transforms | Apply data transformations | `.trim()`, `.lower()`, `.upper()` |
| 3. Validation | Validate field constraints | `.email()`, `.min()`, `.max()`, `.validate()` |
| 4. Cross-Field | Validate relationships between fields | `@@validate()` |
| 5. Security | Hash passwords, encrypt sensitive data | `.password()`, `.encrypted()` |

### Read Pipeline (findOne/findMany)

| Step | Description | Methods |
|------|-------------|---------|
| 1. Security | Decrypt encrypted fields, omit secure fields | `.encrypted()`, `.omit()` |
| 2. Field Access | Filter readable fields based on policies | `.readable()`, `.ownerReadable()` |

---

## EnhancedDriverOptions

```typescript
interface EnhancedDriverOptions {
  /** Encryption key for .encrypted() fields (base64 or Uint8Array) */
  encryptionKey?: string | Uint8Array

  /** Skip validation (not recommended) */
  skipValidation?: boolean

  /** Skip transforms */
  skipTransforms?: boolean

  /** Skip security processing */
  skipSecurity?: boolean

  /** Skip cross-field validation */
  skipCrossFieldValidation?: boolean

  /** Skip field access policies */
  skipFieldAccess?: boolean
}
```

---

## Usage Examples

### Basic Enhanced Driver

```typescript
const user = entity("user", {
  email: string.email().lower().trim().unique(),
  password: string.min(8).password().omit(),
  name: string.trim(),
})

const driver = createEnhancedDriver(prisma(db), {
  encryptionKey: process.env.ENCRYPTION_KEY,
})

// Create - enhanced automatically
await driver.create("user", {
  email: "  JOHN@EXAMPLE.COM  ",  // → "john@example.com"
  password: "secret123",           // → hashed with scrypt
  name: "  John Doe  ",           // → "John Doe"
})

// Read - enhanced automatically
const user = await driver.findOne("user", { email: "john@example.com" })
// password is NOT in result (omitted)
```

### With Encryption

```typescript
const patient = entity("patient", {
  name: string,
  ssn: string.encrypted(),
  medicalNotes: text.encrypted(),
})

// On write - encrypted with AES-256-GCM
await driver.create("patient", {
  name: "Jane Doe",
  ssn: "123-45-6789",
  medicalNotes: "Patient history...",
})

// On read - decrypted automatically
const patient = await driver.findOne("patient", { name: "Jane Doe" })
console.log(patient.ssn) // "123-45-6789" (decrypted)
```

### With Field Access Policies

```typescript
const employee = entity("employee", {
  name: string,
  email: string.email(),
  salary: int.readable("admin"),     // Only admin can read
  ssn: string.readable("owner"),     // Only owner can read
  notes: text.writable("admin"),     // Only admin can write
})

// With user context
const result = await driver.findOne("employee", { id: "emp_123" }, {
  user: { id: "emp_123", role: "user" },
})
// result.salary = undefined (not admin)
// result.ssn = "xxx-xx-xxxx" (is owner, so visible)
```

---

## Helper Functions

### Checking Driver Type

```typescript
import { isEnhancedDriver, getBaseDriver } from "nevr"

if (isEnhancedDriver(driver)) {
  console.log("Using enhanced driver")
}

// Get the underlying base driver
const baseDriver = getBaseDriver(driver)
```

### Password Utilities

```typescript
import { hashPassword, verifyPassword } from "nevr"

// Hash a password manually
const hash = await hashPassword("mypassword", 12) // 12 rounds

// Verify password
const isValid = await verifyPassword("mypassword", hash)
```

### Encryption Utilities

```typescript
import {
  initEncryption,
  generateEncryptionKey,
} from "nevr"

// Generate a secure encryption key
const key = await generateEncryptionKey()
console.log(key) // Base64 encoded 256-bit key

// Initialize encryption manually
await initEncryption(process.env.ENCRYPTION_KEY)
```

---

## Enhancement Functions

Use enhancement functions directly without the driver:

```typescript
import {
  enhanceWriteData,
  enhanceReadData,
  enhanceReadDataArray,
} from "nevr"

// Enhance data before writing
const enhancedData = await enhanceWriteData(inputData, entity, "create", {
  user: currentUser,
  skipValidation: false,
})

// Enhance single record after reading
const enhancedRecord = await enhanceReadData(record, entity, {
  user: currentUser,
})

// Enhance array of records
const enhancedRecords = await enhanceReadDataArray(records, entity, {
  user: currentUser,
})
```

### EnhancementOptions

```typescript
interface EnhancementOptions {
  /** Skip validation */
  skipValidation?: boolean
  /** Skip transforms */
  skipTransforms?: boolean
  /** Skip security processing */
  skipSecurity?: boolean
  /** Skip cross-field validation */
  skipCrossFieldValidation?: boolean
  /** Skip field access policies */
  skipFieldAccess?: boolean
  /** Current user for access policy evaluation */
  user?: User | null
  /** Existing data for updates */
  existingData?: Record<string, unknown>
  /** Resource ID for access policy evaluation */
  resourceId?: string
}
```

---

## Utility Functions

### Check for Enhancements

```typescript
import {
  hasEnhancements,
  getEnhancementSummary,
} from "nevr"

// Check if entity has any enhancements
if (hasEnhancements(userEntity)) {
  console.log("Entity has enhancements")
}

// Get detailed enhancement summary
const summary = getEnhancementSummary(userEntity)
console.log(summary)
// {
//   validation: ["email", "password"],
//   transforms: ["email", "name"],
//   security: {
//     password: ["password"],
//     omit: ["password"],
//     encrypted: ["ssn"]
//   },
//   access: {
//     read: ["salary"],
//     write: ["notes"]
//   },
//   crossFieldValidators: 2
// }
```

---

## Full Example

```typescript
import { entity, string, int, text, datetime, nevr } from "nevr"
import { createEnhancedDriver } from "nevr"
import { prisma } from "nevr/drivers/prisma"

// Define entity with all enhancement types
const user = entity("user", {
  // Transforms + Validation
  email: string
    .trim()
    .lower()
    .email("Invalid email format")
    .unique(),

  // Security - password hashing
  password: string
    .min(8, "Password must be 8+ characters")
    .password()  // scrypt hash on write
    .omit(),     // never return in responses

  // Transforms
  name: string.trim().min(2).max(100),

  // Security - encryption
  ssn: string
    .regex(/^\d{3}-\d{2}-\d{4}$/, "Invalid SSN format")
    .encrypted()  // AES-256-GCM encryption
    .readable("owner", "admin"),  // Only owner/admin can read

  // Field access
  salary: int
    .gte(0)
    .readable("admin")   // Only admin can read
    .writable("admin"),  // Only admin can write

  // Internal field
  internalNotes: text
    .omit()  // Never return in responses
    .writable("admin"),

  role: string.default("user"),
  createdAt: datetime.default(() => new Date()),
})
  // Cross-field validation
  .validate(
    (data) => {
      if (data.role === "admin" && !data.email?.endsWith("@company.com")) {
        return false
      }
      return true
    },
    "Admin users must have company email",
    { operations: ["create", "update"], fields: ["role", "email"] }
  )

// Create enhanced driver
const driver = createEnhancedDriver(prisma(db), {
  encryptionKey: process.env.ENCRYPTION_KEY,
})

// All enhancements happen automatically
await driver.create("user", {
  email: "  ADMIN@COMPANY.COM  ",  // → trimmed, lowercased, validated
  password: "securepass123",        // → scrypt hashed
  name: "  Admin User  ",          // → trimmed
  ssn: "123-45-6789",              // → encrypted
  salary: 100000,
  role: "admin",
})
```

---

## Next Steps

- [Validation](/fields/validation) - Field validation rules
- [Transforms](/fields/transforms) - Data transformation
- [Security](/fields/security) - Password and encryption
- [Access Policies](/fields/access-policies) - Field-level permissions
- [Cross-Field Validation](/entities/cross-field-validation) - Multi-field rules
