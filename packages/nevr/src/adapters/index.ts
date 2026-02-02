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
  sessionAuth as expressSessionAuth,
  nevrJson,
  expressJson,
  type ExpressAdapterOptions,
} from "./express.js"

// Hono Adapter
export {
  honoAdapter,
  mountNevr,
  devAuth as honoDevAuth,
  jwtAuth as honoJwtAuth,
  sessionAuth as honoSessionAuth,
  cookieAuth,
  type HonoAdapterOptions,
} from "./hono.js"

// Next.js Adapter
export {
  toNextHandler,
  createNextHandler,
  nextCookies,
  getServerSession,
  requireSession,
  getSessionFromRequest,
  sessionAuth,
  withNevrMiddleware,
  createMatcher,
  toApiHandler,
  pagesSessionAuth,
  type NextHandlerOptions,
  type NextRouteHandler,
  type NextRouteHandlers,
  type NextCookiesOptions,
  type Session,
  type GetSessionOptions,
  type RequireSessionOptions,
  type MiddlewareOptions,
  type NextApiRequest,
  type NextApiResponse,
  type ApiHandlerOptions,
} from "./nextjs/index.js"
