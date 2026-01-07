# Timestamps

By default, Nevr automatically adds `createdAt` and `updatedAt` fields to every entity. These fields are managed automatically by the framework.

## Disabling Timestamps

If you are working with an existing database or a simple lookup table that doesn't need timestamps, you can disable them using `.timestamps(false)`:

```typescript
export const lookup = entity("Lookup", {
  code: string,
  value: string
})
  .timestamps(false)
```

## Customizing Timestamps

You can customize the timestamp field names using `.timestamps()`:

```typescript
export const event = entity("Event", {
  name: string,
  startDate: datetime
})
  .timestamps({
    createdAt: "created_at",
    updatedAt: "updated_at"
  })
```


## See Also

- [Defining Entities](/entities/defining)
- [Field Types](/fields/types)
