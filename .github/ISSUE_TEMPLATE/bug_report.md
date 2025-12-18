---
name: Bug Report
about: Report a bug to help us improve Zapi
title: "[Bug]: "
labels: bug
assignees: ''

---

## Describe the Bug

A clear and concise description of what the bug is.

## To Reproduce

Steps to reproduce the behavior:

1. Define entity with '...'
2. Call '...'
3. See error

## Expected Behavior

A clear and concise description of what you expected to happen.

## Code Example

```typescript
// Minimal code to reproduce the issue
import { entity, string } from "@zapi-ts/core"

const user = entity("user", {
  name: string
})
```

## Error Output

```
Paste any error messages here
```

## Environment

- **OS**: [e.g., Windows 11, macOS 14, Ubuntu 22.04]
- **Node.js version**: [e.g., 20.10.0]
- **Zapi version**: [e.g., 0.1.0-beta.1]
- **Adapter**: [e.g., Express, Hono]
- **Database**: [e.g., SQLite, PostgreSQL]

## Additional Context

Add any other context about the problem here.
