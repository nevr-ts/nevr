# nevr introspect

Display a summary of all entities and plugins in your project.

## Usage

```bash
npx nevr introspect [options]
```

## Description

This command shows a quick overview of:

1. **User Entities** - Your custom entities
2. **Plugin Entities** - Entities added by plugins (auth, payment, etc.)
3. **Plugin Extensions** - Fields plugins add to your entities
4. **Summary** - Total counts

Useful for:
- Quick project overview
- Debugging entity issues
- Verifying plugin integration

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--config <path>` | `-c` | `./nevr.config.ts` | Path to your config file |
| `--json` | | `false` | Output as JSON |

## Examples

**Standard output:**
```bash
npx nevr introspect
```

Output:
```
🔍 nevr introspect

📦 User Entities:
   - post (3 fields)
   - comment (2 fields)

🔌 Plugins:
   auth:
     Entities: user, session, account, verification
     Extends: user (adds: emailVerified, twoFactorEnabled)

📊 Summary:
   Total entities: 7
     - User: 2
     - Plugin: 5
   Field extensions: 2
```

**JSON output:**
```bash
npx nevr introspect --json
```

Output:
```json
{
  "userEntities": [
    {
      "name": "post",
      "fields": ["title", "body", "published"],
      "timestamps": true
    }
  ],
  "plugins": [
    {
      "id": "auth",
      "entities": ["user", "session"],
      "extends": ["user"]
    }
  ],
  "totals": {
    "userEntities": 2,
    "pluginEntities": 5,
    "totalEntities": 7,
    "plugins": 1
  }
}
```

## Use Cases

### Quick Check

Verify your entities are configured correctly:

```bash
npx nevr introspect
```

### CI Validation

Ensure expected entities exist:

```bash
npx nevr introspect --json | jq '.totals.totalEntities >= 5'
```

### Pre-Generate Check

See what will be generated before running generate:

```bash
npx nevr introspect
npx nevr generate
```

## See Also

- [nevr context](/cli/context) - Full AI-optimized context
- [nevr generate](/cli/generate) - Generate Prisma schema
