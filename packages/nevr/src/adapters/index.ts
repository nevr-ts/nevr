// =============================================================================
// ADAPTERS
// HTTP framework adapters for nevr
// =============================================================================

// Escape Hatch (Custom Adapter Factory)
export {
  createAdapterFactory,
  type AdapterConfig,
  type AdapterRequest,
  type AdapterResponse,
  type AdapterContext,
  type Adapter,
  type CustomAdapterMethods,
  type AdapterFactoryOptions,
} from "./escape-hatch.js"

// Express Adapter
export {
  expressAdapter,
  devAuth as expressDevAuth,
  jwtAuth as expressJwtAuth,
  type ExpressAdapterOptions,
} from "./express.js"

// Hono Adapter
export {
  honoAdapter,
  mountNevr,
  devAuth as honoDevAuth,
  jwtAuth as honoJwtAuth,
  cookieAuth,
  type HonoAdapterOptions,
} from "./hono.js"
