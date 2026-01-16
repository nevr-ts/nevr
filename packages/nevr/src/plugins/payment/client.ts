// =============================================================================
// PAYMENT CLIENT
// Client-side helpers for Stripe payment integration
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PaymentClientOptions {
    /** Base URL for API calls (default: auto-detect from window.location) */
    baseUrl?: string
    /** Custom fetch function */
    fetch?: typeof fetch
    /** Get auth token for requests */
    getToken?: () => string | Promise<string> | null
}

export interface PaymentClientMethods {
    /** Create a checkout session and redirect to Stripe */
    checkout(params: CheckoutParams): Promise<CheckoutResult>
    /** Get current subscription */
    getSubscription(): Promise<SubscriptionResult>
    /** List all subscriptions */
    listSubscriptions(): Promise<SubscriptionsResult>
    /** Cancel subscription */
    cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<CancelResult>
    /** Resume subscription (undo cancel at period end) */
    resumeSubscription(subscriptionId: string): Promise<ResumeResult>
    /** Change subscription plan */
    changePlan(subscriptionId: string, newPriceId: string): Promise<ChangePlanResult>
    /** Open billing portal */
    openPortal(returnUrl?: string): Promise<PortalResult>
    /** Get payment customer */
    getCustomer(): Promise<CustomerResult>
    /** Create payment customer */
    createCustomer(params?: CreateCustomerParams): Promise<CustomerResult>
}

export interface CheckoutParams {
    priceId: string
    mode?: "payment" | "subscription" | "setup"
    quantity?: number
    successUrl?: string
    cancelUrl?: string
    metadata?: Record<string, string>
    /** If true, redirect to checkout automatically */
    redirect?: boolean
}

export interface CheckoutResult {
    sessionId: string
    url: string
}

export interface SubscriptionResult {
    subscription: {
        id: string
        plan: string
        status: string
        currentPeriodStart: string
        currentPeriodEnd: string
        cancelAtPeriodEnd: boolean
        trialEnd?: string
    } | null
}

export interface SubscriptionsResult {
    subscriptions: Array<{
        id: string
        plan: string
        status: string
        currentPeriodStart: string
        currentPeriodEnd: string
        cancelAtPeriodEnd: boolean
        canceledAt?: string
        trialEnd?: string
        createdAt: string
    }>
}

export interface CancelResult {
    success: boolean
    cancelAtPeriodEnd: boolean
    message: string
}

export interface ResumeResult {
    success: boolean
    message: string
}

export interface ChangePlanResult {
    success: boolean
    message: string
    newPlan: string
}

export interface PortalResult {
    url: string
}

export interface CustomerResult {
    customer: {
        id: string
        email: string
        name?: string
        createdAt: string
    } | null
}

export interface CreateCustomerParams {
    name?: string
    metadata?: Record<string, string>
}

// -----------------------------------------------------------------------------
// Client Factory
// -----------------------------------------------------------------------------

/**
 * Create a payment client for frontend usage
 *
 * @example
 * ```typescript
 * import { paymentClient } from "@nevr/payment"
 *
 * const payment = paymentClient({
 *   getToken: () => localStorage.getItem("token"),
 * })
 *
 * // Create checkout and redirect
 * await payment.checkout({
 *   priceId: "price_xxx",
 *   redirect: true,
 * })
 *
 * // Get subscription
 * const { subscription } = await payment.getSubscription()
 *
 * // Open billing portal
 * const { url } = await payment.openPortal()
 * window.location.href = url
 * ```
 */
export function paymentClient(options: PaymentClientOptions = {}): PaymentClientMethods {
    const baseUrl = options.baseUrl || (typeof window !== "undefined" ? window.location.origin : "")
    const fetchFn = options.fetch || fetch

    async function request<T>(
        method: string,
        path: string,
        body?: Record<string, unknown>
    ): Promise<T> {
        const url = `${baseUrl}/payment${path}`
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }

        // Add auth token if available
        if (options.getToken) {
            const token = await options.getToken()
            if (token) {
                headers["Authorization"] = `Bearer ${token}`
            }
        }

        const response = await fetchFn(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            credentials: "include",
        })

        const data = await response.json()

        if (!response.ok) {
            const error = new Error(data.message || "Request failed") as any
            error.code = data.error || data.code
            error.status = response.status
            error.data = data
            throw error
        }

        return data
    }

    return {
        async checkout(params) {
            const result = await request<CheckoutResult>("POST", "/checkout", {
                priceId: params.priceId,
                mode: params.mode || "subscription",
                quantity: params.quantity || 1,
                successUrl: params.successUrl,
                cancelUrl: params.cancelUrl,
                metadata: params.metadata,
            })

            if (params.redirect && typeof window !== "undefined") {
                window.location.href = result.url
            }

            return result
        },

        async getSubscription() {
            return request<SubscriptionResult>("GET", "/subscription")
        },

        async listSubscriptions() {
            return request<SubscriptionsResult>("GET", "/subscriptions")
        },

        async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
            return request<CancelResult>("POST", "/subscription/cancel", {
                subscriptionId,
                cancelAtPeriodEnd,
            })
        },

        async resumeSubscription(subscriptionId) {
            return request<ResumeResult>("POST", "/subscription/resume", {
                subscriptionId,
            })
        },

        async changePlan(subscriptionId, newPriceId) {
            return request<ChangePlanResult>("POST", "/subscription/change-plan", {
                subscriptionId,
                newPriceId,
            })
        },

        async openPortal(returnUrl) {
            const result = await request<PortalResult>("POST", "/portal", {
                returnUrl,
            })

            // Optionally redirect
            if (typeof window !== "undefined" && result.url) {
                window.location.href = result.url
            }

            return result
        },

        async getCustomer() {
            return request<CustomerResult>("GET", "/customer")
        },

        async createCustomer(params) {
            return request<CustomerResult>("POST", "/customer", params as Record<string, unknown> || {})
        },
    }
}

// -----------------------------------------------------------------------------
// React Hooks (if React is available)
// -----------------------------------------------------------------------------

/**
 * React hook for payment state (optional, only if React is available)
 *
 * @example
 * ```tsx
 * import { usePayment } from "@nevr/payment"
 *
 * function PricingPage() {
 *   const { subscription, isLoading, checkout, openPortal } = usePayment()
 *
 *   if (isLoading) return <div>Loading...</div>
 *
 *   if (subscription) {
 *     return (
 *       <div>
 *         <p>Current plan: {subscription.plan}</p>
 *         <button onClick={() => openPortal()}>Manage Billing</button>
 *       </div>
 *     )
 *   }
 *
 *   return (
 *     <button onClick={() => checkout({ priceId: "price_xxx" })}>
 *       Subscribe
 *     </button>
 *   )
 * }
 * ```
 */
export interface UsePaymentResult {
    subscription: SubscriptionResult["subscription"]
    customer: CustomerResult["customer"]
    isLoading: boolean
    error: Error | null
    checkout: PaymentClientMethods["checkout"]
    cancelSubscription: PaymentClientMethods["cancelSubscription"]
    resumeSubscription: PaymentClientMethods["resumeSubscription"]
    changePlan: PaymentClientMethods["changePlan"]
    openPortal: PaymentClientMethods["openPortal"]
    refresh: () => Promise<void>
}

// Note: Actual React hook implementation would go here if React is detected
// For now, just export the type for documentation
