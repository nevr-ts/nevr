// =============================================================================
// AUTH PLUGIN SCHEMA (ENTITY-FIRST)
// Uses Nevr's entity DSL for rich field definitions and type safety
// =============================================================================

import { entity, string, bool, datetime, text, schemaFromEntities } from "../../index.js"

import type { PluginSchema, EntityDefinition } from "../unified/types.js"

// -----------------------------------------------------------------------------
// User Entity
// Entity-First: Uses field DSL with rich validation and security
// -----------------------------------------------------------------------------

export const userEntity = entity("user", {
    // Email with validation, normalization, and uniqueness
    email: string.email().trim().lower().unique(),

    // Email verification status - read-only from API
    emailVerified: bool.default(false).writable("none"),

    // Display name
    name: string,

    // Profile image URL
    image: string.optional(),

    // Timestamps managed automatically
})
    .timestamps(true)
    .build()

// -----------------------------------------------------------------------------
// Session Entity
// Internal: No CRUD routes exposed, managed by auth endpoints
// -----------------------------------------------------------------------------

export const sessionEntity = entity("session", {
    // Secure session token - hidden from responses
    token: string.unique().omit().writable("none"),

    // Reference to user
    userId: string.writable("none"),

    // Session expiration
    expiresAt: datetime.writable("none"),

    // Request metadata for security
    ipAddress: string.optional().writable("none"),
    userAgent: string.optional().writable("none"),
})
    .timestamps(true)
    .build()

// -----------------------------------------------------------------------------
// Account Entity
// Stores credentials and OAuth provider data
// Internal: No direct CRUD access
// -----------------------------------------------------------------------------

export const accountEntity = entity("account", {
    // Link to user
    userId: string.writable("none"),

    // Provider info (e.g., "credential", "google", "github")
    providerId: string.writable("none"),

    // Account ID from provider (user ID for credentials)
    accountId: string.writable("none"),

    // Hashed password - never exposed, auto-hashed on write
    password: string.password().omit().optional().writable("none"),

    // OAuth tokens - never exposed
    accessToken: text.optional().omit().writable("none"),
    refreshToken: text.optional().omit().writable("none"),
    expiresAt: datetime.optional().writable("none"),
})
    .timestamps(true)
    .build()

// -----------------------------------------------------------------------------
// Verification Entity
// For email verification and password reset tokens
// Internal: No direct access
// -----------------------------------------------------------------------------

export const verificationEntity = entity("verification", {
    // What this token is for (e.g., email, password-reset)
    identifier: string.writable("none"),

    // The token value - never exposed
    value: string.omit().writable("none"),

    // When the token expires
    expiresAt: datetime.writable("none"),
})
    .timestamps(false) // No timestamps needed for tokens
    .build()

// -----------------------------------------------------------------------------
// Combined Auth Schema
// -----------------------------------------------------------------------------

/**
 * Auth plugin schema built from entities
 * Uses Entity-First approach for type safety and rich validation
 */
export const authSchema = schemaFromEntities(
    [userEntity, sessionEntity, accountEntity, verificationEntity],
    {
        // These entities don't get automatic CRUD routes
        internal: ["session", "account", "verification"],
    }
)

/**
 * Entity definition for extending user fields from plugin options
 * Uses EntityDefinition with FieldBuilder for type safety
 */
export const baseUserDefinition: EntityDefinition = {
    description: "User account for authentication",
    fields: {
        email: string.email().trim().lower().unique(),
        emailVerified: bool.default(false).writable("none"),
        name: string,
        image: string.optional(),
    },
}

/**
 * Get auth schema with custom user fields
 */
export function getAuthSchema(options?: {
    userFields?: Record<string, any>
    sessionFields?: Record<string, any>
}): PluginSchema {
    return {
        entities: {
            user: {
                ...baseUserDefinition,
                fields: {
                    ...baseUserDefinition.fields,
                    ...options?.userFields,
                },
            },
            session: {
                description: "User session for authentication",
                internal: true,
                fields: {
                    token: string.unique().omit().writable("none"),
                    userId: string.writable("none"),
                    expiresAt: datetime.writable("none"),
                    ipAddress: string.optional().writable("none"),
                    userAgent: string.optional().writable("none"),
                    ...options?.sessionFields,
                },
            },
            account: {
                description: "Authentication provider account",
                internal: true,
                fields: {
                    userId: string.writable("none"),
                    providerId: string.writable("none"),
                    accountId: string.writable("none"),
                    password: string.password().omit().optional().writable("none"),
                    accessToken: text.optional().omit().writable("none"),
                    refreshToken: text.optional().omit().writable("none"),
                    expiresAt: datetime.optional().writable("none"),
                },
            },
            verification: {
                description: "Verification tokens",
                internal: true,
                fields: {
                    identifier: string.writable("none"),
                    value: string.omit().writable("none"),
                    expiresAt: datetime.writable("none"),
                },
            },
        },
    }
}
