# Production Deployment

Best practices for deploying Nevr applications to production.

## Pre-Deployment Checklist

- [ ] Run `npm run build` successfully
- [ ] All tests pass (`npm test`)
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Encryption keys set (if using `.encrypted()`)

## Environment Variables

### Required

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Security (if using encryption)
ENCRYPTION_KEY="your-32-byte-hex-key"
```

### Recommended

```bash
# Server
NODE_ENV="production"
PORT=3000

# Auth (if using auth plugin)
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"
```

## Database Migrations

### Development

Use `db:push` for rapid prototyping:

```bash
npx nevr db:push
```

### Production

Use `db:migrate` for versioned migrations:

```bash
npx nevr db:migrate --name "add_users"
```

> [!WARNING]
> Never use `db:push` in production. It may reset data.

---

## Performance Optimization

### 1. Enable Caching

```typescript
const api = nevr({
  entities: [...],
  cache: {
    enabled: true,
    ttl: 60 * 5, // 5 minutes
  }
})
```

### 2. Use Connection Pooling

```typescript
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  pool: {
    min: 5,
    max: 20,
  },
})
```

### 3. Selective Includes

Avoid loading remote relations unless needed:

```bash
# Bad - loads everything
GET /users?include=*

# Good - selective loading
GET /users?include=posts
```

---

## Security Hardening

### 1. Generate Encryption Keys

```typescript
import { generateEncryptionKey } from "nevr"

const key = generateEncryptionKey()
console.log(key) // Store in secrets manager
```

### 2. Use HTTPS Only

```typescript
// Express example
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(`https://${req.hostname}${req.url}`)
  }
  next()
})
```

### 3. Rate Limiting

```typescript
import rateLimit from "express-rate-limit"

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
}))
```

---

## Deployment Platforms

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx nevr generate

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Vercel / Edge

Use the Hono template for edge deployments:

```bash
npm create nevr@latest my-api -t hono
```

### Railway / Render

Standard Node.js deployment works out of the box.

---

## Monitoring

### Health Check Endpoint

```typescript
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})
```

### Logging

```typescript
const api = nevr({
  entities: [...],
  plugins: [
    defineUnifiedPlugin({
      meta: { name: "logger" },
      interceptors: {
        before: [
          {
            matcher: "/**",
            handler: async (ctx, next) => {
              console.log(`[${ctx.method}] ${ctx.path}`)
              return next()
            }
          }
        ]
      }
    })
  ]
})
```

## Next Steps

- [Error Handling](/guides/error-handling)
- [Authentication](/guides/authentication)
- [Enhanced Driver](/database/enhanced-driver)
