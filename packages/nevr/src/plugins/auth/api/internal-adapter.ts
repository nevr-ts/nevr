// =============================================================================
// API - INTERNAL ADAPTER
// Database operations abstraction for auth plugin
// Entity-first compliant: uses enhancements when entities are provided
// =============================================================================

import type { Driver, Entity } from "../../../types.js"
import type {
    AuthUser,
    AuthSession,
    AuthAccount,
    AuthVerification,
    InternalAdapter,
} from "../types.js"
import { generateId, generateSessionToken } from "../crypto/index.js"
import { getExpiryDate, isExpired } from "../cookies/session-cookie.js"
import {
    enhanceWriteData,
    enhanceReadData,
    hasEnhancements,
} from "../../../enhancements/index.js"

// -----------------------------------------------------------------------------
// Email Normalization
// -----------------------------------------------------------------------------

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
    return email.toLowerCase().trim()
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// -----------------------------------------------------------------------------
// Internal Adapter Factory
// -----------------------------------------------------------------------------

export interface InternalAdapterConfig {
    /** Session expiry in seconds */
    sessionExpiresIn: number
    /** Hooks to run on user/session creation */
    hooks?: {
        beforeCreateUser?: (data: Partial<AuthUser>) => Promise<Partial<AuthUser>> | Partial<AuthUser>
        afterCreateUser?: (user: AuthUser) => Promise<void> | void
        beforeCreateSession?: (userId: string) => Promise<void> | void
        afterCreateSession?: (session: AuthSession) => Promise<void> | void
    }
    /**
     * Entity definitions for entity-first compliance
     * When provided, adapter will use enhancements (transforms, validation, security)
     */
    entities?: {
        user?: Entity
        session?: Entity
        account?: Entity
        verification?: Entity
    }
}

/**
 * Create internal adapter for database operations
 * This is the data access layer for auth operations
 * 
 * @param driver - Nevr database driver
 * @param config - Adapter configuration
 * @returns Internal adapter
 */
