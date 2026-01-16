// =============================================================================
// ANONYMOUS PLUGIN SCHEMA
// =============================================================================

import { bool } from "../../../../index.js"
import type { PluginSchema } from "../../../unified/types.js"

export function getAnonymousSchema(): PluginSchema {
    return {
        extend: {
            user: {
                isAnonymous: bool.default(false).label("Is Anonymous User"),
            },
        },
    }
}
