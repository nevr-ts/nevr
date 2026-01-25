# Payment Plugin

Subscription and payment processing with Stripe integration.

## Installation

```typescript
import { nevr } from "nevr"
import { payment } from "nevr/plugins/payment"

const api = nevr({
  plugins: [
    payment({
      provider: "stripe",
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY!,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      },
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          { name: "free", priceId: "price_free" },
          { name: "pro", priceId: "price_pro", limits: { projects: 10 } },
          { name: "enterprise", priceId: "price_enterprise", limits: { projects: -1 } },
        ],
      },
    }),
  ],
})

export type API = typeof api
```

## Configuration

```typescript
payment({
  // Payment provider
  provider: "stripe", // "stripe" | "lemonsqueezy" | "paddle"

  // Default currency
  defaultCurrency: "usd",

  // Auto-create Stripe customer on user signup
  createCustomerOnSignUp: true,

  // Stripe configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  // Subscription configuration
  subscription: {
    enabled: true,
    plans: [
      { 
        name: "free", 
        priceId: "price_free",
        limits: { projects: 5, storage: 1024 } 
      },
      { 
        name: "pro", 
        priceId: "price_pro",
        annualPriceId: "price_pro_annual",
        limits: { projects: 50, storage: 10240 } 
      },
      { 
        name: "enterprise", 
        priceId: "price_enterprise",
        limits: { projects: -1, storage: -1 } // unlimited
      },
    ],
    // Multi-tenant (organization billing)
    authorizeReference: async ({ user, referenceId }) => {
      return isOrgAdmin(user.id, referenceId)
    },
    // Trial period
    trialPeriodDays: 14,
    // Callbacks
    onSubscriptionComplete: async ({ subscription }) => {
      console.log("Subscription created:", subscription.id)
    },
    onSubscriptionUpdate: async ({ subscription }) => {
      console.log("Subscription updated:", subscription.status)
    },
    onTrialEnd: async ({ subscription }) => {
      console.log("Trial ended for:", subscription.referenceId)
    },
  },
})
```

## Endpoints

### Subscription Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/payment/subscription/upgrade` | Upgrade/create subscription |
| POST | `/payment/subscription/cancel` | Cancel subscription |
| POST | `/payment/subscription/cancel-callback` | Cancel callback |
| POST | `/payment/subscription/restore` | Restore canceled subscription |
| GET | `/payment/subscription/list` | List active subscriptions |
| GET | `/payment/subscription/success` | Success callback |
| POST | `/payment/subscription/billing-portal` | Open billing portal |

### Webhook

| Method | Path | Description |
|--------|------|-------------|
| POST | `/payment/webhook/stripe` | Stripe webhook handler |

## Client SDK

The payment plugin uses the unified client pattern with `createTypedClient`:

```typescript
import { createTypedClient } from "nevr/client"
import { authClient } from "nevr/plugins/auth/client"
import { paymentClient } from "nevr/plugins/payment/client"
import type { API } from "./api"

// Create typed client with server API inference
export const client = createTypedClient<API>({
  baseURL: "http://localhost:3000",
  plugins: [
    authClient(),
    paymentClient(),
  ],
})

// Upgrade subscription
const { data } = await client.payment.subscription.upgrade({
  plan: "pro",
  successUrl: "/dashboard",
  cancelUrl: "/pricing",
})
if (data?.url) window.location.href = data.url

// List active subscriptions
const { data: subs } = await client.payment.subscription.list()

// Cancel subscription
const { data: cancel } = await client.payment.subscription.cancel({
  returnUrl: "/account",
})
if (cancel?.url) window.location.href = cancel.url

// Restore a canceled subscription
await client.payment.subscription.restore()

// Open billing portal
const { data: portal } = await client.payment.subscription.billingPortal({
  returnUrl: "/settings",
})
if (portal?.url) window.location.href = portal.url
```

## Multi-Tenant Billing

Use `referenceId` for organization billing:

```typescript
// Upgrade for organization
await client.payment.subscription.upgrade({
  plan: "pro",
  referenceId: organizationId, // Bill to organization
  successUrl: "/success",
  cancelUrl: "/cancel",
})

// Get organization's subscriptions
const { data } = await client.payment.subscription.list({
  referenceId: organizationId,
})
```

## Type Inference

The plugin exports types for SDK inference:

```typescript
import type { InferPlugin } from "nevr"
import { payment } from "nevr/plugins/payment"

type PaymentPlugin = InferPlugin<typeof payment>

// Available types:
// PaymentPlugin["Subscription"]
// PaymentPlugin["PaymentPlan"]
```

## Helper Functions

```typescript
import { 
  hasActiveSubscription, 
  getCurrentPlan, 
  hasFeatureAccess,
  getFeatureLimit 
} from "nevr/plugins/payment"

// Check if reference has active subscription
const isActive = await hasActiveSubscription(driver, referenceId)

// Get current plan name
const plan = await getCurrentPlan(driver, referenceId)

// Check feature access
const canCreate = await hasFeatureAccess(driver, referenceId, "projects", plans)

// Get feature limit
const limit = await getFeatureLimit(driver, referenceId, "projects", plans)
```

## Schema

### Subscription

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| referenceId | string | User/Org reference |
| stripeCustomerId | string | Stripe customer ID |
| stripeSubscriptionId | string | Stripe subscription ID |
| plan | string | Plan name |
| priceId | string | Stripe price ID |
| status | string | active, canceled, past_due, trialing |
| periodStart | datetime | Period start |
| periodEnd | datetime | Period end |
| trialStart | datetime? | Trial start |
| trialEnd | datetime? | Trial end |
| cancelAtPeriodEnd | boolean | Will cancel at period end |
| seats | number? | Number of seats |

### PaymentPlan

| Field | Type | Description |
|-------|------|-------------|
| name | string | Plan name |
| priceId | string | Stripe price ID |
| annualPriceId | string? | Annual price ID |
| limits | object? | Feature limits |
| trialDays | number? | Trial period |

## Webhook Events

The plugin handles these Stripe events:

| Event | Description |
|-------|-------------|
| `checkout.session.completed` | Checkout completed |
| `customer.subscription.created` | Subscription created |
| `customer.subscription.updated` | Subscription updated |
| `customer.subscription.deleted` | Subscription canceled |
| `invoice.paid` | Invoice paid |
| `invoice.payment_failed` | Payment failed |
| `customer.subscription.trial_will_end` | Trial ending soon |

## Database Hooks

The payment plugin automatically:

1. **Creates Stripe customer on signup** - If `createCustomerOnSignUp: true`
2. **Links existing customers** - Finds customer by email before creating
3. **Syncs email changes** - Updates Stripe when user email changes
