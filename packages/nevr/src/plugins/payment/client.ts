// =============================================================================
// PAYMENT CLIENT PLUGIN
// Client-side payment management with proper plugin pattern
// Follows auth/organization plugin dual pattern for SDK type inference
// =============================================================================

import { atom, type WritableAtom } from "nanostores"
import type {
    NevrClientPlugin,
    NevrFetch,
    NevrFetchResponse,
    NevrFetchError,
    ClientStore,
    ClientAtomListener,
} from "../../client/types.js"
import type { Subscription, PaymentPlan } from "./types.js"
import { PAYMENT_ERROR_CODES } from "./error-codes.js"

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * Subscription state
 */
export interface SubscriptionState {
    /** Active subscriptions */
    subscriptions: Subscription[]
    /** Error if any */
    error: NevrFetchError | null
    /** Loading state */
    isPending: boolean
}

// =============================================================================
// CLIENT OPTIONS
// =============================================================================

export interface PaymentClientOptions {
    /** Base path for payment endpoints (default: /payment) */
    basePath?: string
    /** Auto-refresh on window focus */
    refreshOnWindowFocus?: boolean
}

// =============================================================================
// CLIENT METHODS
// =============================================================================

export interface UpgradeParams {
    plan: string
    annual?: boolean
    referenceId?: string
    subscriptionId?: string
    seats?: number
    metadata?: Record<string, any>
    successUrl?: string
    cancelUrl?: string
    returnUrl?: string
    disableRedirect?: boolean
}

export interface CancelParams {
    referenceId?: string
    subscriptionId?: string
    returnUrl: string
}

export interface RestoreParams {
    referenceId?: string
    subscriptionId?: string
}

export interface ListParams {
    referenceId?: string
}

export interface BillingPortalParams {
    locale?: string
    referenceId?: string
    returnUrl?: string
}

export interface PaymentClientMethods {
    subscription: {
        upgrade(params: UpgradeParams): Promise<NevrFetchResponse<{ url: string; redirect: boolean }>>
        cancel(params: CancelParams): Promise<NevrFetchResponse<{ url: string; redirect: boolean }>>
        restore(params?: RestoreParams): Promise<NevrFetchResponse<{ id: string; status: string }>>
        list(params?: ListParams): Promise<NevrFetchResponse<Subscription[]>>
        billingPortal(params?: BillingPortalParams): Promise<NevrFetchResponse<{ url: string; redirect: boolean }>>
    }
}

// =============================================================================
// CLIENT PLUGIN TYPE
// =============================================================================

/**
 * Payment client plugin type with server inference
 */
export type PaymentClientPlugin = NevrClientPlugin & {
    readonly $InferTypes: {
        endpoints: PaymentClientMethods
        $ERROR_CODES: typeof PAYMENT_ERROR_CODES
        Subscription: Subscription
        PaymentPlan: PaymentPlan
    }
}

// =============================================================================
// ATOMS
// =============================================================================

function createSubscriptionAtom(): WritableAtom<SubscriptionState> {
    return atom<SubscriptionState>({
        subscriptions: [],
        error: null,
        isPending: true,
    })
}

// =============================================================================
// CLIENT PLUGIN FACTORY
// =============================================================================

/**
 * Create payment client plugin for frontend usage
 *
 * @example
 * ```typescript
 * import { createTypedClient } from "nevr/client"
 * import { paymentClient } from "nevr/plugins/payment/client"
 * import type { API } from "./api"
 *
 * const client = createTypedClient<API>({
 *   baseURL: "http://localhost:3000",
 *   plugins: [paymentClient()]
 * })
 *
 * // Upgrade subscription
 * const { data } = await client.payment.subscription.upgrade({
 *   plan: "pro",
 *   successUrl: "/dashboard",
 * })
 *
 * // Reactive state
 * client.$store.atoms.subscriptions.subscribe(({ subscriptions }) => {
 *   console.log("Active subs:", subscriptions.length)
 * })
 * ```
 */
