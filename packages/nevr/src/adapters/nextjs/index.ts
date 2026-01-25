// =============================================================================
// NEXT.JS ADAPTER
// Complete Next.js integration for Nevr
// =============================================================================

// -----------------------------------------------------------------------------
// App Router (Route Handlers)
// -----------------------------------------------------------------------------

export {
  toNextHandler,
  createNextHandler,
  type NextHandlerOptions,
  type NextRouteHandler,
  type NextRouteHandlers,
} from "./handler.js"

// -----------------------------------------------------------------------------
// Cookies Plugin (for Server Components)
// -----------------------------------------------------------------------------

export {
  nextCookies,
  type NextCookiesOptions,
} from "./cookies.js"

// -----------------------------------------------------------------------------
// Session Utilities
// -----------------------------------------------------------------------------

export {
  getServerSession,
  requireSession,
  getSessionFromRequest,
  sessionAuth,
  type Session,
  type GetSessionOptions,
  type RequireSessionOptions,
} from "./session.js"

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

export {
  withNevrMiddleware,
  createMatcher,
  type MiddlewareOptions,
} from "./middleware.js"

// -----------------------------------------------------------------------------
// Pages Router (Legacy)
// -----------------------------------------------------------------------------

export {
  toApiHandler,
  pagesSessionAuth,
  type NextApiRequest,
  type NextApiResponse,
  type ApiHandlerOptions,
} from "./pages.js"

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export { toNextHandler as default } from "./handler.js"
