// =============================================================================
// AUTH CLIENT PLUGIN
// Client-side authentication plugin for Nevr
// Client with reactive session state
// =============================================================================

import { atom, type WritableAtom } from "nanostores"
import type {
    NevrClientPlugin,
    NevrFetch,
    NevrFetchResponse,
    NevrFetchError,
    ClientStore,
    NevrClientOptions,
    ClientAtomListener,
} from "../../client/types.js"
import type { AuthUser, AuthSession } from "./types.js"
import { AUTH_ERROR_CODES } from "./error-codes.js"

// -----------------------------------------------------------------------------
// Session State Type (auth-specific)
// -----------------------------------------------------------------------------

export interface AuthSessionState {
    data: SessionData | null
    error: NevrFetchError | null
    isPending: boolean
}

// -----------------------------------------------------------------------------
// Client Types
// -----------------------------------------------------------------------------

/**
 * Auth client options
 */
export interface AuthClientOptions {
    /**
     * Base path for auth routes
     * @default "/auth"
     */
    basePath?: string

    /**
     * Auto-refresh session on window focus
     * @default true
     */
    refreshOnWindowFocus?: boolean

    /**
     * Auto-refresh session interval (in seconds)
     * Set to 0 to disable
     * @default 0
     */
    refreshInterval?: number

    /**
     * Storage for persisting session across tabs
     * @default localStorage if available
     */
    storage?: Storage | null

    /**
     * Storage key for session
     * @default "nevr.auth.session"
     */
    storageKey?: string

    /**
     * Fetch options to include with all requests
     */
    fetchOptions?: RequestInit
}

/**
 * Session data from getSession endpoint
 */
export interface SessionData {
    session: AuthSession
    user: AuthUser
}

/**
 * Fetch options for auth methods (onSuccess, onError callbacks)
 */
export interface AuthFetchOptions {
    /**
     * Called when request succeeds
     */
    onSuccess?: (context: { data: any }) => void | Promise<void>
    /**
     * Called when request fails
     */
    onError?: (context: { error: NevrFetchError }) => void | Promise<void>
    /**
     * Called before request is sent
     */
    onRequest?: (context: { url: string; options: RequestInit }) => void | Promise<void>
    /**
     * Called after response is received
     */
    onResponse?: (context: { response: Response; data: any }) => void | Promise<void>
    /**
     * Disable signal triggers (session refresh) on success
     */
    disableSignal?: boolean
}

/**
 * Sign up input
 */
export interface SignUpEmailInput {
    name: string
    email: string
    password: string
    image?: string
    callbackURL?: string
    rememberMe?: boolean
    /**
     * Inline fetch options (alternative to second parameter)
     */
    fetchOptions?: AuthFetchOptions
}

/**
 * Sign in input
 */
export interface SignInEmailInput {
    email: string
    password: string
    callbackURL?: string
    rememberMe?: boolean
    /**
     * Inline fetch options (alternative to second parameter)
     */
    fetchOptions?: AuthFetchOptions
}

/**
 * Sign in with social provider input
 */
export interface SignInSocialInput {
    provider: string
    callbackURL?: string
    errorURL?: string
    scopes?: string[]
    loginHint?: string
    /**
     * Inline fetch options (alternative to second parameter)
     */
    fetchOptions?: AuthFetchOptions
}

/**
 * Link social account input
 */
export interface LinkSocialInput {
    providerId: string
    callbackURL?: string
}

/**
 * Sign up/Sign in response
 */
export interface AuthResponse {
    token: string | null
    user: AuthUser
    redirect?: boolean
    url?: string
}

/**
 * Revoke session input
 */
export interface RevokeSessionInput {
    token: string
}

/**
 * Auth methods (internal - used inside auth namespace)
 */
