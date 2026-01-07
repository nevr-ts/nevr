// =============================================================================
// AUTH API - BARREL EXPORTS
// Main API module for auth plugin
// =============================================================================

// Routes (explicit exports to avoid duplicating types from types.js)
export { createRoutes } from "./routes/index.js"
export { signUpEmail, signUpEmailSchema } from "./routes/sign-up.js"
export { signInEmail, signInEmailSchema } from "./routes/sign-in.js"
export { signOut } from "./routes/sign-out.js"
export { getSession, listSessions, revokeSession, revokeSessions, revokeOtherSessions, revokeSessionSchema } from "./routes/session.js"

// Internal adapter
export { createInternalAdapter, normalizeEmail, isValidEmail } from "./internal-adapter.js"
export type { InternalAdapterConfig } from "./internal-adapter.js"

// Hooks
export {
    registerAuthHooks,
    clearAuthHooks,
    getAuthHooks,
    runHook,
    runBeforeCreateUser,
    createHookAdapter,
    type AuthPluginHooks,
} from "./hooks.js"

// Context helpers
export { getIpAddress, getUserAgent, getOrigin, getRequestContext } from "./context.js"
export type { RequestContext } from "./context.js"
