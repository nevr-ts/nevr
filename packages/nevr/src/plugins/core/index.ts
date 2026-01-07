// =============================================================================
// PLUGIN CORE
// Re-exports all plugin system components
// =============================================================================

// Contract & Types
export * from "./contract.js"

// API Helpers
export {
  createNevrMiddleware,
  createNevrEndpoint,
  createInternalAdapter,
  mergeSchema,
  getEndpointResponse,
  APIError,
} from "./api.js"
export type {
  HookEndpointContext,
  NevrContext,
  InternalAdapter,
  NevrMiddleware,
  EndpointContext,
  EndpointOptions,
  Endpoint,
  RequestHook,
  RequestHooks,
  EntityHookContext,
  EntityHook,
  DatabaseHooks,
  PluginInitReturn,
} from "./api.js"

// Type Inference
export {
  defineConfig,
} from "./inference.js"
export type {
  FieldTypeToTS,
  InferEntityFromSchema,
  InferEntitiesFromPluginSchema,
  InferPluginTypes,
  InferPluginEndpoints,
  InferPluginErrorCodes,
  MergePlugins,
  NevrInstanceType,
  InferServerPlugin,
  InferPlugin,
  InferEntity,
  InferEndpoints,
  InferErrorCodes,
  InferPathMethods,
  PathMethodMap,
  InferEntityRoutes,
  CreateServerType,
  InferClientFromServer,
} from "./inference.js"

// Plugin Registry
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
} from "./registry.js"

// Plugin Resolver
export {
  resolvePlugin,
  getPluginFieldExtensions,
  mergeResolvedPlugins,
  getEntityRoutePath,
  isEntityRouteDisabled,
  getEntityRouteHandler,
} from "./resolver.js"
export type { MergedPlugins } from "./resolver.js"

// Plugin Entity Reference
export {
  plugin,
  parseEntityRef,
  resolveEntityRef,
  clearEntityCache,
  getPluginEntityFn,
} from "./reference.js"

// Entity-First Schema (use entity DSL for plugin schemas)
export {
  pluginEntity,
  defineSchema,
  schemaFromEntities,
  entitiesToSchema,
  PluginEntityBuilder,
  PluginSchemaBuilder,
} from "./entity-schema.js"
export type { PluginEntityOptions, SchemaBuilderOptions } from "./entity-schema.js"

// Endpoint Abstraction (custom routes → entity operations)
export {
  transaction,
  mapRoute,
  createEntityContext,
  filterInput,
  filterOutput,
} from "./endpoint.js"
export type {
  EntityOperationType,
  EntityOperation,
  TransactionConfig,
  RouteMapping,
  EntityContext,
} from "./endpoint.js"

// Shorthand API (add/extend/remove)
export {
  schema,
  addEntity,
  extendEntity,
  protectedField,
  hiddenField,
  secretField,
  commonFields,
  SchemaShorthand,
} from "./shorthand.js"
export type {
  AddEntityOptions,
  ExtendEntityOptions,
  RemoveEntityOptions,
  RemoveFieldOptions,
} from "./shorthand.js"

// Entity Actions (non-CRUD operations)
export {
  action,
  getAction,
  postAction,
  defineActions,
  executeAction,
  ActionBuilder,
  // Pre-built actions
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
} from "./actions.js"
export type {
  ActionMethod,
  ActionContext,
  ActionResult,
  ActionHandler,
  ActionDefinition,
  EntityActions,
} from "./actions.js"
