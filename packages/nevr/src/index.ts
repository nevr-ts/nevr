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

  // Entity Actions (Pillar 1 integration)
  EntityAction,
  EntityActionContext,
  EntityWorkflowConfig,
  EntityWorkflowStep,

  // Cross-Field Validation (Tier 2)
  EntityValidator,
  EntityValidatorFn,
  EntityValidatorContext,

  // Field-Level Access Policies (Tier 2)
  FieldAccessPolicy,
  FieldAccessPolicyRule,
  FieldAccessPolicyFn,
  FieldAccessContext,

  // User & Auth
  User,

  // Rules
  RuleContext,
  RuleFn,
  RuleDef,
  BuiltInRule,

  // Request/Response
  NevrRequest,
  NevrResponse,

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
  NevrError,

  // Config & Instance
  NevrConfig,
  NevrInstance,
  CorsOptions,
  SecurityOptions,

  // Service Registration
  ServiceRegistrationOptions,
  ServiceResolverContext,
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
  selfRef,
  jsonTyped,
  FieldBuilder,
  RelationBuilder,
  SelfRefBuilder,
  TypedFieldBuilder,
} from "./fields.js"

// Entity DSL
export { entity, EntityBuilder, resolveEntity, action, step, ActionBuilder } from "./entity.js"
export type { ActionDef } from "./entity.js"

// Pre-built Entity Actions
export {
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
} from "./plugins/core/actions.js"

// Rules
export {
  everyone,
  authenticated,
  admin,
  owner,
  ownerOrAdmin,
  defineRule,
  getRule,
  getRuleRegistry,
  isNamedRule,
  getRuleName,
  clearRuleRegistry,
  checkRules,
  resolveRule,
  getRulesForOperation,
} from "./rules.js"

export type { NamedRule } from "./rules.js"

// Validation
export { validateInput, validateQueryParams } from "./validation.js"

// Logger
export { getLogger, setLogger, noopLogger, consoleLogger, createPrefixedLogger } from "./logger.js"
export type { Logger } from "./logger.js"

// Utils
export { capitalize, pascalCase, camelCase, kebabCase, snakeCase, isValidIdentifier, isValidEntityName } from "./utils/index.js"

// Errors
export {
  // Base error class
  NevrErrorClass,
  // Specialized error classes
  EntityNotFoundError,
  ValidationFailedError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  PluginError,
  ConfigurationError,
  DatabaseError,
  // Error response builders
  createErrorResponse,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
  internalError,
  handleError,
  // Centralized error codes
  ErrorCodes,
  getHttpStatus,
} from "./error.js"


// Plugin Runtime
export {
  createHookContext,
  executeHook,
  executeErrorHook,
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
} from "./plugins/unified/runtime.js"

// =============================================================================
// PLUGIN SYSTEM
// =============================================================================

// Plugin Creation (RECOMMENDED - use these for all new plugins)
export {
  createPlugin,             // ← THE ONE function for creating plugins
  createLifecyclePlugin,    // Convenience: lifecycle-only plugins
  createEntityHooksPlugin,  // Convenience: entity hooks plugins
  createInterceptorPlugin,  // Convenience: interceptor plugins
  endpoint,                 // Helper for defining typed endpoints
} from "./plugins/unified/index.js"

// Plugin Detection & Validation
export {
  detectPluginType,
  isValidPlugin,
  processPlugin,
  processPlugins,
  isUnifiedPlugin,
  normalizePlugin,
  normalizePlugins,
  validateUnifiedPlugin,
} from "./plugins/unified/index.js"

// Lifecycle Management
export {
  LifecycleManager,
  getLifecycleManager,
  setLifecycleManager,
  clearLifecycleManager,
  registerAndInitializePlugins,
  executeLifecycleHook,
} from "./plugins/unified/index.js"

// -----------------------------------------------------------------------------
// Plugin Registry & Advanced (internal use)
// -----------------------------------------------------------------------------
export {
  registerPluginInstance,
  getPluginInstance,
  getPluginEntity,
  markPluginInitialized,
  isPluginInitialized,
  getAllPlugins,
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
  getPluginEntityFn,
  // Schema helpers
  schemaFromEntities,
  defineSchema,
  pluginEntity,
  entitiesToSchema,
} from "./plugins/core/index.js"

export type {
  NevrPlugin,
  PluginMeta,
  PluginSchema as NevrPluginSchema,
  PluginExtension,
  PluginFactory,
  ResolvedPlugin,
  PluginMigration,
  EndpointDefinition,
  EndpointInput,
  EndpointOutput,
  OpenAPIMetadata,
} from "./plugins/core/contract.js"

export type {
  CreatePluginOptions,
  PluginType,
  AnyPlugin,
} from "./plugins/unified/facade.js"

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
  EntityDefinition,
  Migration,
  RateLimitRule,
  InferPluginOptions,
} from "./plugins/unified/types.js"

// Context System (Global State Management)
export {
  createNevrContext,
  getGlobalContext,
  setGlobalContext,
  clearGlobalContext,
  RuleRegistry,
  PluginManager,
} from "./context.js"

export type { NevrContext } from "./context.js"

// Driver System (Database abstraction)
export {
  createDriverFactory,
} from "./drivers/base.js"

export type {
  DriverFactoryConfig,
  DriverDebugLogOption,
  DriverFactoryOptions,
  CustomDriverMethods,
} from "./drivers/base.js"

// Adapter System (HTTP framework abstraction)
export {
  createAdapterFactory,
} from "./adapters/escape-hatch.js"

export type {
  AdapterConfig,
  AdapterRequest,
  AdapterResponse,
  AdapterContext,
  AdapterFactoryOptions,
  CustomAdapterMethods,
} from "./adapters/escape-hatch.js"

