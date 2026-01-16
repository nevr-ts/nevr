// =============================================================================
// PHONE NUMBER PLUGIN SCHEMA
// =============================================================================

import { string, bool } from "../../../../index.js"
import type { PluginSchema } from "../../../unified/types.js"

export function getPhoneNumberSchema(): PluginSchema {
    return {
        extend: {
            user: {
                phoneNumber: string.optional().unique().label("Phone Number"),
                phoneNumberVerified: bool.default(false).label("Phone Number Verified"),
            },
        },
    }
}
