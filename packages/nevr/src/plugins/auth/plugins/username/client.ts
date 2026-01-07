// =============================================================================
// USERNAME CLIENT PLUGIN
// Client-side plugin for username authentication
// Client-side plugin for username authentication
// =============================================================================

import type { NevrClientPlugin, NevrFetch, ClientStore, ClientAtomListener } from "../../../../client/types.js"
import type { username } from "./index.js"
import { USERNAME_ERROR_CODES } from "./error-codes.js"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UsernameClientOptions {
    /**
     * Base path for auth routes
     * @default "/auth"
     */
    basePath?: string
}

/**
 * Sign in with username input
 */
export interface SignInUsernameInput {
    username: string
    password: string
    callbackURL?: string
    rememberMe?: boolean
}

/**
 * Check username availability input
 */
export interface IsUsernameAvailableInput {
    username: string
}

/**
 * Username client plugin type
 */
export type UsernameClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        $ERROR_CODES: typeof USERNAME_ERROR_CODES
    }
}

// -----------------------------------------------------------------------------
// Username Client Factory
// -----------------------------------------------------------------------------

/**
 * Create username client plugin
 *
 * @example
 * ```typescript
 * import { createClient } from "nevr/client"
 * import { authClient } from "nevr/plugins/auth/client"
 * import { usernameClient } from "nevr/plugins/auth/plugins/username/client"
 *
 * const client = createClient({
 *   baseURL: "http://localhost:3000",
 *   plugins: [authClient(), usernameClient()]
 * })
 *
 * // Sign in with username
 * const { data, error } = await client.signIn.username({
 *   username: "johndoe",
 *   password: "password123"
 * })
 *
 * // Check username availability
 * const { data } = await client.isUsernameAvailable({ username: "newuser" })
 * console.log(data.available) // true/false
 * ```
 */
export function usernameClient(options?: UsernameClientOptions): UsernameClientPlugin {
    const basePath = options?.basePath || "/auth"

    return {
        id: "username-client",

        /**
         * Path methods for the proxy
         */
        pathMethods: {
            [`${basePath}/sign-in/username`]: "POST",
            [`${basePath}/is-username-available`]: "POST",
        },

        /**
         * Atom listeners for triggering session refresh
         */
        atomListeners: [
            {
                matcher: (path: string) => path === `${basePath}/sign-in/username`,
                signal: "$sessionSignal",
            },
        ] as ClientAtomListener[],

        /**
         * Get action methods
         */
        getActions($fetch: NevrFetch, $store: ClientStore) {
            return {
                signIn: {
                    username: async (input: SignInUsernameInput) => {
                        return $fetch(`${basePath}/sign-in/username`, {
                            method: "POST",
                            body: input,
                        })
                    },
                },

                isUsernameAvailable: async (input: IsUsernameAvailableInput) => {
                    return $fetch(`${basePath}/is-username-available`, {
                        method: "POST",
                        body: input,
                    })
                },
            }
        },

        // Type inference
        $InferTypes: {
            $ERROR_CODES: USERNAME_ERROR_CODES,
        },

    } as unknown as UsernameClientPlugin
}

export default usernameClient
