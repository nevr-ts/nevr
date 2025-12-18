# @zapi-ts/cli

[![Beta](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/zapi-ts/zapi)

Command-line interface for [zapi](https://github.com/zapi-ts/zapi) - Zero to API in seconds.

## Installation

```bash
npm install -g @zapi-ts/cli
# or use with npx
npx @zapi-ts/cli generate
```

## Usage

### Generate Command

Generate Prisma schema, TypeScript types, and API client from your entity definitions:

```bash
zapi generate
```

Options:
- `-c, --config <path>` - Path to zapi config file (default: `./zapi.config.ts`)
- `-o, --out <dir>` - Output directory (default: `./generated`)
- `-p, --provider <provider>` - Database provider: sqlite, postgresql, mysql (default: `sqlite`)

### Init Command

Get help on initializing a new zapi project:

```bash
zapi init
```

For full project scaffolding, use:

```bash
npm create zapi-ts@latest
```

## Configuration

Create a `zapi.config.ts` file in your project root:

```typescript
import { entity, string, text, belongsTo } from "@zapi-ts/core"

export const user = entity("user", {
  email: string.unique(),
  name: string,
})

export const post = entity("post", {
  title: string,
  body: text,
  author: belongsTo(() => user),
}).ownedBy("author")

export default {
  entities: [user, post],
}
```

Then run:

```bash
npx @zapi-ts/cli generate
npx prisma db push --schema=./generated/prisma/schema.prisma
```

## Output

The generator creates:

- `generated/prisma/schema.prisma` - Prisma database schema
- `generated/types.ts` - TypeScript interfaces for all entities
- `generated/client.ts` - Typed API client for frontend use

## Learn More

- [zapi Documentation](https://github.com/zapi-ts/zapi)
- [Prisma Documentation](https://prisma.io/docs)

## License

MIT
