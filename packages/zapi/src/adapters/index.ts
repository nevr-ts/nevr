// =============================================================================
// ADAPTERS
// HTTP framework adapters for nevr
// =============================================================================

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
  mountZapi,
  devAuth as honoDevAuth,
  jwtAuth as honoJwtAuth,
  cookieAuth,
  type HonoAdapterOptions,
} from "./hono.js"
