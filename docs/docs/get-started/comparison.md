# Comparison

> ⚔️ **Choosing the right tool for the job.**

Nevr occupies a unique niche: **Entity-First, Type-Safe, Standard REST APIs.**

For 95% of projects, you shouldn't need to choose between "fast development" (BaaS) and "full control" (Custom Backend). Nevr gives you both.

---

## ⚡ The Feature Matrix

| Feature | Express + Prisma | NestJS | Strapi / Supabase | **Nevr** |
|:--------|:----------------:|:------:|:-----------------:|:--------:|
| **Boilerplate** | High | Very High | Low | **Very Low** |
| **Type Safety** | Manual | Decorators | Manual/Codegen | **End-to-End** |
| **Control** | Full | Full | Limited | **Full** |
| **Learning Curve** | Medium | Steep | Low | **Low** |
| **Hostable** | Anywhere | Anywhere | Self/Cloud | **Anywhere** |
| **Architecture** | Do-it-yourself | Opinionated | Plugin-based | **Entity-First** |

---

## 🆚 vs. Traditional Stack (Express + Prisma)

The "Standard Stack" is flexible but requires immense glue code. You have to manually sync your database schema, validation logic, and API routes.

### The Problem: Glue Code Hell 🤯

```typescript
// 1. Define Schema (schema.prisma)
model User { id String ... }

// 2. Define Validation (user.zod.ts)
const UserSchema = z.object({ ... })

// 3. Define Types (user.types.ts)
type CreateUserDto = z.infer<typeof UserSchema>

// 4. Create Router (user.routes.ts)
router.post('/users', validate(UserSchema), async (req, res) => {
  // 5. Query Database (user.controller.ts)
  const user = await prisma.user.create({ ... })
})
```

### The Nevr Way: Single Source of Truth ✨

```typescript
import { entity, string } from "nevr"

// ONE definition generates schema, validation, types, and API
const user = entity("user", {
  email: string.email().unique(),
  name: string.min(2),
})
```



## 🆚 vs. Opinionated Frameworks (NestJS)

NestJS is powerful but heavy. It relies on Angular-style decorators, extensive class-based boilerplate, and a steep learning curve for dependency injection.

### The Problem: Decorator & Class Overload 🏗️

```typescript
// user.entity.ts
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;
}

// user.dto.ts
export class CreateUserDto {
  @IsString()
  @IsEmail()
  readonly email: string;
}

// user.controller.ts
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }
}
```

### The Nevr Way: Functional & Composable 🧩

Nevr achieves the same architecture (Service Container, DI, Separation of Concerns) without classes or decorators.

```typescript
// Functional DI Container
const container = ServiceContainer()
container.register("payment", () => stripePaymentService)

// Composable Actions
const createUser = action("create-user")
    .input({ email: string.email() })
    .handler(async ({ input, resolve }) => {
        const payment = resolve("payment")
        // ...
    })
```

**Verdict**: Nevr gives you the "Enterprise Architecture" of NestJS (Sagas, DI, Adapters) with the simplicity of Express.

---

## 🆚 vs. BaaS (Supabase / Firebase / Strapi)

Backend-as-a-Service tools are amazing for speed but often lock you into their ecosystem. Logic lives in proprietary "cloud functions" or GUIs rather than your codebase.

### The Problem: Vendor Lock-in & "Black Box" Logic 🔒

- **Hidden Logic**: Validation rules are often set in a dashboard, not version-controlled code.
- **Database Limits**: You are stuck with their database choice or specific versions.
- **Cost Scaling**: "Free to start, expensive to scale" specific pricing models.
- **No Local Dev**: Difficult to run a true offline replica of the entire stack.

### The Nevr Way: 100% Code & Open Architecture 🔓

- **Code-First**: All rules, schemas, and permissions are code. Git-versioned, reviewed, and tested.
- **Your Database**: Connect to **any** Prisma-supported database (Postgres, MySQL, Mongo, etc.).
- **Self-Hostable**: It's just a Node.js app. Deploy to Vercel, AWS, DigitalOcean, or your own VPS.
- **Extensible**: Need a custom endpoint? Just write a standard mapped route. No "cloud function" limitations.

**Verdict**: Nevr offers the "Instant API" feel of a CMS/BaaS but keeps you in full control of your infrastructure and code.

---

## 🧩 Framework & Database Agnostic

Nevr is designed to resist vendor and technology lock-in. Unlike other frameworks that force you into a specific stack, Nevr is adaptable.

### 🌐 HTTP Framework Agnostic
You are not tied to a specific server framework. Nevr works via **Adapters**, so you can drop it into:

- **Express / Connect** (Standard Node.js)
- **Hono** (Edge / Bun / Cloudflare Workers)
- **Fastify** (High performance)
- **Next.js API Routes** (Serverless)
- **Bun.serve** (Native Bun)

```typescript
// Use with Express
const app = express()
app.use("/api", expressAdapter(api))

// Use with Hono
const app = new Hono()
app.all("/api/*", honoAdapter(api))
```

### 💾 Database Agnostic
Through our **Driver** system (compatible with Prisma and others), you can switch databases by changing your configuration, not your business logic:

- **PostgreSQL** (Standard choice)
- **MySQL / MariaDB** (Legacy support)
- **SQLite / LibSQL** (Great for local/edge)
- **MongoDB** (NoSQL support)
- **CockroachDB / PlanetScale / Neon** (Serverless SQL)

This means you can start with SQLite for local dev and deploy to Postgres, or switch HTTP frameworks without rewriting a single line of your Entity definitions.
