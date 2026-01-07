// =============================================================================
// AUTH HOOKS
// Re-export from api/hooks for backward compatibility
// =============================================================================

export {
    registerAuthHooks,
    clearAuthHooks,
    getAuthHooks,
    runHook,
    runBeforeCreateUser,
    createHookAdapter,
    type AuthPluginHooks,
} from "./api/hooks.js"