export function paymentClient(options?: PaymentClientOptions): PaymentClientPlugin {
    const basePath = options?.basePath || "/payment"
    const refreshOnWindowFocus = options?.refreshOnWindowFocus !== false

    // Atoms
    let $subscriptions: WritableAtom<SubscriptionState>
    let $subSignal: WritableAtom<boolean>

    return {
        id: "payment-client",

        /**
         * Path methods for endpoint proxy
         */
        pathMethods: {
            [`${basePath}/subscription/upgrade`]: "POST",
            [`${basePath}/subscription/cancel`]: "POST",
            [`${basePath}/subscription/cancel-callback`]: "POST",
            [`${basePath}/subscription/restore`]: "POST",
            [`${basePath}/subscription/list`]: "GET",
            [`${basePath}/subscription/success`]: "GET",
            [`${basePath}/subscription/billing-portal`]: "POST",
            [`${basePath}/webhook/stripe`]: "POST",
        },

        /**
         * Get reactive atoms
         */
        getAtoms($fetch: NevrFetch) {
            $subscriptions = createSubscriptionAtom()
            $subSignal = atom<boolean>(false)

            // Initial fetch
            fetchSubscriptions($fetch)

            // Window focus refresh
            if (refreshOnWindowFocus && typeof window !== "undefined") {
                window.addEventListener("focus", () => {
                    fetchSubscriptions($fetch)
                })
            }

            return {
                subscriptions: $subscriptions,
                $subSignal,
            }

            async function fetchSubscriptions(fetch: NevrFetch) {
                $subscriptions.set({ ...$subscriptions.get(), isPending: true })

                try {
                    const result = await fetch(`${basePath}/subscription/list`, { method: "GET" })

                    if (result.error) {
                        $subscriptions.set({
                            subscriptions: [],
                            error: result.error,
                            isPending: false,
                        })
                    } else {
                        $subscriptions.set({
                            subscriptions: (result.data as Subscription[]) || [],
                            error: null,
                            isPending: false,
                        })
                    }
                } catch (error) {
                    $subscriptions.set({
                        subscriptions: [],
                        error: error as any,
                        isPending: false,
                    })
                }
            }
        },

        /**
         * Atom listeners for triggering refreshes
         */
        atomListeners: [
            {
                matcher: (path: string) => {
                    return (
                        path === `${basePath}/subscription/upgrade` ||
                        path === `${basePath}/subscription/cancel` ||
                        path === `${basePath}/subscription/restore`
                    )
                },
                signal: "$subSignal",
            },
        ] as ClientAtomListener[],

        /**
         * Get action methods
         */
        getActions($fetch: NevrFetch, $store: ClientStore) {
            // Helper to update subscriptions
            const updateSubscriptions = async () => {
                if ($subscriptions) {
                    $subscriptions.set({ ...$subscriptions.get(), isPending: true })
                    try {
                        const result = await $fetch(`${basePath}/subscription/list`, { method: "GET" })
                        $subscriptions.set({
                            subscriptions: (result.data as Subscription[]) || [],
                            error: result.error || null,
                            isPending: false,
                        })
                    } catch (error) {
                        $subscriptions.set({
                            subscriptions: [],
                            error: error as any,
                            isPending: false,
                        })
                    }
                }
            }

            return {
                payment: {
                    subscription: {
                        upgrade: async (params: UpgradeParams) => {
                            const result = await $fetch(`${basePath}/subscription/upgrade`, {
                                method: "POST",
                                body: params,
                            })
                            if (!result.error) {
                                await updateSubscriptions()
                            }
                            return result as NevrFetchResponse<{ url: string; redirect: boolean }>
                        },

                        cancel: async (params: CancelParams) => {
                            const result = await $fetch(`${basePath}/subscription/cancel`, {
                                method: "POST",
                                body: params,
                            })
                            if (!result.error) {
                                await updateSubscriptions()
                            }
                            return result as NevrFetchResponse<{ url: string; redirect: boolean }>
                        },

                        restore: async (params?: RestoreParams) => {
                            const result = await $fetch(`${basePath}/subscription/restore`, {
                                method: "POST",
                                body: params || {},
                            })
                            if (!result.error) {
                                await updateSubscriptions()
                            }
                            return result as NevrFetchResponse<{ id: string; status: string }>
                        },

                        list: async (params?: ListParams) => {
                            const result = await $fetch(`${basePath}/subscription/list`, {
                                method: "GET",
                                query: params as Record<string, string> | undefined,
                            })
                            return result as NevrFetchResponse<Subscription[]>
                        },

                        billingPortal: async (params?: BillingPortalParams) => {
                            return $fetch(`${basePath}/subscription/billing-portal`, {
                                method: "POST",
                                body: params || {},
                            }) as Promise<NevrFetchResponse<{ url: string; redirect: boolean }>>
                        },
                    },
                },
            }
        },

        // Type inference for SDK
        $InferTypes: {
            endpoints: {} as PaymentClientMethods,
            $ERROR_CODES: PAYMENT_ERROR_CODES,
            Subscription: {} as Subscription,
            PaymentPlan: {} as PaymentPlan,
        },
    } as PaymentClientPlugin
}

// =============================================================================
// REACT HOOK TYPES
// =============================================================================

export interface UsePaymentResult {
    subscriptions: Subscription[]
    isLoading: boolean
    error: Error | null
    upgrade: PaymentClientMethods["subscription"]["upgrade"]
    cancel: PaymentClientMethods["subscription"]["cancel"]
    restore: PaymentClientMethods["subscription"]["restore"]
    billingPortal: PaymentClientMethods["subscription"]["billingPortal"]
    refresh: () => Promise<void>
}

export default paymentClient
