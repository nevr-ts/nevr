// =============================================================================
// USERNAME CLIENT PLUGIN
// Client-side plugin for username authentication
// Client-side plugin for username authentication
// =============================================================================

import type { NevrClientPlugin, NevrFetch, ClientStore, ClientAtomListener, NevrFetchResponse } from "../../../../client/types.js"
import type { username } from "./index.js"
import { USERNAME_ERROR_CODES } from "./error-codes.js"
import type { AuthResponse, AuthFetchOptions } from "../../client.js"

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
 * Additional fields for signup when username plugin is enabled
 */
export interface UsernameSignUpFields {
    /**
     * Username for the account (required when usernameClient is added)
     */
    username: string
    /**
     * Display name (optional, defaults to username)
     */
    displayUsername?: string
}

/**
 * Extended signup input when username plugin is enabled
 */
export interface SignUpWithUsernameInput {
    name: string
    email: string
    password: string
    username: string
    displayUsername?: string
    image?: string
    callbackURL?: string
    rememberMe?: boolean
    fetchOptions?: AuthFetchOptions
}

/**
 * Check username availability input
 */
export interface IsUsernameAvailableInput {
    username: string
}

/**
 * Username availability response
 */
export interface IsUsernameAvailableResponse {
    available: boolean
    username: string
}

/**
 * Username auth methods (extends auth namespace)
 */
export interface UsernameAuthMethods {
    /**
     * Sign in methods (extends authClient.signIn)
     */
    signIn: {
        /**
         * Sign in with username and password
         */
        username: (input: SignInUsernameInput, fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<AuthResponse>>
    }
    /**
     * Sign up methods - extends base signup to require username
     */
    signUp: {
        /**
         * Sign up with email, password, and username
         * When usernameClient is added, username is required
         */
        email: (input: SignUpWithUsernameInput, fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<AuthResponse>>
    }
    /**
     * Check if a username is available
     */
    isUsernameAvailable: (input: IsUsernameAvailableInput) => Promise<NevrFetchResponse<IsUsernameAvailableResponse>>
}

/**
 * Username client methods - namespaced under `client.auth.*`
 * Extends auth methods with username-specific functionality
 */
export interface UsernameClientMethods {
    auth: UsernameAuthMethods
}

/**
 * Username client plugin type
 */
export type UsernameClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        $ERROR_CODES: typeof USERNAME_ERROR_CODES
    }
    /**
     * Type-only property for action inference
     * Used by InferActions for proper deep merging with authClient
     */
    readonly $InferActions: UsernameClientMethods
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
                auth: {
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
            }
        },

        // Type inference
        $InferTypes: {
            $ERROR_CODES: USERNAME_ERROR_CODES,
        },

        // Action type inference for deep merging with authClient
        $InferActions: {} as UsernameClientMethods,

    } as unknown as UsernameClientPlugin
}

export default usernameClient
