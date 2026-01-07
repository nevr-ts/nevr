// =============================================================================
// PLUGIN TYPES - CANONICAL TYPE DEFINITIONS
// Single source of truth for all plugin system types
// =============================================================================

// -----------------------------------------------------------------------------
// Re-export from Unified Types (preferred source)
// The unified system is the recommended plugin API
// -----------------------------------------------------------------------------

export type {
    // Metadata
    UnifiedPluginMeta as PluginMeta,
    PluginDependency,
    DependencySpec,

    // Path Matching
    PathMatcher,

    // Entity Hooks
    EntityHookContext,
    EntityHook,
    EntityHooks,

    // Request Interceptors
    InterceptorContext,
    InterceptorHandler,
    Interceptor,
    RequestInterceptors,

    // Lifecycle
    LifecycleHooks,

    // Schema
    FieldDefinitionObject,
    FieldDefinition,
    EntityDefinition,
    PluginSchema,

    // Migrations
    Migration,

    // Extensions
    PluginExtension,

    // Rate Limiting
    RateLimitRule,

    // Plugin Interface
    UnifiedPlugin as Plugin,
    UnifiedPluginFactory as PluginFactory,

    // Inference
    InferPluginOptions,
} from "./unified/types.js"

// Re-export the type guard function
export { isUnifiedPlugin as isPlugin } from "./unified/types.js"

// -----------------------------------------------------------------------------
// Re-export from Core API (context and endpoint types)
// -----------------------------------------------------------------------------

export type {
    // Context
    HookEndpointContext,
    NevrContext,
    InternalAdapter,

    // Endpoint Types
    NevrMiddleware,
    EndpointContext,
    EndpointOptions,
    Endpoint,

    // Request Hooks (legacy name, prefer Interceptors)
    RequestHook,
    RequestHooks,

    // Database Hooks (legacy name, prefer EntityHooks)
    DatabaseHooks,

    // Plugin Init
    PluginInitReturn,
} from "./core/api.js"

// Re-export APIError class
export { APIError } from "./core/api.js"

// -----------------------------------------------------------------------------
// Re-export from Core Contract (for backward compatibility)
// These should eventually be consolidated into unified types
// -----------------------------------------------------------------------------

export type {
    // Legacy plugin interface (deprecated, use Plugin)
    NevrPlugin,

    // Route handling
    RouteHandler,
    EntityRouteConfig,
    EntityRoutesConfig,

    // OpenAPI
    OpenAPIParameter,
    OpenAPIRequestBody,
    OpenAPIResponse,
    OpenAPIMetadata,

    // Registry (internal)
    PluginRegistryEntry,
    ResolvedEntityMeta,
    ResolvedPlugin,

    // Legacy request hooks (deprecated, use Interceptors)
    PluginRequestHook,
    PluginRequestHooks,

    // Legacy lifecycle (deprecated, use LifecycleHooks)
    PluginLifecycleHooks,

    // Legacy migration type (deprecated, use Migration)
    PluginMigration,
} from "./core/contract.js"

// -----------------------------------------------------------------------------
// Re-export Endpoint Definition from unified
// -----------------------------------------------------------------------------

export type {
    EndpointDefinition,
    EndpointConfig,
    InferEndpointInput,
    InferEndpointOutput,
    EndpointsRecord,
    InferClientMethods,
} from "./unified/endpoint.js"

// Re-export endpoint helper
export { endpoint } from "./unified/endpoint.js"

// -----------------------------------------------------------------------------
// Backward Compatibility Aliases
// These map old names to new names for migration
// -----------------------------------------------------------------------------

// Old names from core/contract.ts → new unified names
export type {
    UnifiedPluginMeta as NevrPluginMeta,
    FieldDefinitionObject as PluginFieldDefObject,
    FieldDefinition as PluginFieldDef,
    EntityDefinition as PluginEntityDef,
} from "./unified/types.js"
