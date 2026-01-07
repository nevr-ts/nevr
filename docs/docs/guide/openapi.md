# OpenAPI Generation

> 🎯 **Generate OpenAPI 3.0 specifications from your Nevr entities automatically.**

## Why OpenAPI?

OpenAPI (formerly Swagger) provides:
- **API Documentation** - Interactive documentation for your API
- **Client Generation** - Generate SDKs for any language
- **Testing Tools** - Use tools like Postman, Insomnia
- **Validation** - Validate requests/responses against spec

---

## Quick Start

```typescript
import { generateOpenAPI } from "@nevr/generator"
import { user, post, order } from "./entities"

const spec = generateOpenAPI([user, post, order], {
  info: {
    title: "My API",
    version: "1.0.0",
    description: "API for my application",
  },
  servers: [
    { url: "http://localhost:3000/api", description: "Development" },
    { url: "https://api.myapp.com", description: "Production" },
  ],
  outPath: "./docs/openapi.json",  // Optional: Write to file
})
```

---

## Entity Actions in OpenAPI

Entity actions are automatically documented:

```typescript
const order = entity("order", {
  total: int,
  status: string.default("pending"),
})
  .actions({
    checkout: action("checkout")
      .post()
      .input({
        paymentMethod: string,
        shippingAddress: string,
      })
      .meta({
        summary: "Process order checkout",
        description: "Validates payment and initiates shipping",
        tags: ["Orders", "Checkout"],
      }),
  })
  .build()
```

This generates:

```yaml
/orders/{id}/checkout:
  post:
    summary: Process order checkout
    description: Validates payment and initiates shipping
    tags:
      - Orders
      - Checkout
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              paymentMethod:
                type: string
              shippingAddress:
                type: string
            required:
              - paymentMethod
              - shippingAddress
```

---

## Multi-Entity Operations

Actions with `.creates()`, `.updates()`, `.deletes()` document their operations:

```typescript
const user = entity("user", { email: string, name: string })
  .actions({
    signUp: action("sign-up")
      .post()
      .input({
        email: string.email(),
        password: string.min(8),
        name: string.optional(),
      })
      .creates("user")
      .creates("session", ctx => ({ userId: ctx.results.user.id }))
      .returns("user", { omit: ["password"] })
      .meta({
        summary: "Create user account",
        tags: ["Authentication"],
      }),
  })
  .build()
```

Generated OpenAPI includes operations info:

```yaml
/users/sign-up:
  post:
    summary: Create user account
    description: |
      Execute sign-up action
      
      **Operations:**
      • CREATE user (auto-mapped from input)
      • CREATE session (custom data)
      
      **Returns: user (excluding: password)**
    responses:
      "200":
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/User"
```

---

## Rich Metadata

Use `.meta()` on actions to enhance OpenAPI:

```typescript
action("verify")
  .post()
  .onResource()
  .meta({
    summary: "Verify user email",
    description: "Confirms email using verification token",
    tags: ["Authentication", "Email"],
  })
```

---

## Plugin Routes in OpenAPI

Plugin routes are also included:

```typescript
const spec = generateOpenAPI(entities, {
  info: { title: "API", version: "1.0.0" },
  plugins: [authPlugin],  // Include plugin routes
  basePath: "/api",
})
```

---

## Configuration Options

| Option | Type | Description |
|:--|:--|:--|
| `info` | `OpenAPIInfo` | API title, version, description |
| `servers` | `OpenAPIServer[]` | Server URLs |
| `basePath` | `string` | Base path for all routes (default: `/api`) |
| `plugins` | `Plugin[]` | Plugins whose routes to include |
| `outPath` | `string` | Write spec to file |
| `security` | `boolean` | Include security schemes (default: `true`) |

---

## CLI Generation

Generate from command line:

```bash
npx nevr generate:openapi --out ./docs/openapi.json
```

---

## Best Practices

1. **Add `.meta()`** to all actions - Makes docs useful
2. **Use descriptive tags** - Groups endpoints logically
3. **Include examples** - Use `.example()` on fields
4. **Document errors** - List possible error codes
