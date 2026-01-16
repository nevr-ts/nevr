// =============================================================================
// TWO FACTOR PLUGIN SCHEMA
// =============================================================================

import { string, bool } from "../../../../index.js"
import type { PluginSchema } from "../../../unified/types.js"

export function getTwoFactorSchema(): PluginSchema {
    return {
        extend: {
            user: {
                twoFactorEnabled: bool.default(false).label("Two Factor Enabled"),
            },
        },
        entities: {
            twoFactor: {
                description: "Two factor authentication data",
                internal: true,
                fields: {
                    userId: string.label("User ID"),
                    secret: string.label("TOTP Secret"),
                    backupCodes: string.label("Encrypted Backup Codes"),
                },
            },
        },
    }
}
