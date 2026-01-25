# Field Security

> Nevr provides built-in security features for sensitive data: password hashing, field omission from responses, and encryption at rest. These features are applied automatically during read/write operations.

## Password Hashing

### password()

Automatically hashes the field value using PBKDF2 before storing. The original value is never saved.

PBKDF2 is built into Node.js (zero dependencies) and provides predictable performance with strong security.

```typescript
import { entity, string } from "nevr"

const user = entity("user", {
  email: string.unique(),

  // Hashed with PBKDF2 (cost 10 by default)
  password: string.password(),
})
```

**How it works:**
1. User submits: `"mySecretPassword123"`
2. PBKDF2 hashes it: `"$pbkdf2$1024000$base64salt$base64hash"`
3. Hash stored in database
4. Original password never stored

### Cost Levels

```typescript
const user = entity("user", {
  // Default: cost 10 (recommended for production)
  password: string.password(),

  // Fast - for development/testing
  password: string.password({ cost: 8 }),

  // High security - for sensitive applications
  password: string.password({ cost: 12 }),
})
```

**Cost levels trade-off:**
| Cost | Iterations | Time | Use Case |
|------|------------|------|----------|
| 8 | 256,000 | ~100ms | Development/testing |
| 10 | 1,024,000 | ~400ms | Production (default) |
| 12 | 4,096,000 | ~1.6s | High security |
| 14 | 16,384,000 | ~6s | Maximum security |

::: tip
Use the default (cost 10) for most applications. Use cost 8 for development to speed up tests. Only increase cost for highly sensitive applications.
:::

### Password with Validation

```typescript
const user = entity("user", {
  password: string
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .validate(
      (v) => {
        const pwd = String(v)
        return /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
      },
      "Password must contain uppercase letter and number"
    )
    .password()
    .omit(),  // Never return in responses
})
```

---

## Omitting Fields

### omit()

Prevents the field from being included in API responses. The field is stored and can be used internally, but never returned to clients.

```typescript
const user = entity("user", {
  email: string.unique(),

  // Never returned in responses
  password: string.password().omit(),
  passwordResetToken: string.optional().omit(),

  // Visible fields
  name: string,
  createdAt: datetime,
})
```

**API Response:**
```json
{
  "id": "usr_123",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-15T10:30:00Z"
}
// Note: password and passwordResetToken are NOT included
```

### Use Cases for omit()

```typescript
const user = entity("user", {
  // Sensitive authentication data
  password: string.password().omit(),
  passwordResetToken: string.optional().omit(),
  twoFactorSecret: string.optional().omit(),

  // Internal tracking
  lastLoginIp: string.optional().omit(),
  failedLoginAttempts: int.default(0).omit(),

  // API keys (show hash only on creation)
  apiKeyHash: string.optional().omit(),
})
```

---

## Encryption at Rest

### encrypted()

Encrypts the field value using AES-256-GCM before storing. Decrypted automatically when reading.

```typescript
const user = entity("user", {
  // Encrypted at rest
  ssn: string.encrypted(),
  creditCardNumber: string.encrypted(),
  taxId: string.encrypted().optional(),
})
```

**How it works:**
1. User submits: `"123-45-6789"`
2. Encrypted with AES-256-GCM: `"encrypted:iv:authTag:ciphertext"`
3. Encrypted value stored in database
4. Decrypted automatically when retrieved

### Setting Up Encryption

Encryption requires a secret key. Configure it when initializing Nevr:

```typescript
import { nevr, initEncryption } from "nevr"

// Initialize encryption with a 32-byte key
initEncryption({
  key: process.env.ENCRYPTION_KEY!, // 32-byte hex string
})

const api = nevr({
  entities: [user, order],
  // ... other config
})
```

### Generating an Encryption Key

```typescript
import { generateEncryptionKey } from "nevr"

// Generate a secure random key
const key = generateEncryptionKey()
console.log(key) // 64-character hex string

// Store this in your environment variables
// ENCRYPTION_KEY=a1b2c3d4e5f6...
```

