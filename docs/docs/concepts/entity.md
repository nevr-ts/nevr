# Entities

Entities are the building blocks of your Nevr application. They represent the "Resources" in your REST API and the "Tables" in your database.

## Definition

An entity is defined using the `entity` function. It takes a name and a schema definition object.

```typescript
import { entity, string, number } from "nevr"

export const product = entity("product", {
  name: string,
  price: number,
  sku: string.unique()
})
```

## Fields

Nevr provides a rich set of field types:
- `string`: Text data.
- `text`: Long text data.
- `number`: Integers or floats.
- `bool`: Boolean values.
- `date`: Date and time.
- `json`: Structured JSON data.

## Modifiers

Fields can be modified to add constraints or default values:
- `.optional()`: Field is not required.
- `.default(value)`: Sets a default value.
- `.unique()`: Ensures uniqueness in the database.
- `.min(n)`, `.max(n)`: Validation rules.

## Relationships

(Coming Soon) Nevr will support defining relationships between entities directly in the DSL.
