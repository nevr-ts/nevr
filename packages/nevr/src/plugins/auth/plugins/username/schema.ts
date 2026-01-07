// =============================================================================
// USERNAME PLUGIN SCHEMA
// Extends user entity with username fields (Entity-First)
// =============================================================================

import { string } from "../../../../index.js"
import type { PluginSchema } from "../../../unified/types.js"

/**
 * Schema normalization functions
 */
export interface UsernameNormalizers {
    username: (value: string) => string
    displayUsername: (value: string) => string
}

/**
 * Get username plugin schema
 * Extends the user entity with username and displayUsername fields
 *
 * Note: Normalization is handled in the plugin hooks, not in the schema.
 * This follows the pattern where transforms are applied via
 * database hooks rather than schema-level transforms.
 */
export function getUsernameSchema(_normalizers: UsernameNormalizers): PluginSchema {
    return {
        entities: {
            user: {
                description: "Extended user with username support",
                fields: {
                    // Username - normalized (lowercase), unique, indexed
                    // Normalization is applied via hooks in the plugin
                    username: string
                        .unique()
                        .optional()
                        .lower() // Apply lowercase transform
                        .label("Username")
                        .description("Unique username for the user"),

                    // Display username - original casing preserved
                    displayUsername: string
                        .optional()
                        .label("Display Username")
                        .description("Display name with original casing"),
                },
            },
        },
    }
}
