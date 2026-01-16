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
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      },
    }),
  ],
})
```

## Configuration

```typescript
payment({
  // Payment provider
  provider: "stripe",

  // Stripe configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    apiVersion: "2023-10-16",
  },

  // Subscription plans
  plans: {
    free: {
      name: "Free",
      price: 0,
      features: ["5 projects", "1GB storage"],
    },
    pro: {
      name: "Pro",
      priceId: "price_xxx", // Stripe price ID
      features: ["Unlimited projects", "10GB storage"],
    },
    enterprise: {
      name: "Enterprise",
      priceId: "price_yyy",
      features: ["Everything in Pro", "Priority support"],
    },
  },

  // Use referenceId for multi-tenant (organization billing)
  useReferenceId: true,

  // Callbacks
  onSubscriptionCreated: async (subscription) => {
    console.log("New subscription:", subscription.id)
  },
  onSubscriptionUpdated: async (subscription) => {
    console.log("Subscription updated:", subscription.id)
  },
  onPaymentSucceeded: async (payment) => {
    console.log("Payment received:", payment.amount)
  },
})
```

## Endpoints

### Checkout

```
POST /payment/checkout
```

**Request:**
```json
{
  "priceId": "price_xxx",
  "successUrl": "/success",
  "cancelUrl": "/cancel",
  "referenceId": "org_123"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### Customer Portal

```
POST /payment/portal
```

**Request:**
```json
{
  "returnUrl": "/settings/billing",
  "referenceId": "org_123"
}
```

### Subscriptions

```
GET  /payment/subscriptions              List subscriptions
GET  /payment/subscriptions/:id          Get subscription
POST /payment/subscriptions/:id/cancel   Cancel subscription
```

### Webhook

```
POST /payment/webhook
```

Handles Stripe webhook events automatically.

## Client Usage

```typescript
import { createClient } from "nevr/client"
import { paymentClient } from "nevr/plugins/payment/client"

const client = createClient({
  baseURL: "/api",
  plugins: [paymentClient()],
})

// Create checkout session
const { data } = await client.payment.createCheckout({
  priceId: "price_xxx",
  successUrl: window.location.origin + "/success",
  cancelUrl: window.location.origin + "/cancel",
})

// Redirect to Stripe
window.location.href = data.url

// Open customer portal
const { data: portal } = await client.payment.createPortal({
  returnUrl: window.location.origin + "/settings",
})
window.location.href = portal.url

// Get current subscription
const { data: subscription } = await client.payment.getSubscription()
```

## Multi-Tenant Billing

Use `referenceId` for organization billing:

```typescript
// Checkout for organization
await client.payment.createCheckout({
  priceId: "price_xxx",
  referenceId: organizationId, // Bill to organization
  successUrl: "/success",
  cancelUrl: "/cancel",
})

// Get organization's subscription
const { data } = await client.payment.getSubscription({
  referenceId: organizationId,
})
```

## Schema

### Subscription

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| customerId | string | Stripe customer ID |
| referenceId | string? | User/Org reference |
| priceId | string | Stripe price ID |
| status | string | active, canceled, past_due |
| currentPeriodStart | datetime | Period start |
| currentPeriodEnd | datetime | Period end |
| cancelAtPeriodEnd | boolean | Will cancel at end |

### Payment

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| subscriptionId | string? | Subscription reference |
| amount | number | Amount in cents |
| currency | string | Currency code |
| status | string | succeeded, failed |
| createdAt | datetime | Payment timestamp |

## Webhook Events

The plugin handles these Stripe events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
