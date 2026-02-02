// =============================================================================
// PLUGINS
// Feature plugins for nevr
// =============================================================================

// -----------------------------------------------------------------------------
// Canonical Types (preferred - import types from here)
// -----------------------------------------------------------------------------
export * from "./types.js"

// -----------------------------------------------------------------------------
// Unified Plugin System (RECOMMENDED API)
// Use these for all new plugins
// -----------------------------------------------------------------------------

// Primary API - THE ONE function for creating plugins
export {
    createPlugin,           // ← Use this for ALL new plugins
    detectPluginType,
    isValidPlugin,
    processPlugin,
    processPlugins,
    normalizePlugin,
    normalizePlugins,
    validateUnifiedPlugin,
} from "./unified/facade.js"

// Convenience helpers for simple plugins (use createPlugin for complex ones)
export {
    createLifecyclePlugin,      // Simple lifecycle-only plugin
    createEntityHooksPlugin,    // Simple entity hooks plugin
    createInterceptorPlugin,    // Simple interceptor plugin
} from "./unified/facade.js"

export {
    LifecycleManager,
    getLifecycleManager,
    setLifecycleManager,
    clearLifecycleManager,
    registerAndInitializePlugins,
    executeLifecycleHook,
} from "./unified/lifecycle.js"

export {
    matchPath,
    matchAny,
    matchPrefix,
    matchRegex,
    matchAll,
    matchAnyOf,
} from "./unified/helpers.js"

// -----------------------------------------------------------------------------
// Registry Functions (internal/advanced use)
// -----------------------------------------------------------------------------
export {
    registerPluginInstance,
    getPluginInstance,
    getPluginEntity,
    markPluginInitialized,
    isPluginInitialized,
    getAllPlugins,
    clearPluginRegistry,
    resolveAllPlugins,
    initializeAllPlugins,
    validatePlugin,
} from "./core/registry.js"

// Resolver
export {
    resolvePlugin,
    getPluginFieldExtensions,
    mergeResolvedPlugins,
    getEntityRoutePath,
    isEntityRouteDisabled,
    getEntityRouteHandler,
} from "./core/resolver.js"

// Reference system
export {
    plugin,
    parseEntityRef,
    resolveEntityRef,
    clearEntityCache,
    getPluginEntityFn,
} from "./core/reference.js"

// API helpers
export {
    createNevrMiddleware,
    createNevrEndpoint,
    createInternalAdapter,
    mergeSchema,
    getEndpointResponse,
} from "./core/api.js"

// Entity-First Schema
export {
    pluginEntity,
    defineSchema,
    schemaFromEntities,
    entitiesToSchema,
    PluginEntityBuilder,
    PluginSchemaBuilder,
} from "./core/entity-schema.js"

// Endpoint abstraction
export {
    transaction,
    mapRoute,
    createEntityContext,
    filterInput,
    filterOutput,
} from "./core/endpoint.js"

// Shorthand API
export {
    schema,
    addEntity,
    extendEntity,
    protectedField,
    hiddenField,
    secretField,
    commonFields,
    SchemaShorthand,
} from "./core/shorthand.js"

// Entity Actions
export {
    action,
    getAction,
    postAction,
    defineActions,
    executeAction,
    ActionBuilder,
    softDeleteAction,
    restoreAction,
    archiveAction,
    unarchiveAction,
    cloneAction,
    bulkUpdateAction,
    bulkDeleteAction,
    toggleAction,
    exportAction,
    countAction,
    existsAction,
} from "./core/actions.js"

// Type inference
export { defineConfig } from "./core/inference.js"

// =============================================================================
// CANONICAL IMPORT PATHS
// =============================================================================
// Each plugin has ONE canonical import path:
//
// Main plugins:
//   import { auth } from "nevr/plugins/auth"
//   import { organization } from "nevr/plugins/organization"
//   import { storage } from "nevr/plugins/storage"
//   import { payment } from "nevr/plugins/payment"
//   import { timestamps } from "nevr/plugins/timestamps"
//   import { rag } from "nevr/rag"
//   import { aiGateway } from "nevr/ai-gateway"
//
// Auth sub-plugins:
//   import { username } from "nevr/plugins/auth/username"
//   import { anonymous } from "nevr/plugins/auth/anonymous"
//   import { twoFactor } from "nevr/plugins/auth/two-factor"
//   import { magicLink } from "nevr/plugins/auth/magic-link"
//   import { phoneNumber } from "nevr/plugins/auth/phone-number"
//
// Client plugins (for frontend):
//   import { authClient } from "nevr/plugins/auth/client"
//   import { usernameClient } from "nevr/plugins/auth/username/client"
//   import { organizationClient } from "nevr/plugins/organization/client"
//   import { paymentClient } from "nevr/plugins/payment/client"
//   import { storageClient } from "nevr/plugins/storage/client"
//   import { ragClient } from "nevr/rag/client"
//   import { aiGatewayClient } from "nevr/ai-gateway/client"
// =============================================================================

// -----------------------------------------------------------------------------
// Timestamps Plugin (simple plugin, kept here for convenience)
// -----------------------------------------------------------------------------
export { timestamps } from "./timestamps.js"
