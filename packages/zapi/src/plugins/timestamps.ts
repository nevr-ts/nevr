// =============================================================================
// TIMESTAMPS PLUGIN
// Automatic createdAt/updatedAt timestamps
// =============================================================================

import type { Plugin } from "../types.js"

/**
 * Timestamps plugin
 * Automatically sets createdAt on create and updatedAt on create/update
 *
 * Note: This is handled by Prisma's @default(now()) and @updatedAt
 * This plugin is mainly for documentation and ensuring consistency
 *
 * @example
 * ```typescript
 * import { timestamps } from "@zapi-ts/plugin-timestamps"
 *
 * const api = zapi({
 *   entities: [...],
 *   plugins: [timestamps()],
 * })
 * ```
 */
export function timestamps(): Plugin {
  return {
    name: "timestamps",

    // Add timestamp fields to all entities
    fields: {
      all: {
        createdAt: {
          type: "datetime",
          optional: false,
          unique: false,
        },
        updatedAt: {
          type: "datetime",
          optional: false,
          unique: false,
        },
      },
    },

    // Note: Actual timestamp setting is handled by Prisma
    // beforeCreate: sets createdAt, updatedAt via @default(now())
    // beforeUpdate: sets updatedAt via @updatedAt

    hooks: {
      // For non-Prisma drivers, manually set timestamps
      beforeCreate: (ctx) => {
        const now = new Date()
        // Only set if not already set (Prisma handles this)
        if (!ctx.input.createdAt) {
          ctx.setInput({ createdAt: now })
        }
        if (!ctx.input.updatedAt) {
          ctx.setInput({ updatedAt: now })
        }
      },

      beforeUpdate: (ctx) => {
        // Always update updatedAt
        ctx.setInput({ updatedAt: new Date() })
      },
    },
  }
}

export default timestamps
