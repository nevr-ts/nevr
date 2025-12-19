# @nevr/cli

[![Beta](https://img.shields.io/badge/status-beta-orange.svg)](https://github.com/nevr-ts/nevr)

Command-line interface for [nevr](https://github.com/nevr-ts/nevr) - Nevr write boilerplate again.

## Installation

```bash
npm install -g @nevr/cli
# or use with npx
npx @nevr/cli generate
```

## Usage

### Generate Command

Generate Prisma schema, TypeScript types, and API client from your entity definitions:

```bash
nevr generate
```

Options:
- `-c, --config <path>` - Path to nevr config file (default: `./nevr.config.ts`)
- `-o, --out <dir>` - Output directory (default: `./generated`)
- `-p, --provider <provider>` - Database provider: sqlite, postgresql, mysql (default: `sqlite`)

### Init Command

Get help on initializing a new nevr project:

```bash
nevr init
```

For full project scaffolding, use:

```bash
npm create nevr@latest
```

## Configuration

Create a `nevr.config.ts` file in your project root:

```typescript
import { entity, string, text, belongsTo } from "nevr"

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
npx @nevr/cli generate
npx prisma db push --schema=./generated/prisma/schema.prisma
```

## Output

The generator creates:

- `generated/prisma/schema.prisma` - Prisma database schema
- `generated/types.ts` - TypeScript interfaces for all entities
- `generated/client.ts` - Typed API client for frontend use

## Learn More

- [Nevr Documentation](https://github.com/nevr-ts/nevr)
- [Prisma Documentation](https://prisma.io/docs)

## License

MIT
