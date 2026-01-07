// =============================================================================
// TIMESTAMPS PLUGIN
// Automatic createdAt/updatedAt timestamps using unified plugin system
// =============================================================================

import { datetime } from "../fields.js"
import { createPlugin } from "./unified/facade.js"
import { getLogger } from "../logger.js"

/**
 * Timestamps plugin (Unified System)
 * Automatically adds createdAt and updatedAt fields to all entities
 * 
 * The timestamps are:
 * - createdAt: Set on create, never updated
 * - updatedAt: Set on create and every update
 *
 * @example
 * ```typescript
 * import { timestamps } from "nevr/plugins/timestamps"
 *
 * const api = nevr({
 *   entities: [...],
 *   plugins: [timestamps],
 * })
 * ```
 */
export const timestamps = createPlugin({
  id: "timestamps",
  name: "Timestamps",
  version: "1.0.0",
  description: "Automatic createdAt/updatedAt timestamps for all entities",

  // Entity-First: extend all entities with timestamp fields
  schema: {
    extend: {
      // Special "all" key applies to every entity
      all: {
        createdAt: datetime.writable("none"),
        updatedAt: datetime.writable("none"),
      },
    },
  },

  // Entity hooks to set timestamps
  entityHooks: {
    // Apply to all entities using wildcard
    "*": {
      create: {
        before: async (ctx) => {
          const now = new Date()
          // Set timestamps if not already set
          return {
            data: {
              ...ctx.data,
              createdAt: ctx.data.createdAt ?? now,
              updatedAt: ctx.data.updatedAt ?? now,
            },
          }
        },
      },
      update: {
        before: async (ctx) => {
          // Always update updatedAt
          return {
            data: {
              ...ctx.data,
              updatedAt: new Date(),
            },
          }
        },
      },
    },
  },

  lifecycle: {
    onInit: () => {
      getLogger().debug("[timestamps] Plugin initialized")
    },
  },
})

export default timestamps
