# nevr dev

Starts the complete development workflow.

```bash
npx nevr dev [options]
```

## Description

This is the recommended command for local development. It runs the following steps in order:

1. **Generate**: Runs `nevr generate` to build the latest schema.
2. **Push**: Runs `nevr db:push` to sync the database with the schema.
3. **Start**: Starts your development server (if configured in `package.json` scripts) or simply watches for changes.

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--config <path>` | `-c` | `./nevr.config.ts` | Path to config file. |

## Workflow

When you run `nevr dev`, it ensures your database and generated client are always in sync with your `entity()` definitions.

1. You edit `user.ts` to add a field.
2. You restart `nevr dev` (or it watches, depending on setup).
3. The database updates automatically.
4. Your TypeScript types update automatically.

## Integration with Frameworks

Use `nevr dev` in parallel with your framework's dev command using tools like `concurrently` (though `nevr dev` is primarily for the database/nevr side).

Usually, you just use the standard dev command of your framework if you are using the runtime features, but `nevr dev` is great for the **database iteration loop**.

```json
// package.json
{
  "scripts": {
    "dev": "nevr dev && ts-node src/server.ts"
  }
}
```