// Router
export { matchRoute, pluralize, singularize } from "./router.js"

// Main factory
export { nevr, type TypedNevrInstance } from "./nevr.js"

// Service Container (Pillar 3: Functional DI)
export {
  ServiceContainer,
  ScopedContainer,
  getGlobalContainer,
  setGlobalContainer,
  clearGlobalContainer,
  createScope,
  createService,
  lazyService,
  createResolverContext,
} from "./container.js"

export type {
  ServiceFactory,
  ServiceOptions,
  ServiceContext,
  ServiceRegistry,
  TypedResolver,
  ResolverContext,
  DefineServices,
  MergeServices,
} from "./container.js"

// Remote Joiner (Pillar 2: Link Engine)
export {
  RemoteJoiner,
  createRemoteJoiner,
  hasRemoteRelations,
  getRemoteRelationFields,
  splitIncludes,
  validateRemoteRelations,
} from "./remote-joiner.js"

export type {
  RemoteService,
  RemoteJoinerOptions,
} from "./remote-joiner.js"

// Workflow Engine (Pillar 1: Atomic + Rollbacks)
export {
  workflow,
  executeWorkflow,
  runWorkflow,
  WorkflowBuilder,
  createEntityStep,
  updateEntityStep,
  deleteEntityStep,
} from "./workflow.js"

export type {
  WorkflowContext,
  WorkflowMetadata,
  WorkflowStep,
  WorkflowConfig,
  WorkflowResult,
  StepResult,
} from "./workflow.js"

// Enhancements
export {
  // Enhancement pipeline
  enhanceWriteData,
  enhanceReadData,
  enhanceReadDataArray,
  hasEnhancements,
  getEnhancementSummary,
  initEnhancements,

  // Validation
  validateField,
  validateData,
  getValidationSchema,
  FieldValidationError,
  FieldValidationErrors,

  // Transforms
  transformField,
  transformData,
  hasTransforms,
  getTransformFields,

  // Security
  hashPassword,
  verifyPassword,
  isPasswordHash,
  initEncryption,
  registerEncryptionKey,
  setPrimaryEncryptionKey,
  getRegisteredKeyIds,
  removeEncryptionKey,
  clearEncryptionKeys,
  generateEncryptionKey,
  encryptValue,
  decryptValue,
  reEncryptValue,
  reEncryptRecord,
  isEncrypted,
  getEncryptionKeyId,
  processWriteData,
  processReadData,
  getPasswordFields,
  getOmitFields,
  getEncryptedFields,
  hasSecurityFields,

  // Cross-Field Validation (Tier 2)
  validateCrossFields,
  hasCrossFieldValidators,
  getValidators,
  getValidatorsForOperation,
  getCrossFieldValidatedFields,
  CrossFieldValidationError,
  CrossFieldValidationErrors,

  // Field Access Policies (Tier 2)
  evaluatePolicy,
  canReadField,
  canWriteField,
  filterReadableFields,
  filterWritableFields,
  hasFieldAccessPolicies,
  getReadPolicyFields,
  getWritePolicyFields,
  getAccessPolicyFields,
  getFieldAccessSummary,
  FieldAccessDeniedError,

  // Enhanced Driver
  createEnhancedDriver,
  isEnhancedDriver,
  getBaseDriver,
} from "./enhancements/index.js"

export type {
  EnhancementOptions,
  NevrEnhancementConfig,
  EnhancedDriverOptions,
} from "./enhancements/index.js"


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
// - nevr/plugins/timestamps
// Direct imports avoid loading optional dependencies when not needed

// =============================================================================
// TYPE INFERENCE (E2E Type Safety)
// =============================================================================
// These exports enable end-to-end type inference from server to client
// Similar to better-auth's $Infer pattern or tRPC's type inference

export {
  defineConfig,
} from "./plugins/core/inference.js"

export type {
  // $Infer Pattern
  $Infer,

  // Server Type Creation
  NevrInstanceType,
  CreateServerType,

  // Inference from Server
  InferClientFromServer,
  InferServerPlugin,
  InferEntity,
  InferEndpoints,
  InferErrorCodes as InferServerErrorCodes,
  InferPathMethods,
  PathMethodMap,

  // Plugin Type Inference
  InferPluginTypes,
  InferPluginEndpoints,
  InferPluginErrorCodes,
  MergePlugins,

  // Entity Type Inference
  InferEntityFromSchema,
  InferEntitiesFromPluginSchema,
  InferEntityRoutes,
  FieldTypeToTS,

  // Direct Entity Inference
  InferEntityData,
  InferCreateInput,
  InferUpdateInput,

  // Response Type Helpers
  ListResponse,
  SingleResponse,
  ApiResponse,
  EntityPaths,

  // DX Helper Types (Simplified Access)
  EntityOf,
  EntityNamesOf,
  EntitiesOf,
} from "./plugins/core/inference.js"

// =============================================================================
// CLIENT TYPE INFERENCE
// =============================================================================
// For frontend usage - import from "nevr/client" for full client features

export type {
  // Client creation with server inference
  CreateClientOptions,
  InferClientType,
  InferEntityType,
  InferPluginActions,

  // Entity CRUD types
  EntityCRUD,
  EntitiesAPI,

  // Auth inference
  InferAuthFromClient,
  InferSchemaExtensions,

  // Session types for auth
  BaseUser,
  BaseSession,
  SessionState,

  // Helper types
  InferClientAPI,
  InferActions,
  InferAtoms,
  InferErrorCodes,
  InferSessionFromClient,
  InferUserFromClient,
  InferAdditionalFields,
} from "./client/types.js"
