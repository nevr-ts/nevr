# nevr openapi

Generate an OpenAPI 3.0 specification from your entity definitions.

## Usage

```bash
npx nevr openapi [options]
```

## Description

This command generates a complete OpenAPI specification from your entities and plugins, including:

1. **CRUD endpoints** for each public entity (list, get, create, update, delete)
2. **Plugin endpoints** from auth, payment, organization, and other plugins
3. **Custom actions** defined with `.actions()`
4. **Request/response schemas** derived from entity fields
5. **Query parameters** for filtering, sorting, pagination

> **Note:** Plugin entities marked as `internal` (e.g., user, session, account from the auth plugin) do not generate CRUD routes. They are managed through the plugin's custom endpoints instead.

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--config <path>` | `-c` | `./nevr.config.ts` | Path to your config file |
| `--output <path>` | `-o` | `./openapi.json` | Output file path |
| `--format <fmt>` | | `json` | Output format: `json` or `yaml` |
| `--title <title>` | | `Nevr API` | API title in spec |
| `--version <ver>` | | `1.0.0` | API version in spec |
| `--base-path <path>` | | `/api` | Base path for all routes |

## Examples

**Generate JSON spec:**
```bash
npx nevr openapi
```

**Generate YAML spec:**
```bash
npx nevr openapi --format yaml
```

**Custom output path:**
```bash
npx nevr openapi -o ./docs/api-spec.json
```

**With custom title and version:**
```bash
npx nevr openapi --title "My App API" --version "2.0.0"
```

**Full example:**
```bash
npx nevr openapi \
  --format yaml \
  -o ./docs/openapi.yaml \
  --title "E-Commerce API" \
  --version "1.2.0" \
  --base-path "/v1"
```

## Output

The generated spec includes:

### Entity Endpoints

For each entity (e.g., `post`):

| Method | Path | Operation |
|--------|------|-----------|
| GET | `/api/posts` | List all posts |
| POST | `/api/posts` | Create a post |
| GET | `/api/posts/{id}` | Get a post |
| PUT | `/api/posts/{id}` | Update a post |
| DELETE | `/api/posts/{id}` | Delete a post |

### Plugin Endpoints

Plugins that define custom endpoints (auth, organization, payment, etc.) are automatically included:

| Method | Path | Plugin | Operation |
|--------|------|--------|-----------|
| POST | `/auth/sign-up/email` | Authentication | Sign up with email |
| POST | `/auth/sign-in/email` | Authentication | Sign in with email |
| GET | `/auth/get-session` | Authentication | Get current session |
| POST | `/organization/create` | Organization | Create organization |
| POST | `/payment/stripe/webhook` | Payment | Stripe webhook |

Each plugin's `basePath` is used as the route prefix, and endpoint metadata (summary, tags, description) is extracted from the endpoint definitions.

### Schemas

Each entity generates a schema in `#/components/schemas/`:

```yaml
components:
  schemas:
    Post:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        body:
          type: string
        published:
          type: boolean
      required:
        - title
        - body
```

### Custom Actions

Actions defined with `.actions()` are included:

```typescript
const order = entity("order", { ... })
  .actions({
    checkout: action("checkout")
      .post()
      .input({ paymentMethod: string })
      .meta({ summary: "Process checkout" }),
  })
```

Generates:
```yaml
/api/orders/{id}/checkout:
  post:
    summary: Process checkout
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              paymentMethod:
                type: string
```

## Use Cases

### Import into API Tools

```bash
# Generate and open in Swagger UI
npx nevr openapi -o ./public/openapi.json
# Then serve via your app or use online Swagger Editor
```

### Generate Client SDKs

```bash
# Generate spec
npx nevr openapi -o openapi.json

# Use OpenAPI Generator to create SDKs
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g typescript-fetch \
  -o ./sdk
```

### CI/CD Integration

```yaml
# .github/workflows/docs.yml
- name: Generate OpenAPI
  run: npx nevr openapi -o ./docs/openapi.json

- name: Upload spec
  uses: actions/upload-artifact@v3
  with:
    name: openapi-spec
    path: ./docs/openapi.json
```

## See Also

- [OpenAPI Guide](/guide/openapi) - Programmatic API and advanced options
- [Entity Actions](/actions/overview) - Define custom actions
- [nevr generate](/cli/generate) - Generate Prisma schema
