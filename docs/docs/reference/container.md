# Service Container Reference

The Service Container is Nevr's built-in dependency injection system. It provides type-safe service registration, scoped containers for request isolation, and automatic lifecycle management.

## Core Concepts

### ServiceContainer

The main container class that holds registered services.

```typescript
import { ServiceContainer, createScope} from "nevr"

// Create a new container
const container = new ServiceContainer()


```

---

## API Reference

### ServiceContainer

```typescript
class ServiceContainer {
  // Register a singleton service
  register<T>(name: string, factory: () => T | Promise<T>): void
  
  // Register a scoped service (per-request lifecycle)
  registerScoped<T>(name: string, factory: (ctx: ServiceResolverContext) => T | Promise<T>): void
  
  // Resolve a service by name
  get<T>(name: string): Promise<T>
  
  // Check if a service is registered
  has(name: string): boolean
  
  // Set the database driver
  setDriver(driver: Driver): void
  
  // Get the database driver
  getDriver<T extends Driver>(): T
  
  // Create a scoped container for request isolation
  createScope(context?: Partial<ServiceResolverContext>): ScopedContainer
}
```

### ScopedContainer

Request-scoped container that inherits from parent but has isolated scoped services.

```typescript
interface ScopedContainer {
  // Get service from scope (scoped services created per-scope)
  get<T>(name: string): Promise<T>
  
  // Check if service exists
  has(name: string): boolean
  
  // Get database driver
  getDriver<T extends Driver>(): T
  
  // Access to parent container
  parent: ServiceContainer
  
  // Request context
  context: ServiceResolverContext
}
```

---

## Usage Examples

### Basic Service Registration

```typescript
const container = new ServiceContainer()

// Register singleton service
container.register("config", () => ({
  apiKey: process.env.API_KEY,
  baseUrl: "https://api.example.com",
}))

// Resolve later
const config = await container.get<Config>("config")
```

### Scoped Services (Per-Request)

```typescript
// Services that need request context
container.registerScoped("userService", (ctx) => ({
  getCurrentUser: () => ctx.user,
  isAdmin: () => ctx.user?.roles?.includes("admin") ?? false,
}))

// In request handler
const scope = container.createScope({ 
  user: authenticatedUser,
  request: req,
})

const userService = await scope.get<UserService>("userService")
// userService has access to current request's user
```

### Database Driver Integration

```typescript
import { prisma } from "nevr/drivers/prisma"
import { PrismaClient } from "@prisma/client"

const container = new ServiceContainer()
container.setDriver(prisma(new PrismaClient()))

// Driver is available throughout the application
const driver = container.getDriver()
await driver.findFirst("user", { where: { email: "test@example.com" } })
```

### Service Dependencies

```typescript
// Services can depend on other services
container.register("emailService", () => ({
  send: async (to, subject, body) => { /* ... */ }
}))

container.registerScoped("notificationService", async (ctx) => {
  const emailService = await ctx.container.get<EmailService>("emailService")
  return {
    notifyUser: async (userId, message) => {
      const user = await ctx.container.getDriver().findFirst("user", { 
        where: { id: userId } 
      })
      await emailService.send(user.email, "Notification", message)
    }
  }
})
```

---

## Integration with Nevr

The container is automatically available in action handlers and hooks:

```typescript
const userEntity = entity("user", { 
  email: string.email() 
}).actions({
  sendWelcome: action()
    .onResource()
    .handler(async (ctx) => {
      // Access container services
      const emailService = await ctx.container.get<EmailService>("emailService")
      await emailService.send(ctx.resource.email, "Welcome!", "...")
      return { sent: true }
    })
})
```

---

## Factory Functions

### ServiceContainer()

Creates a new empty ServiceContainer:

```typescript
import { ServiceContainer} from "nevr"

const container = ServiceContainer()
```

### createScope()

Creates a scoped container from a parent:

```typescript
import { createScope } from "nevr"

const scope = createScope(parentContainer, {
  user: currentUser,
  request: req,
})
```

---

## Best Practices

1. **Register services at startup** - Register all services before starting the server
2. **Use scoped services for request-specific data** - User context, request info, etc.
3. **Keep singletons stateless** - Singleton services should not hold request-specific state
4. **Type your services** - Use TypeScript interfaces for type-safe resolution

```typescript
// Define service interfaces
interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>
}

// Type-safe resolution
const email = await container.get<EmailService>("emailService")
```

---

## Related

- [Workflow Engine](/reference/workflow) - Saga pattern with DI support
- [Plugins](/plugin/creating-plugins) - Plugin-provided services
- [Actions](/reference/actions) - Using services in entity actions
