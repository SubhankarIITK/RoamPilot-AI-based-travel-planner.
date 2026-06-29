# RoamPilot billing setup

RoamPilot uses Stripe-hosted Checkout for subscriptions and the Stripe customer
portal for payment-method changes and cancellation. AI routes are locked until a
verified `invoice.paid` webhook activates the subscription and grants credits.

## Plans

| Plan | Display price | Monthly credits |
| --- | ---: | ---: |
| Explorer | INR 499 | 100 |
| Navigator | INR 999 | 300 |
| Voyager | INR 1,999 | 800 |

Display prices and credit allowances live in
`server/src/config/billingPlans.js`. Stripe remains the source of truth for the
amount actually charged.

## Stripe configuration

1. In Stripe, create one product with three recurring monthly prices, or three
   separate products.
2. Copy each recurring Price ID into `server/.env`:

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_EXPLORER_PRICE_ID=price_...
   STRIPE_NAVIGATOR_PRICE_ID=price_...
   STRIPE_VOYAGER_PRICE_ID=price_...
   CLIENT_URL=http://localhost:5173
   ```

3. Enable the Stripe customer portal in the Stripe Dashboard.
4. Register this webhook endpoint:

   ```text
   https://your-api-domain.example/api/billing/webhook
   ```

5. Subscribe the endpoint to:

   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

For local testing with the Stripe CLI:

```powershell
stripe listen --forward-to localhost:5000/api/billing/webhook
```

Use the `whsec_...` value printed by that command only for local forwarded
events. Production must use the signing secret from the production webhook.

## Credit behavior

- Emails listed in `CREDIT_EXEMPT_EMAILS` have unlimited administrator AI
  access and never reserve or spend credits. Separate multiple emails with
  commas.
- New accounts receive 5 weekly free credits by default.
- Weekly free credits reset every seven days and do not roll over.
- Set `WEEKLY_FREE_CREDITS` to change the allowance without editing code.
- Only `invoice.paid` grants monthly credits.
- Duplicate invoice webhooks cannot grant credits twice.
- Every paid AI route atomically reserves its configured credit cost.
- HTTP failures refund the reservation once.
- Expired, canceled, unpaid, past-due, and paused subscriptions cannot spend
  paid credits, but may still spend their weekly free allowance.
- Read-only chat history and trip-score retrieval do not spend credits because
  they do not call an AI model.

The recent ledger is visible at `/billing`. Credit costs are defined in
`server/src/config/billingPlans.js`.
