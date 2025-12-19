# Plugins Concept

Plugins extend Nevr entities with new features, fields, or behaviors.

## What is a Plugin?

A plugin is a reusable function that augments an entity. It can:
- Add fields (e.g., timestamps)
- Add hooks (e.g., beforeCreate)
- Add validation or computed properties

## Using Plugins

Apply plugins with `.use()`:

```typescript
import { entity, string } from 'nevr';
import { timestamps } from 'nevr/plugins/timestamps';

const Post = entity('Post', {
  title: string(),
})
.use(timestamps()); // Adds createdAt, updatedAt
```

## Built-in Plugins

| Plugin | Import | What it does |
|--------|--------|--------------|
| **timestamps** | `nevr/plugins/timestamps` | Adds `createdAt`, `updatedAt` fields |

## Writing Custom Plugins

A plugin is a function that receives the entity and options:

```typescript
import type { Entity } from 'nevr';

function myPlugin(options) {
  return (entity: Entity) => {
    // Add fields, hooks, etc.
    entity.addField('myField', string());
    entity.addHook('beforeCreate', (data) => {
      // ...
    });
  };
}

const MyEntity = entity('MyEntity', {...}).use(myPlugin({ ... }));
```

## Plugin API

Plugins can:
- Add fields: `entity.addField(name, field)`
- Add hooks: `entity.addHook(event, fn)`
- Modify rules: `entity.setRules(rules)`

### Hook Events
- `beforeCreate`
- `afterCreate`
- `beforeUpdate`
- `afterUpdate`
- `beforeDelete`
- `afterDelete`

## Example: Soft Delete Plugin

```typescript
function softDelete() {
  return (entity) => {
    entity.addField('deletedAt', datetime().optional());
    entity.addHook('beforeDelete', (data) => {
      data.deletedAt = new Date();
      return false; // Prevent actual delete
    });
  };
}

const Post = entity('Post', {...}).use(softDelete());
```

## Best Practices

- Use plugins for cross-cutting concerns
- Keep plugins pure and composable
- Document plugin options and effects

## Next Steps

- [Using Plugins](/docs/plugin/using-plugins)
- [Timestamps Plugin](/docs/plugin/timestamps)
- [Create a Plugin](/docs/guide/create-plugin)