export function createInternalAdapter(
    driver: Driver,
    config: InternalAdapterConfig
): InternalAdapter {
    const hooks = config.hooks ?? {}
    const entities = config.entities ?? {}

    // Helper to apply write enhancements if entity is available
    async function applyWriteEnhancements<T>(
        data: T,
        entityKey: keyof typeof entities,
        operation: "create" | "update" = "create"
    ): Promise<T> {
        const entity = entities[entityKey]
        if (entity && hasEnhancements(entity)) {
            return await enhanceWriteData(data as Record<string, unknown>, entity, operation, {
                skipValidation: false,
            }) as T
        }
        return data
    }

    // Helper to apply read enhancements if entity is available
    async function applyReadEnhancements<T>(
        data: T | null,
        entityKey: keyof typeof entities
    ): Promise<T | null> {
        if (!data) return null
        const entity = entities[entityKey]
        if (entity && hasEnhancements(entity)) {
            return await enhanceReadData(data as Record<string, unknown>, entity, {}) as T
        }
        return data
    }

    return {
        // -----------------------------------------------------------------
        // User Operations
        // -----------------------------------------------------------------

        async findUserByEmail(email, opts) {
            const rawUser = await driver.findOne<AuthUser>("user", { email: normalizeEmail(email) })
            if (!rawUser) return null

            // Apply read enhancements (omit password, etc.)
            const user = await applyReadEnhancements<AuthUser>(rawUser, "user")
            if (!user) return null

            let accounts: AuthAccount[] = []
            if (opts?.includeAccounts) {
                accounts = await driver.findMany<AuthAccount>("account", { where: { userId: user.id } })
            }
            return { user, accounts }
        },

        async createUser(data) {
            const now = new Date()
            let userData: Record<string, unknown> = {
                id: generateId(),
                ...data,
                email: data.email ? normalizeEmail(data.email) : undefined,
                createdAt: now,
                updatedAt: now,
            }

            // Run beforeCreateUser hook
            if (hooks.beforeCreateUser) {
                const result = await hooks.beforeCreateUser(userData as Partial<AuthUser>)
                userData = { ...userData, ...result }
            }

            // Apply write enhancements (transforms, security like password hashing)
            userData = await applyWriteEnhancements(userData, "user", "create")

            const rawUser = await driver.create<AuthUser>("user", userData)

            // Apply read enhancements before returning
            const user = await applyReadEnhancements<AuthUser>(rawUser, "user")
            if (!user) return rawUser // Fallback if enhancement returns null

            // Run afterCreateUser hook
            if (hooks.afterCreateUser) {
                await hooks.afterCreateUser(user)
            }

            return user
        },

        async updateUser(id: string, data: Partial<AuthUser>) {
            // Apply write enhancements
            const enhancedData = await applyWriteEnhancements<Partial<AuthUser>>(
                { ...data, updatedAt: new Date() },
                "user",
                "update"
            )
            const rawUser = await driver.update<AuthUser>("user", { id }, enhancedData)
            return await applyReadEnhancements<AuthUser>(rawUser, "user")
        },

        // -----------------------------------------------------------------
        // Account Operations (OAuth providers)
        // -----------------------------------------------------------------

        async linkAccount(data) {
            const now = new Date()
            return await driver.create<AuthAccount>("account", {
                id: generateId(),
                ...data,
                createdAt: now,
                updatedAt: now,
            })
        },

        async findAccountByUserId(userId: string, providerId: string) {
            return await driver.findOne<AuthAccount>("account", { userId, providerId })
        },

        async findAccountByProviderId(providerId: string, accountId: string) {
            return await driver.findOne<AuthAccount>("account", { providerId, accountId })
        },

        // -----------------------------------------------------------------
        // Session Operations
        // -----------------------------------------------------------------

        async createSession(userId, dontRemember) {
            // Run beforeCreateSession hook
            if (hooks.beforeCreateSession) {
                await hooks.beforeCreateSession(userId)
            }

            const now = new Date()
            const expiresIn = dontRemember ? 60 * 60 * 24 : config.sessionExpiresIn

            const session = await driver.create<AuthSession>("session", {
                id: generateId(),
                token: generateSessionToken(),
                userId,
                expiresAt: getExpiryDate(expiresIn),
                createdAt: now,
                updatedAt: now,
            })

            // Run afterCreateSession hook
            if (hooks.afterCreateSession) {
                await hooks.afterCreateSession(session)
            }

            return session
        },

        async findSession(token) {
            const rawSession = await driver.findOne<AuthSession>("session", { token })
            if (!rawSession) return null

            if (isExpired(new Date(rawSession.expiresAt))) {
                await driver.delete("session", { id: rawSession.id })
                return null
            }

            const rawUser = await driver.findOne<AuthUser>("user", { id: rawSession.userId })
            if (!rawUser) return null

            // Apply read enhancements to both session and user
            const session = await applyReadEnhancements<AuthSession>(rawSession, "session")
            const user = await applyReadEnhancements<AuthUser>(rawUser, "user")

            if (!session || !user) return null

            return { session, user }
        },

        async updateSession(token, data) {
            const session = await driver.findOne<AuthSession>("session", { token })
            if (!session) return null
            return await driver.update<AuthSession>(
                "session",
                { id: session.id },
                { ...data, updatedAt: new Date() }
            )
        },

        async deleteSession(token) {
            await driver.delete("session", { token })
        },

        async listSessions(userId) {
            return await driver.findMany<AuthSession>("session", { where: { userId } })
        },

        async deleteSessions(userId) {
            const sessions = await driver.findMany<AuthSession>("session", { where: { userId } })
            for (const session of sessions) {
                await driver.delete("session", { id: session.id })
            }
        },

        // -----------------------------------------------------------------
        // Verification Operations (email, password reset)
        // -----------------------------------------------------------------

        async createVerification(data) {
            return await driver.create<AuthVerification>("verification", {
                id: generateId(),
                ...data,
            })
        },

        async findVerification(identifier, value) {
            return await driver.findOne<AuthVerification>("verification", { identifier, value })
        },

        async deleteVerification(id) {
            await driver.delete("verification", { id })
        },
    }
}
