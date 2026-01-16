// =============================================================================
// PAYMENT ERROR CODES
// Centralized error codes for payment plugin
// =============================================================================

/**
 * Payment plugin error codes
 */
export const PAYMENT_ERROR_CODES = {
    // Configuration errors
    STRIPE_NOT_CONFIGURED: "Stripe is not configured. Set stripeSecretKey in options or STRIPE_SECRET_KEY env variable",
    WEBHOOK_SECRET_NOT_CONFIGURED: "Webhook secret is not configured. Set stripeWebhookSecret in options or STRIPE_WEBHOOK_SECRET env variable",
    INVALID_PLAN: "Invalid plan specified",

    // Customer errors
    CUSTOMER_NOT_FOUND: "Payment customer not found",
    CUSTOMER_ALREADY_EXISTS: "Payment customer already exists for this user",
    CUSTOMER_CREATION_FAILED: "Failed to create payment customer",
    CUSTOMER_UPDATE_FAILED: "Failed to update payment customer",

    // Subscription errors
    SUBSCRIPTION_NOT_FOUND: "Subscription not found",
    SUBSCRIPTION_ALREADY_EXISTS: "Active subscription already exists",
    SUBSCRIPTION_CREATION_FAILED: "Failed to create subscription",
    SUBSCRIPTION_UPDATE_FAILED: "Failed to update subscription",
    SUBSCRIPTION_CANCEL_FAILED: "Failed to cancel subscription",
    SUBSCRIPTION_NOT_ACTIVE: "Subscription is not active",
    SUBSCRIPTION_ALREADY_CANCELED: "Subscription is already canceled",

    // Payment errors
    PAYMENT_FAILED: "Payment failed",
    PAYMENT_NOT_FOUND: "Payment not found",
    PAYMENT_ALREADY_PROCESSED: "Payment has already been processed",
    INSUFFICIENT_FUNDS: "Insufficient funds",
    CARD_DECLINED: "Card was declined",

    // Checkout errors
    CHECKOUT_SESSION_NOT_FOUND: "Checkout session not found",
    CHECKOUT_SESSION_EXPIRED: "Checkout session has expired",
    CHECKOUT_CREATION_FAILED: "Failed to create checkout session",
    INVALID_CHECKOUT_MODE: "Invalid checkout mode",

    // Invoice errors
    INVOICE_NOT_FOUND: "Invoice not found",
    INVOICE_ALREADY_PAID: "Invoice has already been paid",

    // Webhook errors
    WEBHOOK_SIGNATURE_INVALID: "Invalid webhook signature",
    WEBHOOK_PROCESSING_FAILED: "Failed to process webhook event",
    WEBHOOK_EVENT_NOT_SUPPORTED: "Webhook event type not supported",

    // Portal errors
    PORTAL_CREATION_FAILED: "Failed to create billing portal session",

    // General errors
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "You don't have permission to access this resource",
    INTERNAL_ERROR: "An internal error occurred",
    STRIPE_API_ERROR: "Stripe API error occurred",
} as const

export type PaymentErrorCode = keyof typeof PAYMENT_ERROR_CODES
