# Timestamps Plugin

The Timestamps plugin is a simple utility that adds `createdAt` and `updatedAt` fields to your entities automatically.

## Usage

```typescript
import { timestamps } from "nevr/plugins/timestamps"

const api = nevr({
  entities: [/* ... */],
  driver: /* ... */,
  plugins: [
    timestamps()
  ]
})
```

## Effect

Every entity in your application will now have:

- `createdAt`: DateTime (default: now)
- `updatedAt`: DateTime (updated automatically)

You do not need to define these fields manually in your entity definitions.