::: warning
Never commit encryption keys to version control. Use environment variables or a secrets manager.
:::

### Encryption + Access Policies

Combine encryption with access policies for defense in depth:

```typescript
const employee = entity("employee", {
  name: string,

  // Encrypted AND admin-only
  ssn: string
    .encrypted()      // Encrypted at rest
    .readable("admin") // Only admins can read
    .writable("admin"), // Only admins can write

  // Encrypted AND owner-readable
  salary: float
    .encrypted()
    .readable("owner")
    .writable("admin"),
})
```

---

## Combining Security Features

### Full Security Chain

```typescript
const user = entity("user", {
  email: string.trim().lower().email().unique(),

  // Complete password security
  password: string
    .min(8, "Password too short")
    .validate(
      (v) => /[A-Z]/.test(String(v)) && /[0-9]/.test(String(v)),
      "Must contain uppercase and number"
    )
    .password()      // Hash with PBKDF2
    .omit(),         // Never return

  // Encrypted sensitive data
  dateOfBirth: string.encrypted().optional(),

  // Internal tokens (encrypted + omitted)
  refreshToken: string.encrypted().omit().optional(),
})
```

### Multiple Security Layers

```typescript
const payment = entity("payment", {
  userId: belongsTo(() => user),
  amount: float,
  currency: string.default("USD"),

  // Card data: encrypted + omitted + admin-only
  cardLast4: string.omit(),
  cardFingerprint: string.encrypted().omit(),

  // Transaction data: encrypted
  transactionId: string.encrypted(),

  // Status visible to owner
  status: string.default("pending"),
})
```

---

## Key Rotation

For production systems, you should periodically rotate encryption keys. Nevr supports seamless key rotation without downtime.

### How It Works

1. Register a new key alongside the old one
2. Set the new key as primary (used for new encryptions)
3. Existing data remains readable (decrypted with old key)
4. Optionally re-encrypt existing data with the new key
5. Remove the old key when all data is migrated

### Rotating Keys

```typescript
import {
  initEncryption,
  registerEncryptionKey,
  setPrimaryEncryptionKey,
  reEncryptRecord,
} from "nevr"

// Step 1: Initialize with current key
await initEncryption(process.env.ENCRYPTION_KEY_V1!, "v1")

// Step 2: Register new key
await registerEncryptionKey(process.env.ENCRYPTION_KEY_V2!, "v2")

// Step 3: Set new key as primary (new data uses v2)
setPrimaryEncryptionKey("v2")

// Step 4: Re-encrypt existing records (optional but recommended)
const records = await db.findMany("user")
for (const record of records) {
  const { data, reEncryptedCount } = await reEncryptRecord(record, userEntity)
  if (reEncryptedCount > 0) {
    await db.update("user", { id: record.id }, data)
  }
}
```

### Key Rotation API

| Function | Description |
|----------|-------------|
| `registerEncryptionKey(key, keyId)` | Register additional key |
| `setPrimaryEncryptionKey(keyId)` | Set key for new encryptions |
| `getRegisteredKeyIds()` | List all registered key IDs |
| `reEncryptValue(encrypted)` | Re-encrypt with primary key |
| `reEncryptRecord(data, entity)` | Re-encrypt all fields in record |
| `getEncryptionKeyId(encrypted)` | Get key ID from encrypted value |
| `removeEncryptionKey(keyId)` | Remove old key (after migration) |

### Encrypted Data Format

New encryptions include the key ID for automatic key selection:

```
v2:base64(iv + ciphertext + authTag)
```

Legacy data (without key ID) is decrypted by trying all registered keys.

::: tip
Run key rotation during low-traffic periods. The re-encryption process is CPU-intensive.
:::

---

## Security Reference

