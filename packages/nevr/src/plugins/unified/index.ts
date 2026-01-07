// =============================================================================
// UNIFIED PLUGIN SYSTEM
// Main export file for unified plugin system
// =============================================================================

// Types
export type {
    UnifiedPlugin,
    UnifiedPluginFactory,
    UnifiedPluginMeta,
    LifecycleHooks,
    EntityHooks,
    EntityHook,
    EntityHookContext,
    RequestInterceptors,
    Interceptor,
    InterceptorContext,
    InterceptorHandler,
    PathMatcher,
    PluginSchema,
    FieldDefinition,
    FieldDefinitionObject,
    EntityDefinition,
    Migration,
    PluginExtension,
    RateLimitRule,
    InferPluginOptions,
    // Part 8: Rich dependencies
    PluginDependency,
    DependencySpec,
} from "./types.js"

export { isUnifiedPlugin } from "./types.js"

// Compatibility
export {
    normalizePlugin,
    normalizePlugins,
    normalizeNewPlugin,
    validateUnifiedPlugin,
    isNewPlugin,
} from "./compat.js"

// Lifecycle
export {
    LifecycleManager,
    getLifecycleManager,
    setLifecycleManager,
    clearLifecycleManager,
    registerAndInitializePlugins,
    executeLifecycleHook,
} from "./lifecycle.js"

// Helpers
export {
    matchPath,
    matchAny,
    matchPrefix,
    matchRegex,
    matchAll,
    matchAnyOf,
} from "./helpers.js"

// Facade - Recommended API
export {
    createPlugin,
    createPluginFactory,
    createLifecyclePlugin,
    createEntityHooksPlugin,
    createInterceptorPlugin,
    detectPluginType,
    isValidPlugin,
    processPlugin,
    processPlugins,
} from "./facade.js"

export type { CreatePluginOptions, PluginType, AnyPlugin } from "./facade.js"

// Endpoint helpers (better-auth inspired)
export { endpoint } from "./endpoint.js"
export type {
    EndpointContext,
    EndpointConfig,
    EndpointDefinition,
    InferEndpointInput,
    InferEndpointOutput,
    EndpointsRecord,
    InferClientMethods,
} from "./endpoint.js"

// Re-export for convenience
export type { Plugin as LegacyPlugin } from "../../types.js"
export type { NevrPlugin as NewPlugin } from "../core/contract.js"
