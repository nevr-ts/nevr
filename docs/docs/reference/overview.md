# API Reference Overview

Complete API reference for Nevr. This page provides a comprehensive index of all public exports.

## Quick Import Guide

```typescript
// Core functionality
import { nevr, entity, action, step } from "nevr"

// Field types
import { string, text, int, float, bool, datetime, json, email } from "nevr"

// Relations
import { belongsTo, hasMany, hasOne, selfRef } from "nevr"

// Pre-built actions
import { softDeleteAction, restoreAction, cloneAction, toggleAction } from "nevr"

// Rules
import { everyone, authenticated, owner, admin, defineRule } from "nevr"

// Errors
import { NevrErrorClass, validationError, notFoundError } from "nevr"

// Plugins
import { createPlugin, endpoint } from "nevr"

// Services (DI)
import { ServiceContainer, createService } from "nevr"

// Workflow
import { workflow, runWorkflow } from "nevr"

// Logger & Utils
import { getLogger, setLogger, capitalize, pascalCase } from "nevr"

// Drivers & Adapters (subpath imports)
import { prisma } from "nevr/drivers/prisma"
import { expressAdapter } from "nevr/adapters/express"
```

---

## Core Functions

| Function | Description | Link |
|----------|-------------|------|
| `nevr(config)` | Create Nevr instance | [Reference](/reference/nevr) |
| `entity(name, fields)` | Define entity | [Reference](/reference/entity) |
| `action(name?)` | Create custom action | [Reference](/reference/actions) |
| `step(name, execute, compensate?)` | Create workflow step | [Reference](/reference/workflow#step-helper) |
| `workflow(name)` | Create workflow definition | [Reference](/reference/workflow) |
| `ServiceContainer()` | Create service container | [Reference](/reference/container) |
| `resolveEntity(entity)` | Resolve entity builder to entity | [Reference](/reference/entity) |

---

## Field Types

| Type | TypeScript | Database | Link |
|------|------------|----------|------|
| `string` | `string` | `VARCHAR(255)` | [Reference](/reference/fields#string) |
| `text` | `string` | `TEXT` | [Reference](/reference/fields#text) |
| `int` | `number` | `INTEGER` | [Reference](/reference/fields#int) |
| `float` | `number` | `DOUBLE` | [Reference](/reference/fields#float) |
| `boolean` / `bool` | `boolean` | `BOOLEAN` | [Reference](/reference/fields#boolean) |
| `datetime` | `Date` | `TIMESTAMP` | [Reference](/reference/fields#datetime) |
| `json` | `unknown` | `JSON/JSONB` | [Reference](/reference/fields#json) |
| `jsonTyped<T>()` | `T` | `JSON/JSONB` | [Reference](/reference/fields#jsontyped) |
| `email` | `string` | `VARCHAR(255)` | [Reference](/reference/fields#email) |

See [Fields Reference](/reference/fields) for all methods.

---

## Relations

| Function | Description | Example |
|----------|-------------|---------|
| `belongsTo(() => Entity)` | Many-to-one relation | `author: belongsTo(() => user)` |
| `hasMany(() => Entity)` | One-to-many relation | `posts: hasMany(() => post)` |
| `hasOne(() => Entity)` | One-to-one relation | `profile: hasOne(() => profile)` |
| `selfRef()` | Self-referential relation | `parent: selfRef().optional()` |

---

## Pre-built Actions

| Function | Endpoint | Description |
|----------|----------|-------------|
| `softDeleteAction(field?)` | `DELETE /:id/soft` | Soft delete with timestamp |
| `restoreAction(field?)` | `POST /:id/restore` | Restore soft-deleted record |
| `archiveAction()` | `POST /:id/archive` | Set archived = true |
| `unarchiveAction()` | `POST /:id/unarchive` | Set archived = false |
| `cloneAction(exclude?)` | `POST /:id/clone` | Duplicate record |
| `bulkUpdateAction()` | `PUT /bulk` | Update multiple records |
| `bulkDeleteAction()` | `DELETE /bulk` | Delete multiple records |
| `toggleAction(field)` | `POST /:id/toggle-{field}` | Toggle boolean field |
| `exportAction()` | `GET /export` | Export as JSON/CSV |
| `countAction()` | `GET /count` | Count records |
| `existsAction()` | `GET /:id/exists` | Check if record exists |

---

## Authorization Rules

| Rule | Description |
|------|-------------|
| `everyone` | No authentication required |
| `authenticated` | Must be logged in |
| `owner` | Must own the resource |
| `admin` | Must have admin role |
| `ownerOrAdmin` | Owner or admin |
| `defineRule(name, fn)` | Create custom rule |

---

## Drivers

| Driver | Import | Description |
|--------|--------|-------------|
| `prisma(client)` | `nevr/drivers/prisma` | Prisma ORM driver |

---

## Adapters

| Adapter | Import | Description |
|---------|--------|-------------|
| `expressAdapter(app)` | `nevr/adapters/express` | Express.js adapter |
| `honoAdapter(app)` | `nevr/adapters/hono` | Hono adapter |

---

## Plugin Functions

| Function | Description |
|----------|-------------|
| `createPlugin(options)` | Create a plugin (recommended) |
| `createPluginFactory(fn)` | Create configurable plugin |
| `endpoint(path, config)` | Define typed endpoint |
| `detectPluginType(plugin)` | Detect plugin type |
| `isValidPlugin(plugin)` | Check if valid plugin |
| `schemaFromEntities(entities)` | Create schema from entities |

---

## Error Classes

| Class | HTTP | Description |
|-------|------|-------------|
| `NevrErrorClass` | - | Base error class |
| `EntityNotFoundError` | 404 | Entity not found |
| `ValidationFailedError` | 400 | Validation failed |
| `AuthenticationError` | 401 | Authentication required |
| `AuthorizationError` | 403 | Permission denied |
| `ConflictError` | 409 | Resource conflict |
| `PluginError` | 500 | Plugin error |
| `ConfigurationError` | 500 | Configuration error |
| `DatabaseError` | 500 | Database error |

## Error Builders

| Function | Status | Description |
|----------|--------|-------------|
| `validationError(errors)` | 400 | Validation error response |
| `unauthorizedError(msg?)` | 401 | Unauthorized response |
| `forbiddenError(msg?)` | 403 | Forbidden response |
| `notFoundError(msg?)` | 404 | Not found response |
| `conflictError(msg?)` | 409 | Conflict response |
| `internalError(msg?)` | 500 | Internal error response |
| `handleError(error)` | - | Convert error to response |

See [Errors Reference](/reference/errors) for all error utilities.

---

## Router Utilities

| Function | Description |
|----------|-------------|
| `matchRoute(path, pattern)` | Match path to route pattern |
| `pluralize(name)` | Pluralize entity name |
| `singularize(name)` | Singularize entity name |

See [Router Reference](/reference/router) for details.

---

## Service Container

| Export | Description |
|--------|-------------|
| `ServiceContainer` | Main container class |
| `ScopedContainer` | Per-request scoped container |
| `createScope(container)` | Create scoped container |
| `createService(id, factory)` | Create service definition |
| `lazyService(id)` | Create lazy service reference |
| `getGlobalContainer()` | Get global container |
| `setGlobalContainer(c)` | Set global container |

---

## Logger & Utils

| Export | Description |
|--------|-------------|
| `getLogger()` | Get current logger |
| `setLogger(logger)` | Set custom logger |
| `noopLogger` | Silent logger |
| `consoleLogger` | Console-based logger |
| `createPrefixedLogger(prefix, logger)` | Create prefixed logger |
| `capitalize(str)` | Capitalize first letter |
| `pascalCase(str)` | Convert to PascalCase |
| `camelCase(str)` | Convert to camelCase |
| `kebabCase(str)` | Convert to kebab-case |
| `snakeCase(str)` | Convert to snake_case |
| `isValidIdentifier(str)` | Check valid JS identifier |
| `isValidEntityName(str)` | Check valid entity name |

---

## Workflow Engine

| Export | Description |
|--------|-------------|
| `workflow(steps)` | Create workflow |
| `runWorkflow(workflow, ctx)` | Execute workflow |
| `executeWorkflow(steps, ctx)` | Execute workflow steps |
| `WorkflowBuilder` | Fluent workflow builder |
| `createEntityStep(entity, data)` | Create entity step |
| `updateEntityStep(entity, where, data)` | Update entity step |
| `deleteEntityStep(entity, where)` | Delete entity step |

---

## Enhancement Functions

| Function | Description |
|----------|-------------|
| `createEnhancedDriver(driver, entities)` | Create enhanced driver |
| `validateCrossFields(data, validators)` | Cross-field validation |
| `filterReadableFields(data, user)` | Filter by read access |
| `filterWritableFields(data, user)` | Filter by write access |
| `hashPassword(password)` | Hash password with scrypt |
| `verifyPassword(password, hash)` | Verify password |
| `encryptValue(value)` | Encrypt field value |
| `decryptValue(value)` | Decrypt field value |

See [Enhancements Reference](/reference/enhancements) for all functions.

---

## Type Inference

```typescript
import type { $Infer, InferEntityData, InferCreateInput } from "nevr"

// Infer entity types from Nevr instance
type User = typeof api.$Infer.Entities["user"]

// Infer entity names
type EntityNames = typeof api.$Infer.EntityNames

// Infer from entity directly
type UserData = InferEntityData<typeof user>
type CreateUserInput = InferCreateInput<typeof user>
```

See [Type Inference Reference](/reference/inference) for all type utilities.
