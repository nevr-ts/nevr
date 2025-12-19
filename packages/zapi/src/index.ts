// =============================================================================
// NEVR
// Nevr write boilerplate again - Framework Agnostic API Builder
// =============================================================================

// Types
export type {
  // Field types
  FieldType,
  FieldDef,
  RelationDef,

  // Entity types
  Entity,
  EntityConfig,
  Operation,

  // User & Auth
  User,

  // Rules
  RuleContext,
  RuleFn,
  RuleDef,
  BuiltInRule,

  // Request/Response
  ZapiRequest,
  ZapiResponse,

  // Query
  QueryOptions,
  Where,
  WhereOperator,

  // Driver
  Driver,

  // Middleware
  Middleware,
  MiddlewareContext,
  MiddlewareFn,

  // Hooks
  Hooks,
  HookContext,
  HookFn,

  // Plugin
  Plugin,
  Route,

  // Adapter
  Adapter,
  AdapterOptions,

  // Validation
  ValidationError,
  ValidationResult,

  // Error
  ErrorCode,
  ZapiError,

  // Config & Instance
  ZapiConfig,
  ZapiInstance,
  CorsOptions,
  SecurityOptions,
} from "./types.js"

// Fields DSL
export {
  string,
  text,
  int,
  float,
  bool,
  boolean,
  datetime,
  json,
  email,
  belongsTo,
  hasMany,
  hasOne,
  FieldBuilder,
  RelationBuilder,
} from "./fields.js"

// Entity DSL
export { entity, EntityBuilder, resolveEntity } from "./entity.js"

// Rules
export {
  everyone,
  authenticated,
  admin,
  owner,
  ownerOrAdmin,
  checkRules,
  resolveRule,
  getRulesForOperation,
} from "./rules.js"

// Validation
export { validateInput, validateQueryParams } from "./validation.js"

// Errors
export {
  ZapiErrorClass,
  createErrorResponse,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
  internalError,
  handleError,
} from "./error.js"

// Plugin System
export {
  createHookContext,
  executeHook,
  executeErrorHook,
  createPlugin,
  registerPlugin,
  unregisterPlugin,
  getPlugin,
  listPlugins,
  clearPluginRegistry,
  checkPluginConflicts,
  schemaToEntities,
  applyPluginFields,
  applyPluginEntities,
  collectMiddleware,
  collectRoutes,
  initializePlugins,
  PluginBuilder,
} from "./plugin.js"

export type { PluginConfig, PluginSchema } from "./plugin.js"

// New Plugin System (Core)
export {
  definePlugin,
  simplePlugin,
  registerPluginFactory,
  getPluginFactory,
  createFromFactory,
  registerPluginInstance,
  getPluginInstance,
  getPluginEntity,
  markPluginInitialized,
  isPluginInitialized,
  getAllPlugins,
  clearPluginFactories,
  resolveAllPlugins,
  initializeAllPlugins,
  validatePlugin,
  resolvePlugin,
  getPluginFieldExtensions,
  mergeResolvedPlugins,
  plugin,
  parseEntityRef,
  resolveEntityRef,
  clearEntityCache,
} from "./plugins/core/index.js"

export type {
  ZapiPlugin,
  PluginMeta,
  PluginFactory,
  PluginExtension,
  DefinePluginOptions,
} from "./plugins/core/index.js"

// Driver System (Database abstraction)
export {
  createDriverFactory,
} from "./driver/index.js"

export type {
  DriverFactoryConfig,
  DriverDebugLogOption,
  DriverFactoryOptions,
  CustomDriverMethods,
} from "./driver/index.js"

// Adapter System (HTTP framework abstraction)
export {
  createAdapterFactory,
} from "./adapter/index.js"

export type {
  AdapterConfig,
  AdapterRequest,
  AdapterResponse,
  AdapterContext,
  AdapterFactoryOptions,
  CustomAdapterMethods,
} from "./adapter/index.js"

// Router
export { matchRoute, pluralize, singularize } from "./router.js"

// Main factory
export { zapi } from "./nevr.js"

// =============================================================================
// ADAPTERS (HTTP framework integrations)
// =============================================================================
// Note: Adapters are available via subpath imports:
// - nevr/adapters/express
// - nevr/adapters/hono
// Direct imports avoid loading unused adapters

// =============================================================================
// DRIVERS (Database integrations)
// =============================================================================
// Note: Drivers are available via subpath imports:
// - nevr/drivers/prisma
// Direct imports avoid loading unused drivers

// =============================================================================
// PLUGINS (Feature extensions)
// =============================================================================
// Note: Plugins are available via subpath imports:
// - nevr/plugins/auth
// - nevr/plugins/payments
// - nevr/plugins/storage
// - nevr/plugins/timestamps
// Direct imports avoid loading optional dependencies like better-auth