| Method | Description | Use Case |
|--------|-------------|----------|
| `.password()` | Hash with PBKDF2 (cost 10) | User passwords |
| `.password({ cost: N })` | Hash with custom cost (8-14) | Performance tuning |
| `.omit()` | Exclude from responses | Sensitive data |
| `.encrypted()` | AES-256-GCM encryption | PII, financial data |

---

## Examples

### User Authentication

```typescript
const user = entity("user", {
  // Public info
  email: string.trim().lower().email().unique(),
  username: string.trim().lower().unique(),
  displayName: string.trim(),
  avatar: string.url().optional(),

  // Password with full security
  password: string
    .min(8, "Minimum 8 characters")
    .max(128, "Maximum 128 characters")
    .password({ cost: 2 })
    .omit(),

  // Password reset (encrypted + omitted)
  passwordResetToken: string.encrypted().omit().optional(),
  passwordResetExpiry: datetime.omit().optional(),

  // 2FA secret (encrypted + omitted)
  twoFactorSecret: string.encrypted().omit().optional(),
  twoFactorEnabled: boolean.default(false),

  // Internal tracking (omitted)
  lastLoginAt: datetime.omit().optional(),
  lastLoginIp: string.omit().optional(),
  failedLoginAttempts: int.default(0).omit(),
})
```

### Employee Records

```typescript
const employee = entity("employee", {
  // Basic info
  name: string,
  email: string.email().unique(),
  department: string,

  // PII - encrypted with access control
  ssn: string
    .encrypted()
    .readable("admin")
    .writable("admin"),

  dateOfBirth: string
    .encrypted()
    .readable("admin"),

  // Salary - encrypted with owner access
  salary: float
    .encrypted()
    .readable("owner")
    .writable("admin"),

  // Bank details - encrypted + omitted
  bankAccount: string.encrypted().omit(),
  bankRouting: string.encrypted().omit(),
})
```

### API Keys

```typescript
const apiKey = entity("apiKey", {
  userId: belongsTo(() => user),
  name: string.max(100),

  // Store only the hash (never the original)
  keyHash: string.omit(),

  // Key prefix for identification
  keyPrefix: string, // "sk_live_abc..."

  // Metadata
  lastUsedAt: datetime.optional(),
  expiresAt: datetime.optional(),
  isActive: boolean.default(true),
})
```

### Health Records

```typescript
const healthRecord = entity("healthRecord", {
  patientId: belongsTo(() => patient),

  // All health data encrypted
  diagnosis: text.encrypted(),
  medications: jsonTyped<string[]>().encrypted().default([]),
  allergies: jsonTyped<string[]>().encrypted().default([]),
  notes: text.encrypted().optional(),

  // Access restricted
  provider: string.readable("admin"),
  visitDate: datetime,
})
```

---

## Best Practices

### 1. Always hash passwords

```typescript
// Good
password: string.password().omit()

// Bad - password stored in plain text!
password: string
```

### 2. Combine password hashing with omit

```typescript
// Good - hashed AND hidden
password: string.password().omit()

// Not ideal - hashed but hash is visible in responses
password: string.password()
```

### 3. Encrypt PII and financial data

```typescript
// Good
ssn: string.encrypted()
creditCard: string.encrypted()

// Bad - sensitive data in plain text
ssn: string
```

### 4. Use environment variables for keys

```typescript
// Good
initEncryption({ key: process.env.ENCRYPTION_KEY })

// Bad - key in code
initEncryption({ key: "hardcoded-key-123" })
```

### 5. Layer security features

```typescript
// Defense in depth
sensitiveData: string
  .encrypted()        // Layer 1: Encrypted at rest
  .readable("admin")  // Layer 2: Access control
  .omit()             // Layer 3: Never in responses
```

## Next Steps

- [Access Policies](/fields/access-policies) - Field-level permissions
- [Validation](/fields/validation) - Input validation rules
- [Relations](/fields/relations) - Entity relationships

