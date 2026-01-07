// =============================================================================
// API - AUTH HOOKS
// Hook system for auth plugin extensibility
// =============================================================================

import type { AuthUser, AuthSession } from "../types.js"

// -----------------------------------------------------------------------------
// Hook Definitions
// -----------------------------------------------------------------------------

export interface AuthPluginHooks {
    /** Called before creating a user */
    beforeCreateUser?: (data: Partial<AuthUser>) => Promise<Partial<AuthUser>> | Partial<AuthUser>
    /** Called after user is created */
    afterCreateUser?: (user: AuthUser) => Promise<void> | void
    /** Called before sign in attempt */
    beforeSignIn?: (email: string) => Promise<void> | void
    /** Called after successful sign in */
    afterSignIn?: (user: AuthUser, session: AuthSession) => Promise<void> | void
    /** Called before creating a session */
    beforeCreateSession?: (userId: string) => Promise<void> | void
    /** Called after session is created */
    afterCreateSession?: (session: AuthSession) => Promise<void> | void
    /** Called before sign out */
    beforeSignOut?: (userId: string) => Promise<void> | void
    /** Called after sign out */
    afterSignOut?: (userId: string) => Promise<void> | void
    /** Called after email is verified */
    afterEmailVerified?: (user: AuthUser | null) => Promise<void> | void
}

// -----------------------------------------------------------------------------
// Hook Registry
// -----------------------------------------------------------------------------

const hookRegistry: AuthPluginHooks[] = []

/**
 * Register hooks for auth plugin (used by sub-plugins)
 * 
 * @example
 * ```typescript
 * // In a sub-plugin
 * registerAuthHooks({
 *     beforeCreateUser: async (data) => {
 *         data.role = 'user'
 *         return data
 *     },
 *     afterSignIn: async (user) => {
 *         console.log(`User ${user.email} signed in`)
 *     },
 * })
 * ```
 */
export function registerAuthHooks(hooks: AuthPluginHooks): void {
    hookRegistry.push(hooks)
}

/**
 * Clear all registered hooks (for testing)
 */
export function clearAuthHooks(): void {
    hookRegistry.length = 0
}

/**
 * Get all registered hooks
 */
export function getAuthHooks(): readonly AuthPluginHooks[] {
    return hookRegistry
}

// -----------------------------------------------------------------------------
// Hook Runners
// -----------------------------------------------------------------------------

/**
 * Run a specific hook across all registered hooks
 */
export async function runHook<K extends keyof AuthPluginHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<AuthPluginHooks[K]>>
): Promise<void> {
    for (const hooks of hookRegistry) {
        const hook = hooks[hookName]
        if (hook) {
            await (hook as Function)(...args)
        }
    }
}

/**
 * Run beforeCreateUser hook (special case - returns modified data)
 */
export async function runBeforeCreateUser(data: Partial<AuthUser>): Promise<Partial<AuthUser>> {
    let result = { ...data }
    for (const hooks of hookRegistry) {
        if (hooks.beforeCreateUser) {
            const modified = await hooks.beforeCreateUser(result)
            result = { ...result, ...modified }
        }
    }
    return result
}

/**
 * Create hook adapter for internal adapter
 */
export function createHookAdapter(): {
    beforeCreateUser: (data: Partial<AuthUser>) => Promise<Partial<AuthUser>>
    afterCreateUser: (user: AuthUser) => Promise<void>
    beforeCreateSession: (userId: string) => Promise<void>
    afterCreateSession: (session: AuthSession) => Promise<void>
} {
    return {
        beforeCreateUser: runBeforeCreateUser,
        afterCreateUser: async (user) => runHook("afterCreateUser", user),
        beforeCreateSession: async (userId) => runHook("beforeCreateSession", userId),
        afterCreateSession: async (session) => runHook("afterCreateSession", session),
    }
}
