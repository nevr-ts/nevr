# Core API

This is a pragmatic overview of key exports. For a tutorial, see the Guide.

## Factories

### `nevr(config: NevrConfig): NevrInstance`

Creates a Nevr instance.

- `entities: Entity[]` — entity definitions (builders or built)
- `driver: Driver` — database driver (e.g., `prisma(prismaClient)`)
- `plugins?: Plugin[]` — optional plugins
- `cors?: CorsOptions | false` — CORS headers middleware
- `security?: SecurityOptions | false` — basic security headers
- `context?: (req) => Record<string, unknown>` — augment per-request context

### `entity(name, fields)` → `EntityBuilder`

Starts an entity builder. Chain and finish with `.build()` or pass the builder to `nevr` directly.

Builder methods:
- `.ownedBy(relationField)` sets ownership rules and owner foreign key
- `.rules(partialRecord)` set/override CRUD rules per operation
- `.noTimestamps()` disable `createdAt`/`updatedAt`
- `.build()` produce an `Entity`

## Fields

Types: `string`, `text`, `int`, `float`, `boolean` (alias `bool`), `datetime`, `json`, `email`

Modifiers: `.optional() .unique() .default(v) .min(n) .max(n)`

## Relations

`belongsTo(() => Target).foreignKey("targetId").onDelete("cascade").optional()`
`hasMany(() => Target)`
`hasOne(() => Target)`

Inverse relations are generated in Prisma schema when using the generator.

## Rules

Built-ins exported from `nevr/rules` re-exported by root:
`everyone`, `authenticated`, `admin`, `owner`, `ownerOrAdmin`

## Adapters

Express: `nevr/adapters/express`
- `expressAdapter(api, { getUser, cors, debugLogs })`
- `expressDevAuth(req)` • `expressJwtAuth(verify)`

Hono: `nevr/adapters/hono`
- `honoAdapter(api, { getUser })` • `honoDevAuth` • `honoJwtAuth` • `cookieAuth`

## Driver (Prisma)

`nevr/drivers/prisma` → `prisma(prismaClient)` returns a `Driver` implementation.

## Validation

`validateInput(entity, input, operation)` → `{ valid, errors, data }`

## Types

Key types: `Entity`, `EntityConfig`, `FieldDef`, `RelationDef`, `Driver`, `NevrRequest`, `NevrResponse`, `Middleware`, `Plugin`, `Route`, `NevrInstance`, `Where`, `QueryOptions`.
