# Architecture
> Nevr uses a layered architecture with clear separation of concerns.

## Overview

```
┌─────────────────────────────────────────┐
│           HTTP Framework                │
│        (Express, Hono, etc.)            │
├─────────────────────────────────────────┤
│              Adapters                   │
│    (expressAdapter, etc.)         │
├─────────────────────────────────────────┤
│              NEVR CORE                  │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │Entities │ │Workflows│ │ Services │  │
│  ├─────────┤ ├─────────┤ ├──────────┤  │
│  │ Actions │ │ Plugins │ │ Remote   │  │
│  │  Rules  │ │  Hooks  │ │ Joiner   │  │
│  └─────────┘ └─────────┘ └──────────┘  │
├─────────────────────────────────────────┤
│         Enhanced Driver                 │
│   (Validation, Transforms, Security)    │
├─────────────────────────────────────────┤
│             Database Driver             │
│           (Prisma, Drizzle)             │
└─────────────────────────────────────────┘
```

## Layers

### 1. Adapters Layer

Converts HTTP framework requests to Nevr's internal format.

```typescript
import { expressAdapter } from "nevr/adapters/express"
import { honoAdapter} from "nevr/adapters/hono"
```

### 2. Core Layer

The heart of Nevr:

| Component | Purpose |
|-----------|---------|
| **Entities** | Data model definitions |
| **Actions** | Custom operations |
| **Workflows** | Multi-step with saga |
| **Services** | Dependency injection |
| **Plugins** | Reusable extensions |
| **Remote Joiner** | External data stitching |

### 3. Enhancement Layer

Automatic data processing:

- **Validation** - Field and cross-field validation
- **Transforms** - Data transformation (trim, lowercase)
- **Security** - Password hashing, encryption, field omission

### 4. Driver Layer

Database abstraction:

```typescript
import { prisma } from "nevr/drivers/prisma"

const driver = prisma(new PrismaClient())
```

## Request Flow

```
Request → Adapter → Router → Middleware → Hooks → Handler → Driver → Response
```

1. **Adapter** converts HTTP request
2. **Router** matches entity/action
3. **Middleware** processes (auth, logging)
4. **Hooks** fire (beforeCreate, etc.)
5. **Handler** executes operation
6. **Driver** interacts with database
7. **Response** returned through adapter

## Next Steps

- [Entity-First Design](/concepts/entity-first)
- [Type Safety](/concepts/type-safety)
