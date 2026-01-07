# Router API

Internal routing utilities exported for advanced use cases.

## Functions

### matchRoute()

Match an incoming request path against registered routes.

```typescript
import { matchRoute } from "nevr"

const match = matchRoute("/api/users/123", routes, {
  prefix: "/api"
})

if (match) {
  console.log(match.route)   // Matched route definition
  console.log(match.params)  // { id: "123" }
}
```

### pluralize()

Convert entity names to plural form for route generation.

```typescript
import { pluralize } from "nevr"

pluralize("user")     // "users"
pluralize("category") // "categories"
pluralize("person")   // "people"
```

### singularize()

Convert plural names back to singular form.

```typescript
import { singularize } from "nevr"

singularize("users")      // "user"
singularize("categories") // "category"
singularize("people")     // "person"
```

## Route Matching Options

```typescript
interface MatchRouteOptions {
  prefix?: string      // API prefix to strip
  strict?: boolean     // Require exact match
}
```

## See Also

- [Custom Routes](/guide/custom-routes)
- [Adapters](/adapters/overview)
