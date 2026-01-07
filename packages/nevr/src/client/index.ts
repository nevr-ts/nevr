// =============================================================================
// CLIENT EXPORTS
// Main entry point for NEVR client
// =============================================================================

// Core client
export { createClient, createTypedClient, type NevrClient } from "./vanilla.js"

// Types
export type {
  // Plugin types
  NevrClientPlugin,
  NevrClientOptions,
  ClientStore,
  ClientAtomListener,

  // Fetch types
  NevrFetch,
  NevrFetchOptions,
  NevrFetchResponse,
  NevrFetchError,
  NevrFetchPlugin,

  // Middleware types
  ClientMiddleware,
  ResponseInterceptor,
  MiddlewareRequestContext,
  MiddlewareResponseContext,

  // Session types
  SessionState,
  BaseUser,
  BaseSession,
  SessionRevalidateOptions,

  // Inference types
  InferClientAPI,
  InferActions,
  InferAtoms,
  InferErrorCodes,
  InferSessionFromClient,
  InferUserFromClient,
  InferAdditionalFields,

  // Helper types
  LiteralString,
  Awaitable,
  UnionToIntersection,
  PrettifyDeep,
  StripEmptyObjects,
  IsSignal,
} from "./types.js"

// Store utilities
export { createClientStore, createSessionAtom, createSignalAtom } from "./store.js"

// Fetch utilities
export { createNevrFetch, type CreateFetchOptions } from "./fetch.js"

// Proxy utilities
export { createDynamicProxy } from "./proxy.js"

// Entity client (auto-generates CRUD methods)
export {
  entityClient,
  type EntityClientOptions,
  type EntityMethods,
  type ListOptions,
  type ListResponse,
  type PaginationInfo,
  type InferEntityClient,
  type InferEntityMethods,
  type InferEntitiesFromServer,
  type TypedClient,
  type EntityNamesFromServer,
} from "./entity.js"

// Plugin client (namespace-based: client.auth.signUp())
// Note: For custom plugins, use server plugins with endpoints{} - client auto-wires them
export {
  pluginClient,
  createPluginMethods,
  type PluginClientConfig,
  type PluginAction,
  type InferPluginMethods,
  type InferClientWithPlugins,
} from "./plugin-client.js"

