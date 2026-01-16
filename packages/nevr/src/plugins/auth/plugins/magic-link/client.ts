// =============================================================================
// MAGIC LINK CLIENT PLUGIN
// Client-side plugin for magic link authentication
// =============================================================================

import type { NevrClientPlugin, NevrFetch, ClientStore, ClientAtomListener } from "../../../../client/types.js"
import { MAGIC_LINK_ERROR_CODES } from "./error-codes.js"

// =============================================================================
// Types
// =============================================================================

export interface MagicLinkClientOptions {
    /**
     * Base path for auth routes
     * @default "/auth"
     */
    basePath?: string
}

export interface SendMagicLinkInput {
    email: string
    name?: string
    callbackURL?: string
}

export interface VerifyMagicLinkInput {
    token: string
    callbackURL?: string
}

export type MagicLinkClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        $ERROR_CODES: typeof MAGIC_LINK_ERROR_CODES
    }
}

// =============================================================================
// Magic Link Client Factory
// =============================================================================

/**
 * Create magic link client plugin
 *
 * @example
 * ```typescript
 * import { createClient } from "nevr/client"
 * import { authClient } from "nevr/plugins/auth/client"
 * import { magicLinkClient } from "nevr/plugins/auth/plugins/magic-link/client"
 *
 * const client = createClient({
 *   baseURL: "http://localhost:3000",
 *   plugins: [authClient(), magicLinkClient()]
 * })
 *
 * // Send magic link
 * await client.signIn.magicLink({ email: "user@example.com" })
 *
 * // Verify magic link (usually called via URL redirect)
 * const { data } = await client.magicLink.verify({ token: "..." })
 * ```
 */
export function magicLinkClient(options?: MagicLinkClientOptions): MagicLinkClientPlugin {
    const basePath = options?.basePath || "/auth"

    return {
        id: "magic-link-client",

        pathMethods: {
            [`${basePath}/sign-in/magic-link`]: "POST",
            [`${basePath}/magic-link/verify`]: "GET",
        },

        atomListeners: [
            {
                matcher: (path: string) => path === `${basePath}/magic-link/verify`,
                signal: "$sessionSignal",
            },
        ] as ClientAtomListener[],

        getActions($fetch: NevrFetch, $store: ClientStore) {
            return {
                signIn: {
                    magicLink: async (input: SendMagicLinkInput) => {
                        return $fetch(`${basePath}/sign-in/magic-link`, {
                            method: "POST",
                            body: input,
                        })
                    },
                },

                magicLink: {
                    verify: async (input: VerifyMagicLinkInput) => {
                        const params = new URLSearchParams()
                        params.set("token", input.token)
                        if (input.callbackURL) {
                            params.set("callbackURL", input.callbackURL)
                        }
                        return $fetch(`${basePath}/magic-link/verify?${params.toString()}`, {
                            method: "GET",
                        })
                    },
                },
            }
        },

        $InferTypes: {
            $ERROR_CODES: MAGIC_LINK_ERROR_CODES,
        },
    } as unknown as MagicLinkClientPlugin
}

export default magicLinkClient
