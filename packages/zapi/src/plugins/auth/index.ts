// =============================================================================
// AUTH PLUGIN
// Thin wrapper around Better Auth using the Plugin Factory pattern
// 
// Philosophy:
// - Better Auth handles ALL authentication logic
// - Nevr controls schema generation
// - Plugin mounts Better Auth routes and middleware
// =============================================================================

import { betterAuth } from "better-auth"
import { bearer, jwt } from "better-auth/plugins"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { createPlugin, type Plugin, type Route, type Middleware, type NevrInstance, type NevrRequest } from "../../index.js"
import type { AuthPluginOptions, AuthUser, AuthSession } from "./types.js"
import { getAuthEntities, getUserAuthFields, getJwksEntity } from "./entities.js"

// -----------------------------------------------------------------------------
// Re-export types
// -----------------------------------------------------------------------------

export * from "./types.js"

// -----------------------------------------------------------------------------
// Auth Plugin Factory
// -----------------------------------------------------------------------------

export function auth(options: AuthPluginOptions = {}): Plugin {
  // Validate required config
  const secret = options.secret || process.env.BETTER_AUTH_SECRET
  const baseURL = options.baseURL || process.env.BETTER_AUTH_URL || "http://localhost:3000"
  
  if (!secret) {
    throw new Error(
      "[Auth] Secret is required. Set options.secret or BETTER_AUTH_SECRET env variable"
    )
  }
  
  // Determine mode
  const mode = options.mode || "session"
  
  // Get auth entities
  const authEntities = getAuthEntities()
  const userFields = getUserAuthFields()
  
  // Add JWKS entity for JWT mode
  if (mode === "jwt") {
    authEntities.push(getJwksEntity())
  }
  
  // Build Better Auth plugins array
  const betterAuthPlugins: any[] = []
  
  // Add bearer plugin for API authentication (enabled by default for jwt/bearer modes)
  if (mode === "jwt" || mode === "bearer" || options.bearer !== false) {
    betterAuthPlugins.push(bearer())
  }
  
  // Add JWT plugin for jwt mode
  if (mode === "jwt") {
    betterAuthPlugins.push(jwt({
      jwt: {
        expirationTime: options.jwt?.expirationTime || "15m",
        issuer: options.jwt?.issuer || baseURL,
        audience: options.jwt?.audience || baseURL,
      },
    }))
  }
  
  // Build social providers config
  const socialProviders: Record<string, any> = {}
  
  if (options.providers?.google) {
    socialProviders.google = {
      clientId: options.providers.google.clientId,
      clientSecret: options.providers.google.clientSecret,
    }
  }
  
  if (options.providers?.github) {
    socialProviders.github = {
      clientId: options.providers.github.clientId,
      clientSecret: options.providers.github.clientSecret,
    }
  }
  
  if (options.providers?.discord) {
    socialProviders.discord = {
      clientId: options.providers.discord.clientId,
      clientSecret: options.providers.discord.clientSecret,
    }
  }
  
  if (options.providers?.apple) {
    socialProviders.apple = {
      clientId: options.providers.apple.clientId,
      clientSecret: options.providers.apple.clientSecret,
    }
  }
  
  // Store Better Auth instance (created lazily)
  let betterAuthInstance: ReturnType<typeof betterAuth> | null = null
  
  // Base path for auth routes
  const basePath = options.basePath || "/auth"
  
  // Create Better Auth instance lazily (needs Prisma client)
  const getBetterAuth = (prismaClient: any) => {
    if (betterAuthInstance) return betterAuthInstance
    
    betterAuthInstance = betterAuth({
      secret,
      baseURL,
      basePath: `/api${basePath}`,
      
      // Database adapter - use Prisma
      database: prismaAdapter(prismaClient, {
        provider: "postgresql", // Will be overridden by actual DB
      }),
      
      // Email/password auth
      emailAndPassword: {
        enabled: options.emailAndPassword !== false,
      },
      
      // OAuth providers
      socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
      
      // Session config
      session: {
        expiresIn: options.session?.expiresIn || 60 * 60 * 24 * 7, // 7 days
        updateAge: options.session?.updateAge || 60 * 60 * 24, // 1 day
      },
      
      // User config
      user: options.user ? {
        modelName: options.user.modelName,
        fields: options.user.fields,
      } : undefined,
      
      // Email sending
      emailVerification: options.email ? {
        sendVerificationEmail: async ({ user, url }) => {
          await options.email!.sendEmail({
            to: user.email,
            subject: "Verify your email",
            html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
          })
        },
      } : undefined,
      
      // Trusted origins
      trustedOrigins: options.trustedOrigins,
      
      // Plugins
      plugins: betterAuthPlugins,
    })
    
    return betterAuthInstance
  }
  
  // Use the new createPlugin factory
  return createPlugin({
    id: "auth",
    name: "Authentication",
    version: "1.0.0",
    description: "Authentication plugin powered by Better Auth",
    
    // -------------------------------------------------------------------------
    // Entities added by plugin
    // -------------------------------------------------------------------------
    entities: authEntities,
    
    // -------------------------------------------------------------------------
    // Fields added to user entity
    // -------------------------------------------------------------------------
    fields: {
      user: userFields,
    },
    
    // -------------------------------------------------------------------------
    // Routes - Mount Better Auth handler
    // -------------------------------------------------------------------------
    routes: ((api: NevrInstance): Route[] => {
      // Get Prisma client from driver
      const driver = api.driver as any
      const prismaClient = driver.prisma || driver.db || driver._prisma
      
      if (!prismaClient) {
        console.warn("[Auth] Could not find Prisma client from driver. Auth routes may not work.")
        return []
      }
      
      const auth = getBetterAuth(prismaClient)
      
      // Create a catch-all route for Better Auth
      const authRoute: Route = {
        method: "POST",
        path: `${basePath}/*`,
        handler: async (req: any) => {
          // Convert zapi request to standard Request
          const url = new URL(req.path, baseURL)
          if (req.query) {
            for (const [key, value] of Object.entries(req.query)) {
              url.searchParams.set(key, String(value))
            }
          }
          
          const request = new Request(url.toString(), {
            method: req.method,
            headers: new Headers(req.headers as Record<string, string>),
            body: req.body ? JSON.stringify(req.body) : undefined,
          })
          
          // Call Better Auth handler
          const response = await auth.handler(request)
          
          // Convert response back to zapi format
          const responseBody = await response.json().catch(() => null)
          
          return {
            status: response.status,
            body: responseBody,
            headers: Object.fromEntries(response.headers.entries()),
          }
        },
      }
      
      // Also handle GET requests
      const authRouteGet: Route = {
        method: "GET",
        path: `${basePath}/*`,
        handler: async (req: any) => {
          const url = new URL(req.path, baseURL)
          if (req.query) {
            for (const [key, value] of Object.entries(req.query)) {
              url.searchParams.set(key, String(value))
            }
          }
          
          const request = new Request(url.toString(), {
            method: "GET",
            headers: new Headers(req.headers as Record<string, string>),
          })
          
          const response = await auth.handler(request)
          const responseBody = await response.json().catch(() => null)
          
          return {
            status: response.status,
            body: responseBody,
            headers: Object.fromEntries(response.headers.entries()),
          }
        },
      }
      
      return [authRoute, authRouteGet]
    }) as unknown as Route[],
    
    // -------------------------------------------------------------------------
    // Middleware - Extract user from session
    // -------------------------------------------------------------------------
    middleware: ((zapi: ZapiInstance): Middleware[] => {
      const driver = zapi.driver as any
      const prismaClient = driver.prisma || driver.db || driver._prisma
      
      if (!prismaClient) {
        return []
      }
      
      const auth = getBetterAuth(prismaClient)
      
      const authMiddleware: Middleware = {
        name: "auth",
        handler: async (ctx: any, next: () => Promise<void>) => {
          try {
            // Build request for Better Auth
            const url = new URL(ctx.request.path, baseURL)
            const headers = new Headers(ctx.request.headers as Record<string, string>)
            
            // Get session from Better Auth
            const session = await auth.api.getSession({
              headers,
            })
            
            if (session?.user) {
              ctx.request.user = session.user as any
            }
          } catch (error) {
            // Session extraction failed - continue without user
            // This is expected for unauthenticated requests
          }
          
          await next()
        },
      }
      
      return [authMiddleware]
    }) as unknown as Middleware[],
    
    // -------------------------------------------------------------------------
    // Hooks
    // -------------------------------------------------------------------------
    hooks: {
      onInit: async (zapi: ZapiInstance) => {
        console.log(`[Auth] Plugin initialized`)
        console.log(`[Auth] Mode: ${mode}`)
        console.log(`[Auth] Routes: ${basePath}/*`)
        console.log(`[Auth] Bearer auth: ${mode === "jwt" || mode === "bearer" || options.bearer !== false ? "enabled" : "disabled"}`)
        console.log(`[Auth] JWT tokens: ${mode === "jwt" ? "enabled" : "disabled"}`)
        console.log(`[Auth] Email/password: ${options.emailAndPassword !== false ? "enabled" : "disabled"}`)
        
        if (options.providers) {
          const providers = Object.keys(options.providers).filter(
            (key) => (options.providers as any)[key]
          )
          if (providers.length > 0) {
            console.log(`[Auth] OAuth providers: ${providers.join(", ")}`)
          }
        }
      },
    },
  })
}

// -----------------------------------------------------------------------------
// Default export
// -----------------------------------------------------------------------------

export default auth
