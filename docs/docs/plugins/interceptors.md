# Request Interceptors

The Unified Plugin System introduces a powerful way to intercept and handle requests before or after the main route handler execution using **Interceptors**.

::: tip
Interceptors are similar to middleware but tailored for plugin development with flexible matching capabilities.
:::

## Overview

Interceptors are defined in the `interceptors` property of your plugin definition. You can define `before` and `after` interceptors.

```typescript
interceptors: {
  before: [
    { matcher: "/api/*", handler: ensureAuth }
  ],
  after: [
    { matcher: "/api/*", handler: addTimingHeader }
  ]
}
```

## Matchers

Matchers determine which requests trigger your interceptor. You can use:

### 1. String Glob

Matches paths using strict equality or wildcards.

```typescript
// Strict match
matcher: "/admin/dashboard"

// Wildcard match
matcher: "/api/*"
```

### 2. Regular Expression

For complex pattern matching.

```typescript
// Match any path starting with /api/v1/ or /api/v2/
matcher: /^\/api\/v[12]\//
```

### 3. Function

For complete control over matching logic.

```typescript
matcher: (ctx) => {
  // Only match POST requests to /create that have a specific header
  return ctx.method === "POST" && 
         ctx.path.includes("/create") &&
         !!ctx.headers["x-custom-auth"]
}
```

### 4. Helper Functions

Nevr provides helpers to combine matchers:

```typescript
import { matchPrefix, matchRegex, matchAll, matchAnyOf } from "nevr"

// Starts with /admin
matcher: matchPrefix("/admin")

// Logic combination
matcher: matchAll(
  matchPrefix("/api"),
  (ctx) => ctx.method !== "GET"
)
```

## Handlers

Handlers receive an `InterceptorContext` and can be async.

```typescript
async (ctx) => {
  // Access request details
  console.log(ctx.method, ctx.path)
  
  // Checking user (populated by auth plugin)
  if (!ctx.user) {
    throw new Error("Unauthorized")
  }
  
  // Modify response headers
  ctx.setHeader("X-Processed-By", "my-plugin")
  
  // In 'after' interceptors, access the returned value
  if (ctx.returned) {
    console.log("Response data:", ctx.returned)
  }
}
```

## Context Object

The `InterceptorContext` provides:

| Property | Description |
|----------|-------------|
| `path` | Request path |
| `method` | HTTP method |
| `headers` | Request headers |
| `query` | Query parameters |
| `params` | Route parameters |
| `body` | Request body |
| `user` | Current user (if authenticated) |
| `context` | Nevr context (driver, instances) |
| `returned` | Returned data (After interceptors only) |
| `setHeader` | Helper to set response header |
