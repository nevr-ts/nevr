// =============================================================================
// AUTH PLUGIN TYPES
// =============================================================================

import type { Entity } from "../../types.js"
import type { PluginExtension } from "../core/contract.js"

// -----------------------------------------------------------------------------
// OAuth Provider Configuration
// -----------------------------------------------------------------------------

export interface GoogleProvider {
  clientId: string
  clientSecret: string
  scopes?: string[]
}

export interface GitHubProvider {
  clientId: string
  clientSecret: string
  scopes?: string[]
}

export interface DiscordProvider {
  clientId: string
  clientSecret: string
  scopes?: string[]
}

export interface AppleProvider {
  clientId: string
  clientSecret: string
  scopes?: string[]
}

export interface Providers {
  google?: GoogleProvider
  github?: GitHubProvider
  discord?: DiscordProvider
  apple?: AppleProvider
}

// -----------------------------------------------------------------------------
// Email Configuration
// -----------------------------------------------------------------------------

export interface EmailConfig {
  from: string
  sendEmail: (params: {
    to: string
    subject: string
    html: string
    text?: string
  }) => Promise<void>
}

// -----------------------------------------------------------------------------
// Session Configuration
// -----------------------------------------------------------------------------

export interface SessionConfig {
  /** Session expiry in seconds. Default: 7 days */
  expiresIn?: number
  /** Update session expiry on each request. Default: true */
  updateAge?: number
  /** Cookie name. Default: "better-auth.session_token" */
  cookieName?: string
}

// -----------------------------------------------------------------------------
// User Configuration
// -----------------------------------------------------------------------------

export interface UserConfig {
  /** Model name in database (if different from 'user') */
  modelName?: string
  /** Map field names to different column names */
  fields?: Partial<Record<"email" | "name" | "image" | "createdAt" | "updatedAt" | "emailVerified", string>>
  /** Map OAuth profile to user fields */
  mapProfileToUser?: (profile: Record<string, unknown>) => Record<string, unknown>
}

// -----------------------------------------------------------------------------
// JWT Configuration
// -----------------------------------------------------------------------------

export interface JwtConfig {
  /** JWT expiration time. Default: "15m" */
  expirationTime?: string
  /** JWT issuer. Default: baseURL */
  issuer?: string
  /** JWT audience. Default: baseURL */
  audience?: string
}

// -----------------------------------------------------------------------------
// Main Plugin Options
// -----------------------------------------------------------------------------

export interface AuthPluginOptions {
  /** 
   * Better Auth secret. Required.
   * Default: process.env.BETTER_AUTH_SECRET 
   */
  secret?: string
  
  /** 
   * Base URL of your app.
   * Default: process.env.BETTER_AUTH_URL 
   */
  baseURL?: string
  
  /**
   * Authentication mode:
   * - "session": Cookie-based sessions (default)
   * - "bearer": Session tokens as Bearer tokens (for APIs)
   * - "jwt": Full JWT mode with JWKS verification (for APIs + external services)
   * Default: "session"
   */
  mode?: "session" | "bearer" | "jwt"
  
  /** 
   * Enable Bearer token authentication (for APIs).
   * Automatically enabled for "bearer" and "jwt" modes.
   * Default: true
   */
  bearer?: boolean
  
  /**
   * JWT configuration (only used in "jwt" mode)
   */
  jwt?: JwtConfig
  
  /**
   * Enable email/password authentication.
   * Default: true
   */
  emailAndPassword?: boolean
  
  /**
   * OAuth providers configuration
   */
  providers?: Providers
  
  /**
   * Email configuration for verification and password reset
   */
  email?: EmailConfig
  
  /**
   * Session configuration
   */
  session?: SessionConfig
  
  /**
   * User configuration
   */
  user?: UserConfig
  
  /**
   * Trusted origins for CORS
   */
  trustedOrigins?: string[]
  
  /**
   * Base path for auth routes.
   * Default: "/auth"
   */
  basePath?: string

  /**
   * Plugin extension for customizing entities, routes, and behavior
   */
  extend?: PluginExtension
}

// -----------------------------------------------------------------------------
// Auth User (from Better Auth)
// -----------------------------------------------------------------------------

export interface AuthUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

// -----------------------------------------------------------------------------
// Auth Session (from Better Auth)
// -----------------------------------------------------------------------------

export interface AuthSession {
  id: string
  userId: string
  token: string
  expiresAt: Date
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: Date
  updatedAt: Date
}
