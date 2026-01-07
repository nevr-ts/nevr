// =============================================================================
// DRIVERS
// Database drivers for nevr
// =============================================================================

// Base Driver Factory (for creating custom drivers)
export {
  createDriverFactory,
  normalizeWhereOperators,
  normalizeSortDirection,
  type DriverFactoryConfig,
  type DriverDebugLogOption,
  type DriverFactoryOptions,
  type CustomDriverMethods,
  type Driver,
  type TransformConfig,
} from "./base.js"

// Prisma Driver
export {
  prisma,
  type PrismaDriverConfig,
  type PrismaClient,
  type PrismaModel,
} from "./prisma.js"
