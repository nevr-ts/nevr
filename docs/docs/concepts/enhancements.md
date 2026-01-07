# Enhancements Pipeline

Nevr implements a powerful **Enhancement Pipeline** . This pipeline processes data automatically during read and write operations, ensuring security, validation, and transformations are applied consistently.

## The Pipeline

### Write Operations (Create / Update)
When you write data to the API, it flows through these steps:

1.  **Field Access Policy (Write)**: Checks if the user is allowed to write to specific fields. Fields that are not writable are stripped.
2.  **Transforms**: Applies modifiers like `trim()`, `lower()`, or `upper()`.
3.  **Field Validation**: detailed validation rules (e.g., `email()`, `min()`, regex) are checked.
4.  **Cross-Field Validation**: Rules that involve multiple fields are evaluated.
5.  **Security Processing**:
    *   **Password Hashing**: `password()` fields are automatically hashed.
    *   **Encryption**: `encrypted()` fields are encrypted using your configured key.

### Read Operations
When data is retrieved, it flows through:

1.  **Security Processing**:
    *   **Decryption**: Encrypted fields are decrypted.
    *   **Omission**: Fields marked with `omit()` (like passwords) are removed.
2.  **Field Access Policy (Read)**: Checks if the user is allowed to view specific fields. Hidden fields are stripped from the response.

## Enabling Enhancements

Enhancements are automatically enabled when you use the corresponding field modifiers.

### Security Enhancements
To verify passwords or initialize encryption:

```typescript
import { initEnhancements } from "nevr/enhancements"

// Initialize on startup
await initEnhancements({
  encryptionKey: process.env.ENCRYPTION_KEY
})
```

## Enhancement Summary
You can inspect an entity's enhancements at runtime:

```typescript
import { getEnhancementSummary } from "nevr/enhancements"

const summary = getEnhancementSummary(User)
console.log(summary)
// {
//   validation: ['email', 'age'],
//   security: { password: ['passwordHash'], encrypted: ['ssn'] }
//   ...
// }
```
