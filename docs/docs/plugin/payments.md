# Payments Plugin

The Payments plugin provides a seamless integration with Stripe, handling subscriptions, one-time payments, and webhooks while letting you control the data schema.

## Installation

```bash
pnpm add stripe
```

## Usage

We recommend configuring the payments plugin in a separate file.

**`src/plugins/payments.ts`**
```typescript
import { payments } from "nevr/plugins/payments"

export const paymentsPlugin = payments({
  provider: "stripe",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },
  // Optional: Customize defaults
  currency: "usd",
  subscriptions: true
})
```

**`src/config.ts`**
```typescript
import { nevr } from "nevr"
import { paymentsPlugin } from "./plugins/payments"

export const api = nevr({
  plugins: [
    paymentsPlugin
  ]
})
```

## Schema

The plugin automatically adds the following entities to your database:

- **customer**: Links your `user` to a Stripe customer ID.
- **subscription**: Tracks active subscriptions and status.
- **payment**: Records one-time payment history.
- **product**: Syncs products from Stripe.
- **price**: Syncs prices from Stripe.

It also extends your `user` entity with:
- `stripeCustomerId`
- `subscriptionStatus`
- `subscriptionPlan`

## Customization

You can extend the plugin's schema to fit your needs.

```typescript
payments({
  provider: "stripe",
  extend: {
    entities: {
      customer: {
        fields: {
          // Add a phone number to the customer record
          phone: { add: { type: "string" } }
        }
      }
    }
  }
})
```

## API Routes

The plugin provides the following endpoints:

- `POST /payments/checkout` - Create a checkout session
- `POST /payments/portal` - Get customer portal URL
- `GET /payments/subscription` - Get current subscription status
- `POST /payments/webhook` - Handle Stripe webhooks
