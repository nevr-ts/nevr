// =============================================================================
// ANONYMOUS CLIENT PLUGIN
// =============================================================================

import type { NevrClientPlugin, NevrFetch, ClientStore, ClientAtomListener, NevrFetchResponse } from "../../../../client/types.js"
import { ANONYMOUS_ERROR_CODES } from "./error-codes.js"
import type { AuthResponse } from "../../client.js"

export interface AnonymousClientOptions {
    basePath?: string
}

/**
 * Anonymous auth methods (inside auth namespace)
 */
export interface AnonymousAuthMethods {
    signIn: {
        anonymous: () => Promise<NevrFetchResponse<AuthResponse>>
    }
}

/**
 * Anonymous client methods - namespaced under `client.auth.*`
 */
export interface AnonymousClientMethods {
    auth: AnonymousAuthMethods
}

export type AnonymousClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        $ERROR_CODES: typeof ANONYMOUS_ERROR_CODES
    }
    readonly $InferActions: AnonymousClientMethods
}

/**
 * Create anonymous client plugin
 *
 * @example
 * ```typescript
 * const client = createClient({
 *   plugins: [authClient(), anonymousClient()]
 * })
 *
 * // Sign in as anonymous user
 * const { data } = await client.signIn.anonymous()
 * console.log(data.user.isAnonymous) // true
 *
 * // Later, link to real account
 * await client.signIn.email({ email: "user@example.com", password: "..." })
 * // Anonymous user is automatically linked and deleted
 * ```
 */
export function anonymousClient(options?: AnonymousClientOptions): AnonymousClientPlugin {
    const basePath = options?.basePath || "/auth"

    return {
        id: "anonymous-client",

        pathMethods: {
            [`${basePath}/sign-in/anonymous`]: "POST",
        },

        atomListeners: [
            {
                matcher: (path: string) => path === `${basePath}/sign-in/anonymous`,
                signal: "$sessionSignal",
            },
        ] as ClientAtomListener[],

        getActions($fetch: NevrFetch, $store: ClientStore) {
            return {
                auth: {
                    signIn: {
                        anonymous: async () => {
                            return $fetch(`${basePath}/sign-in/anonymous`, {
                                method: "POST",
                            })
                        },
                    },
                }
            }
        },

        $InferTypes: {
            $ERROR_CODES: ANONYMOUS_ERROR_CODES,
        },

        $InferActions: {} as AnonymousClientMethods,
    } as unknown as AnonymousClientPlugin
}

export default anonymousClient
