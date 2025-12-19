// =============================================================================
// PLUGINS
// Feature plugins for nevr
// =============================================================================

// Core Plugin System
export * from "./core/index.js"

// Auth Plugin (Better Auth integration)
export { auth } from "./auth/index.js"
export * from "./auth/types.js"

// Payments Plugin (Stripe integration)
export { payments } from "./payments/index.js"
export * from "./payments/types.js"

// Storage Plugin (S3/R2/Local)
export { storage } from "./storage/index.js"
export * from "./storage/types.js"

// Timestamps Plugin
export { timestamps } from "./timestamps.js"
