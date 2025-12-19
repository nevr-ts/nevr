# Installation

## Prerequisites

- Node.js 18+
- npm, pnpm, or bun

## Automatic Setup (Recommended)

The easiest way to start is with the CLI scaffolder:

```bash
npm create nevr@latest my-api
# or
pnpm create nevr my-api
# or
bun create nevr my-api
```

Follow the prompts to select your database (SQLite, PostgreSQL, MySQL).

## Manual Setup

If you want to add Nevr to an existing project:

1.  **Install core packages:**

    ```bash
    npm install nevr @nevr/generator @prisma/client prisma express
    npm install -D typescript tsx @types/node @types/express
    ```

2.  **Initialize TypeScript:**

    ```bash
    npx tsc --init
    ```

3.  **Create your first entity:**

    Create `src/entities/user.ts`:

    ```typescript
    import { entity, string } from "nevr"

    export const user = entity("user", {
      name: string,
      email: string.unique(),
    })
    ```

4.  **Create a generator script:**

    Create `src/generate.ts`:

    ```typescript
    import { generate } from "@nevr/generator"
    import { user } from "./entities/user"

    generate([user], {
      outDir: "./generated",
      prismaProvider: "sqlite"
    })
    ```

5.  **Run generation:**

    ```bash
    npx tsx src/generate.ts
    npx prisma db push --schema=generated/prisma/schema.prisma
    ```