export interface AuthMethods {
    /**
     * Sign up with email and password
     * @param input - Sign up data (email, password, name)
     * @param fetchOptions - Optional callbacks (onSuccess, onError)
     */
    signUp: {
        email: (input: SignUpEmailInput, fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<AuthResponse>>
    }

    /**
     * Sign in with email and password
     * @param input - Sign in data (email, password)
     * @param fetchOptions - Optional callbacks (onSuccess, onError)
     */
    signIn: {
        email: (input: SignInEmailInput, fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<AuthResponse>>
        social: (input: SignInSocialInput, fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<{ url: string; redirect: boolean }>>
    }

    /**
     * Sign out the current user
     * @param fetchOptions - Optional callbacks (onSuccess, onError)
     */
    signOut: (fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<{ success: boolean }>>

    /**
     * Get current session
     * @param fetchOptions - Optional callbacks (onSuccess, onError)
     */
    getSession: (fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<SessionData | null>>

    /**
     * List all active sessions
     * @param fetchOptions - Optional callbacks (onSuccess, onError)
     */
    listSessions: (fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<{ sessions: AuthSession[] }>>

    /**
     * Revoke a specific session
     * @param input - Session token to revoke
     * @param fetchOptions - Optional callbacks (onSuccess, onError)
     */
    revokeSession: (input: RevokeSessionInput, fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<{ status: boolean }>>

    /**
     * Revoke all sessions
     * @param fetchOptions - Optional callbacks (onSuccess, onError)
     */
    revokeSessions: (fetchOptions?: AuthFetchOptions) => Promise<NevrFetchResponse<{ status: boolean }>>

    /**
     * Revoke all sessions except current
     */
    revokeOtherSessions: () => Promise<NevrFetchResponse<{ status: boolean }>>

    /**
     * Link a social account
     */
    linkSocial: (input: LinkSocialInput) => Promise<NevrFetchResponse<{ url: string; redirect: boolean }>>

    /**
     * Update current user's profile
     */
    updateUser: (input: { name?: string; image?: string }) => Promise<NevrFetchResponse<{ user: AuthUser }>>

    /**
     * Change current user's password
     */
    changePassword: (input: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }) => Promise<NevrFetchResponse<{ status: boolean }>>

    /**
     * Change current user's email
     */
    changeEmail: (input: { newEmail: string; callbackURL?: string }) => Promise<NevrFetchResponse<{ status: boolean }>>

    /**
     * Delete current user's account
     */
    deleteUser: (input: { password: string }) => Promise<NevrFetchResponse<{ status: boolean }>>
}

/**
 * Auth client methods - namespaced under `client.auth.*`
 *
 * @example
 * ```typescript
 * // All auth methods are under the `auth` namespace
 * await client.auth.signIn.email({ email, password })
 * await client.auth.signUp.email({ name, email, password })
 * await client.auth.signOut()
 * await client.auth.getSession()
 * ```
 */
export interface AuthClientMethods {
    auth: AuthMethods
}

// -----------------------------------------------------------------------------
// Session Atom
// Reactive session state using nanostores
// -----------------------------------------------------------------------------

/**
 * Create a session atom for reactive state management
 */
function createSessionAtom(): WritableAtom<AuthSessionState> {
    return atom<AuthSessionState>({
        data: null,
        error: null,
        isPending: true,
    })
}

/**
 * Create a signal atom (used for triggering refreshes)
 */
function createSignalAtom(): WritableAtom<boolean> {
    return atom<boolean>(false)
}

// -----------------------------------------------------------------------------
// Auth Client Plugin Factory
// -----------------------------------------------------------------------------

/**
 * Create auth client plugin
 *
 * @example
 * ```typescript
 * import { createClient } from "nevr/client"
 * import { authClient } from "nevr/plugins/auth/client"
 *
 * const client = createClient({
 *   baseURL: "http://localhost:3000",
 *   plugins: [authClient()]
 * })
 *
 * // Sign up
 * const { data, error } = await client.signUp.email({
 *   name: "John Doe",
 *   email: "john@example.com",
 *   password: "password123"
 * })
 *
 * // Sign in
 * await client.signIn.email({
 *   email: "john@example.com",
 *   password: "password123"
 * })
 *
 * // Get session (reactive)
 * client.useSession.subscribe(({ data, isPending }) => {
 *   console.log("Session:", data)
 * })
 *
 * // React usage
 * const { data, isPending } = client.useSession()
 * ```
 */
/**
 * Auth client plugin type with server inference
 */
export type AuthClientPlugin = NevrClientPlugin & {
    /**
     * Type-only property for inferring server plugin types in client
     * This allows TypeScript to infer session/user types from the auth plugin
     */
    readonly $InferTypes: {
        endpoints: AuthClientMethods
        $ERROR_CODES: typeof AUTH_ERROR_CODES
        Session: SessionData
        User: AuthUser
    }
    /**
     * Type-only property for action inference
     * Used by InferActions for proper deep merging
     */
    readonly $InferActions: AuthClientMethods
}

export function authClient(options?: AuthClientOptions): AuthClientPlugin {
    const basePath = options?.basePath || "/auth"
    const refreshOnWindowFocus = options?.refreshOnWindowFocus !== false
    const refreshInterval = options?.refreshInterval || 0
    const storageKey = options?.storageKey || "nevr.auth.session"

    // Session atom
    let $session: WritableAtom<AuthSessionState>
    // Signal for triggering refreshes
    let $sessionSignal: WritableAtom<boolean>

    return {
        id: "auth-client",

        /**
         * Path methods for the proxy
         */
        pathMethods: {
            [`${basePath}/sign-up/email`]: "POST",
            [`${basePath}/sign-in/email`]: "POST",
            [`${basePath}/sign-out`]: "POST",
            [`${basePath}/get-session`]: "GET",
            [`${basePath}/list-sessions`]: "GET",
            [`${basePath}/revoke-session`]: "POST",
            [`${basePath}/revoke-sessions`]: "POST",
            [`${basePath}/revoke-other-sessions`]: "POST",
            [`${basePath}/update-user`]: "POST",
            [`${basePath}/change-password`]: "POST",
            [`${basePath}/change-email`]: "POST",
            [`${basePath}/delete-user`]: "POST",
            [`${basePath}/link-social`]: "POST",
        },

        /**
         * Get atoms for reactive state
         */
        getAtoms($fetch: NevrFetch) {
            $session = createSessionAtom()
            $sessionSignal = createSignalAtom()

            // Initial session fetch
            fetchSession($fetch)

            // Set up window focus listener
            if (refreshOnWindowFocus && typeof window !== "undefined") {
                window.addEventListener("focus", () => {
                    fetchSession($fetch)
                })
            }

            // Set up refresh interval
            if (refreshInterval > 0 && typeof window !== "undefined") {
                setInterval(() => {
                    fetchSession($fetch)
                }, refreshInterval * 1000)
            }

            // Listen for storage events (cross-tab sync)
            if (typeof window !== "undefined" && options?.storage !== null) {
                window.addEventListener("storage", (event) => {
                    if (event.key === storageKey) {
                        fetchSession($fetch)
                    }
                })
            }

            return {
                session: $session,
                $sessionSignal,
            }

            async function fetchSession(fetch: NevrFetch) {
                $session.set({ ...$session.get(), isPending: true })

                try {
                    const result = await fetch(`${basePath}/get-session`, {
                        method: "GET",
                    })

                    if (result.error) {
                        $session.set({
                            data: null,
                            error: result.error,
                            isPending: false,
                        })
                    } else {
                        const data = result.data as SessionData | null
                        $session.set({
                            data,
                            error: null,
                            isPending: false,
                        })

                        // Persist to storage for cross-tab sync
                        if (typeof window !== "undefined" && options?.storage !== null) {
                            const storage = options?.storage || window.localStorage
                            if (storage) {
                                try {
                                    if (data) {
                                        storage.setItem(storageKey, JSON.stringify({ ts: Date.now() }))
                                    } else {
                                        storage.removeItem(storageKey)
                                    }
                                } catch { /* Storage full or disabled */ }
                            }
                        }
                    }
                } catch (error) {
                    $session.set({
                        data: null,
                        error: error as any,
                        isPending: false,
                    })
                }
            }
        },

        /**
         * Atom listeners for triggering session refresh
         */
        atomListeners: [
            {
                matcher: (path: string) => {
                    return (
                        path === `${basePath}/sign-in/email` ||
                        path === `${basePath}/sign-up/email` ||
                        path === `${basePath}/sign-out` ||
                        path === `${basePath}/revoke-sessions` ||
                        path === `${basePath}/revoke-other-sessions`
                    )
                },
                signal: "$sessionSignal",
            },
        ] as ClientAtomListener[],

        /**
         * Get action methods
         */
        getActions($fetch: NevrFetch, $store: ClientStore) {
            // Helper to update session after auth actions
            const updateSession = async () => {
                if ($session) {
                    $session.set({ ...$session.get(), isPending: true })
                    try {
                        const result = await $fetch(`${basePath}/get-session`, { method: "GET" })
                        $session.set({
                            data: result.data as SessionData | null,
                            error: result.error || null,
                            isPending: false,
                        })
                    } catch (error) {
                        $session.set({
                            data: null,
                            error: error as any,
                            isPending: false,
                        })
                    }
                }
            }

            // Helper to merge fetch options from input and second parameter
            const mergeOptions = (inputOptions?: AuthFetchOptions, paramOptions?: AuthFetchOptions): AuthFetchOptions => {
                return { ...inputOptions, ...paramOptions }
            }

            // Helper to call callbacks after request completes
            const handleCallbacks = async (
                result: NevrFetchResponse<any>,
                opts?: AuthFetchOptions
            ) => {
                if (result.error && opts?.onError) {
                    await opts.onError({ error: result.error })
                } else if (!result.error && opts?.onSuccess) {
                    await opts.onSuccess({ data: result.data })
                }
            }

            return {
                auth: {
                    signUp: {
                        email: async (input: SignUpEmailInput, fetchOptions?: AuthFetchOptions) => {
                        const { fetchOptions: inputOpts, ...body } = input
                        const opts = mergeOptions(inputOpts, fetchOptions)

                        const result = await $fetch(`${basePath}/sign-up/email`, {
                            method: "POST",
                            body,
                            onRequest: opts.onRequest,
                            onResponse: opts.onResponse,
                        })

                        if (!result.error && !opts.disableSignal) {
                            await updateSession()
                        }

                        await handleCallbacks(result, opts)
                        return result as NevrFetchResponse<AuthResponse>
                    },
                },

                signIn: {
                    email: async (input: SignInEmailInput, fetchOptions?: AuthFetchOptions) => {
                        const { fetchOptions: inputOpts, ...body } = input
                        const opts = mergeOptions(inputOpts, fetchOptions)

                        const result = await $fetch(`${basePath}/sign-in/email`, {
                            method: "POST",
                            body,
                            onRequest: opts.onRequest,
                            onResponse: opts.onResponse,
                        })

                        if (!result.error && !opts.disableSignal) {
                            await updateSession()
                        }

                        await handleCallbacks(result, opts)
                        return result as NevrFetchResponse<AuthResponse>
                    },
                    social: async (input: SignInSocialInput, fetchOptions?: AuthFetchOptions) => {
                        const { provider, fetchOptions: inputOpts, ...body } = input as SignInSocialInput & { fetchOptions?: AuthFetchOptions }
                        const opts = mergeOptions(inputOpts, fetchOptions)

                        const result = await $fetch(`${basePath}/sign-in/${provider}`, {
                            method: "POST",
                            body,
                            onRequest: opts.onRequest,
                            onResponse: opts.onResponse,
                        })

                        await handleCallbacks(result, opts)
                        return result as NevrFetchResponse<{ url: string; redirect: boolean }>
                    },
                },

                signOut: async (fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/sign-out`, {
                        method: "POST",
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    if (!result.error) {
                        // Clear session atom
                        if ($session && !fetchOptions?.disableSignal) {
                            $session.set({
                                data: null,
                                error: null,
                                isPending: false,
                            })
                        }
                        // Clear storage
                        if (typeof window !== "undefined" && options?.storage !== null) {
                            const storage = options?.storage || window.localStorage
                            if (storage) {
                                try {
                                    storage.removeItem(storageKey)
                                } catch { /* ignored */ }
                            }
                        }
                    }

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ success: boolean }>
                },

                getSession: async (fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/get-session`, {
                        method: "GET",
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<SessionData | null>
                },

                listSessions: async (fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/list-sessions`, {
                        method: "GET",
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ sessions: AuthSession[] }>
                },

                revokeSession: async (input: RevokeSessionInput, fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/revoke-session`, {
                        method: "POST",
                        body: input,
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ status: boolean }>
                },

                revokeSessions: async (fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/revoke-sessions`, {
                        method: "POST",
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    if (!result.error && !fetchOptions?.disableSignal) {
                        // Clear session since all are revoked
                        if ($session) {
                            $session.set({
                                data: null,
                                error: null,
                                isPending: false,
                            })
                        }
                    }

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ status: boolean }>
                },

                revokeOtherSessions: async (fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/revoke-other-sessions`, {
                        method: "POST",
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ status: boolean }>
                },

                linkSocial: async (input: LinkSocialInput, fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/link-social`, {
                        method: "POST",
                        body: input,
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ url: string; redirect: boolean }>
                },

                updateUser: async (input: { name?: string; image?: string }, fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/update-user`, {
                        method: "POST",
                        body: input,
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    if (!result.error && !fetchOptions?.disableSignal) {
                        await updateSession()
                    }

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ user: AuthUser }>
                },

                changePassword: async (input: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }, fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/change-password`, {
                        method: "POST",
                        body: input,
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ status: boolean }>
                },

                changeEmail: async (input: { newEmail: string; callbackURL?: string }, fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/change-email`, {
                        method: "POST",
                        body: input,
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    if (!result.error && !fetchOptions?.disableSignal) {
                        await updateSession()
                    }

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ status: boolean }>
                },

                deleteUser: async (input: { password: string }, fetchOptions?: AuthFetchOptions) => {
                    const result = await $fetch(`${basePath}/delete-user`, {
                        method: "POST",
                        body: input,
                        onRequest: fetchOptions?.onRequest,
                        onResponse: fetchOptions?.onResponse,
                    })

                    if (!result.error && !fetchOptions?.disableSignal) {
                        // Clear session atom
                        if ($session) {
                            $session.set({
                                data: null,
                                error: null,
                                isPending: false,
                            })
                        }
                    }

                    await handleCallbacks(result, fetchOptions)
                    return result as NevrFetchResponse<{ status: boolean }>
                },
                }
            }
        },

        // Type inference (used for client type inference)
        $InferTypes: {
            endpoints: {} as AuthClientMethods,
            $ERROR_CODES: AUTH_ERROR_CODES,
            Session: {} as SessionData,
            User: {} as AuthUser,
        },

        // Action type inference for deep merging with sub-plugins
        $InferActions: {} as AuthClientMethods,
    } as AuthClientPlugin
}

// -----------------------------------------------------------------------------
// React-specific hooks
// These are convenience wrappers for React usage
// -----------------------------------------------------------------------------

/**
 * Type for useSession hook return value
 */
export interface UseSessionReturn {
    data: SessionData | null
    error: any
    isPending: boolean
    refetch: () => Promise<void>
}

/**
 * Create a React useSession hook
 * This is used internally by the React client
 *
 * @example
 * ```tsx
 * import { useStore } from "@nanostores/react"
 *
 * function Profile() {
 *   const session = useStore(client.$store.atoms.session)
 *
 *   if (session.isPending) return <Loading />
 *   if (!session.data) return <LoginForm />
 *
 *   return <div>Hello, {session.data.user.name}</div>
 * }
 * ```
 */

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export default authClient
