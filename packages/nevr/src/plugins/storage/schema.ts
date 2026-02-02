// =============================================================================
// STORAGE PLUGIN SCHEMA
// Entity definitions for file storage
// =============================================================================

import { string, int, json } from "../../index.js"
import type { PluginSchema } from "../unified/types.js"

// -----------------------------------------------------------------------------
// Schema Export
// -----------------------------------------------------------------------------

/**
 * Get the storage plugin schema
 */
export function getStorageSchema(): PluginSchema {
    return {
        entities: {
            storageFile: {
                description: "File stored in cloud or local storage",
                internal: true,
                fields: {
                    // Owner (optional - can be system files)
                    userId: string.optional().label("User ID"),

                    // Storage key/path
                    key: string.unique().label("Storage Key"),

                    // File metadata
                    name: string.label("Filename"),
                    mimeType: string.label("MIME Type"),
                    size: int.min(0).label("Size (bytes)"),

                    // Visibility
                    visibility: string.options(["public", "private"]).default("private").label("Visibility"),

                    // Public URL (for public files)
                    url: string.optional().label("Public URL"),

                    // Custom metadata
                    metadata: json.optional().label("Metadata (JSON)"),
                },
            },
        },
    }
}
