# RoamPilot Razorpay credits setup

RoamPilot uses one-time Razorpay payments instead of recurring subscriptions.
Razorpay Standard accounts have no setup fee or annual maintenance charge, but
Razorpay charges a processing fee on successful payments.

## Weekly free credits

Every account receives at least 39 credits every seven days. This is the exact
sum required to use every currently metered AI action once. Unused weekly
credits are replaced by the renewed allowance; purchased credits do not expire.
Weekly credits are always spent before purchased credits.

`WEEKLY_FREE_CREDITS` may be set higher than 39. Values below 39 are raised to
39 by the server.

## Razorpay configuration

1. Create a Razorpay account and generate Test Mode API keys.
2. Add the values to `server/.env`:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
WEEKLY_FREE_CREDITS=39
```

3. In Razorpay payment capture settings, enable automatic capture.
4. Create a webhook pointing to:

```text
https://your-api-domain.example/api/billing/razorpay/webhook
```

5. Use the same value as `RAZORPAY_WEBHOOK_SECRET` and enable:

- `payment.captured`
- `payment.failed`

The client callback is verified server-side and the webhook provides recovery
when the browser closes after payment. Both paths are idempotent and cannot
grant the same order twice.

Before production, replace Test Mode keys with Live Mode keys and complete
Razorpay account activation/KYC.
