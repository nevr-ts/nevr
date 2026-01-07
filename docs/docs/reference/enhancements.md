# Enhancements API Reference

Complete reference for Nevr's enhancement pipeline functions.

## Pipeline Functions

### enhanceWriteData()

Process data before writing to database (transforms, validation, security).

```typescript
import { enhanceWriteData } from "nevr"

const processed = await enhanceWriteData(entity, data, {
  operation: "create",
  user: currentUser
})
```

### enhanceReadData() / enhanceReadDataArray()

Process data after reading from database (decryption, omission, access policies).

```typescript
import { enhanceReadData, enhanceReadDataArray } from "nevr"

const record = await enhanceReadData(entity, rawData, { user })
const records = await enhanceReadDataArray(entity, rawDataArray, { user })
```

### initEnhancements()

Initialize enhancement system (required for encryption).

```typescript
import { initEnhancements } from "nevr"

await initEnhancements({
  encryptionKey: process.env.ENCRYPTION_KEY
})
```

---

## Validation Functions

| Function | Description |
|----------|-------------|
| `validateField(field, value)` | Validate single field |
| `validateData(entity, data)` | Validate all fields |
| `getValidationSchema(entity)` | Get validation schema |
| `FieldValidationError` | Error class |
| `FieldValidationErrors` | Multiple errors class |

---

## Transform Functions

| Function | Description |
|----------|-------------|
| `transformField(field, value)` | Transform single field |
| `transformData(entity, data)` | Transform all fields |
| `hasTransforms(entity)` | Check if entity has transforms |
| `getTransformFields(entity)` | Get fields with transforms |

---

## Security Functions

| Function | Description |
|----------|-------------|
| `hashPassword(password)` | Hash password (scrypt) |
| `verifyPassword(password, hash)` | Verify password |
| `encryptValue(value)` | Encrypt field value |
| `decryptValue(encrypted)` | Decrypt field value |
| `initEncryption(key)` | Initialize encryption |
| `generateEncryptionKey()` | Generate new key |
| `getPasswordFields(entity)` | Get password fields |
| `getOmitFields(entity)` | Get omitted fields |
| `getEncryptedFields(entity)` | Get encrypted fields |

---

## Cross-Field Validation

| Function | Description |
|----------|-------------|
| `validateCrossFields(entity, data, ctx)` | Run cross-field validators |
| `hasCrossFieldValidators(entity)` | Check for validators |
| `getValidators(entity)` | Get all validators |
| `getValidatorsForOperation(entity, op)` | Get by operation |
| `CrossFieldValidationError` | Error class |

---

## Field Access Policies

| Function | Description |
|----------|-------------|
| `evaluatePolicy(policy, ctx)` | Evaluate single policy |
| `canReadField(entity, field, ctx)` | Check read access |
| `canWriteField(entity, field, ctx)` | Check write access |
| `filterReadableFields(entity, data, ctx)` | Filter by read policy |
| `filterWritableFields(entity, data, ctx)` | Filter by write policy |
| `hasFieldAccessPolicies(entity)` | Check for policies |
| `getFieldAccessSummary(entity)` | Get policy summary |

---

## Enhanced Driver

### createEnhancedDriver()

Wrap a driver to automatically apply enhancements.

```typescript
import { createEnhancedDriver, prisma } from "nevr"

const driver = createEnhancedDriver(prisma(db), {
  entities: [user, post],
  user: currentUser
})
```

### Helper Functions

| Function | Description |
|----------|-------------|
| `isEnhancedDriver(driver)` | Check if enhanced |
| `getBaseDriver(driver)` | Get underlying driver |

---

## See Also

- [Enhancements Concept](/concepts/enhancements)
- [Security](/fields/security)
- [Validation](/fields/validation)
