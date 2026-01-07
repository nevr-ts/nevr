# Contributing to Nevr

Thank you for your interest in contributing to Nevr! This guide will help you get started.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)

---

## 📜 Code of Conduct

Be respectful and inclusive. We're all here to build something great together.

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** (recommended) or npm

### Clone and Install

```bash
git clone https://github.com/nevr-ts/nevr.git
cd nevr
pnpm install
```

### Build

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev
```

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests once (CI mode)
pnpm test:run

# Run specific test file
pnpm test src/entity.test.ts
```

---

## 📁 Project Structure

```
nevr/
├── packages/
│   └── nevr/                 # Core package
│       ├── src/
│       │   ├── adapters/     # HTTP framework adapters (Express, Hono)
│       │   ├── client/       # Type-safe client SDK
│       │   ├── drivers/      # Database drivers (Prisma)
│       │   ├── enhancements/ # Field enhancements (validation, access)
│       │   ├── plugins/      # Plugin system
│       │   │   ├── auth/     # Authentication plugin
│       │   │   ├── core/     # Plugin core (contracts, inference)
│       │   │   ├── payments/ # Payments plugin
│       │   │   ├── storage/  # Storage plugin
│       │   │   └── unified/  # Unified plugin system
│       │   ├── entity.ts     # Entity builder
│       │   ├── fields.ts     # Field DSL builders
│       │   ├── nevr.ts       # Main factory
│       │   ├── types.ts      # Core type definitions
│       │   └── index.ts      # Public exports
│       ├── dist/             # Compiled output
│       └── package.json
```

---

## ✏️ Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/bug-description
```

### 2. Make Your Changes

- Follow the existing code style
- Add TypeScript types for all new code
- Write tests for new functionality
- Update documentation if needed

### 3. Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add new field type for UUID
fix: correct validation for email fields
docs: update README with new examples
chore: update dependencies
refactor: simplify entity builder
test: add tests for workflow engine
```

---

## 🧪 Testing

### Test Structure

Tests are co-located with source files:

```
src/
├── entity.ts
├── entity.test.ts      # Tests for entity.ts
├── fields.ts
├── fields.test.ts
└── plugins/
    ├── auth/
    │   ├── index.ts
    │   └── auth.test.ts
```

### Writing Tests

We use [Vitest](https://vitest.dev/):

```typescript
import { describe, it, expect } from "vitest"
import { entity, string } from "../index.js"

describe("Entity Builder", () => {
  it("should create entity with fields", () => {
    const user = entity("user", {
      name: string,
    }).build()
    
    expect(user.name).toBe("user")
    expect(user.config.fields.name).toBeDefined()
  })
})
```

### Test Requirements

- All new features must have tests
- All bug fixes should include a regression test
- Maintain >80% code coverage for new code

---

## 🔀 Pull Request Process

### 1. Before Submitting

- [ ] All tests pass (`pnpm test:run`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Code follows style guidelines
- [ ] Documentation updated if needed

### 2. PR Description

Include:
- What this PR does
- Why it's needed
- Any breaking changes
- Related issues (e.g., `Fixes #123`)

### 3. Review Process

1. A maintainer will review your PR
2. Address any feedback
3. Once approved, a maintainer will merge

---

## 🎨 Code Style

### TypeScript

- Use **strict TypeScript** (`strict: true`)
- Prefer `interface` over `type` for objects
- Use `const` and `let`, never `var`
- Explicit return types for public functions

```typescript
// ✅ Good
export function createEntity(name: string): Entity {
  return { name, fields: {} }
}

// ❌ Avoid
export function createEntity(name) {
  return { name, fields: {} }
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables/Functions | camelCase | `createEntity`, `fieldBuilder` |
| Types/Interfaces | PascalCase | `EntityConfig`, `FieldDef` |
| Constants | SCREAMING_SNAKE | `DEFAULT_TIMEOUT`, `AUTH_ERROR_CODES` |
| Files | kebab-case | `entity-builder.ts`, `field-types.ts` |

### Imports

```typescript
// External imports first
import { PrismaClient } from "@prisma/client"

// Then internal imports (with .js extension)
import { Entity, FieldDef } from "./types.js"
import { createHookContext } from "./hooks.js"
```

### Comments

```typescript
// Single-line comments for brief explanations

/**
 * Multi-line JSDoc for public APIs
 * @param name - Entity name
 * @returns Configured entity
 */
export function createEntity(name: string): Entity {
  // Implementation details
}
```

---

## 🏛️ Architecture Guidelines

### Entity-First Principle

Everything starts with entities:

```typescript
// ✅ Define behavior at the entity level
const user = entity("user", {
  password: string.password().omit(),  // Security built-in
})

// ❌ Don't add behavior at runtime arbitrarily
```

### Plugin System

Use the unified plugin system for extensions:

```typescript
import { createUnifiedPlugin } from "nevr/plugins"

export const myPlugin = createUnifiedPlugin({
  meta: { id: "my-plugin", name: "My Plugin" },
  schema: { entities: { ... } },
  lifecycle: { onInit: () => { ... } },
})
```

### Type Safety

Leverage TypeScript inference:

```typescript
// ✅ Let TypeScript infer when possible
const user = entity("user", { name: string }).build()

// Types are inferred automatically
type User = typeof user["$Infer"]
```

---

## 💬 Getting Help

- Open an [issue](https://github.com/nevr-ts/nevr/issues) for bugs
- Start a [discussion](https://github.com/nevr-ts/nevr/discussions) for questions
- Check existing issues/discussions first

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
