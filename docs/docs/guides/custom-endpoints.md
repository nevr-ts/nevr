# Custom Endpoints

While Nevr generates CRUD endpoints automatically, real-world applications often need custom business logic.

## Using the Underlying Framework

Since Nevr mounts as a router within your framework (Express/Hono), you can simply define custom routes alongside Nevr.

### Express Example

```typescript
// Standard Nevr CRUD
app.use("/api", expressAdapter(api))

// Custom Endpoint
app.post("/api/custom-action", async (req, res) => {
  const { data } = req.body
  // Perform complex logic
  res.json({ success: true })
})
```

### Hono Example

```typescript
// Standard Nevr CRUD
app.route("/api", honoAdapter(api))

// Custom Endpoint
app.post("/api/custom-action", (c) => {
  return c.json({ success: true })
})
```

## Extending Nevr (Future)

In the future, Nevr will allow defining custom actions directly on entities to benefit from generated types and validation.

```typescript
// Concept
user.action("promote", {
  input: { role: string },
  handler: async (ctx) => {
    // ...
  }
})
```
