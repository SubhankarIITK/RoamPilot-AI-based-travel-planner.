import { createHmac } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentMatchesOrder,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from '../src/services/razorpayService.js';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
} from '../src/schemas/billingSchemas.js';

const withRazorpaySecrets = callback => {
  const previous = {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  };
  process.env.RAZORPAY_KEY_ID = 'rzp_test_example';
  process.env.RAZORPAY_KEY_SECRET = 'payment-secret-for-tests';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-secret-for-tests';
  try {
    callback();
  } finally {
    if (previous.keyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previous.keyId;
    if (previous.keySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = previous.keySecret;
    if (previous.webhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previous.webhookSecret;
  }
};

test('Razorpay callback signatures are verified against the server order id', () => {
  withRazorpaySecrets(() => {
    const orderId = 'order_test_123';
    const paymentId = 'pay_test_456';
    const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    assert.equal(verifyRazorpayPaymentSignature({ orderId, paymentId, signature }), true);
    assert.equal(verifyRazorpayPaymentSignature({
      orderId,
      paymentId: 'pay_tampered',
      signature,
    }), false);
  });
});

test('Razorpay webhook signatures use the unparsed raw request body', () => {
  withRazorpaySecrets(() => {
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    assert.equal(verifyRazorpayWebhookSignature({ rawBody, signature }), true);
    assert.equal(verifyRazorpayWebhookSignature({
      rawBody: Buffer.from('{"event":"payment.failed"}'),
      signature,
    }), false);
  });
});

test('credits require a captured payment matching amount, currency, and order', () => {
  const order = {
    providerOrderId: 'order_test_123',
    amountPaise: 9900,
    currency: 'INR',
  };
  assert.equal(paymentMatchesOrder({
    status: 'captured',
    order_id: order.providerOrderId,
    amount: 9900,
    currency: 'INR',
  }, order), true);
  assert.equal(paymentMatchesOrder({
    status: 'captured',
    order_id: order.providerOrderId,
    amount: 100,
    currency: 'INR',
  }, order), false);
  assert.equal(paymentMatchesOrder({
    status: 'authorized',
    order_id: order.providerOrderId,
    amount: 9900,
    currency: 'INR',
  }, order), false);
});

test('payment request schemas reject arbitrary packs and malformed signatures', () => {
  assert.equal(createPaymentOrderSchema.safeParse({ packKey: 'starter' }).success, true);
  assert.equal(createPaymentOrderSchema.safeParse({ packKey: 'unlimited' }).success, false);
  assert.equal(verifyPaymentSchema.safeParse({
    razorpay_order_id: 'order_test_123',
    razorpay_payment_id: 'pay_test_456',
    razorpay_signature: 'not-a-signature',
  }).success, false);
});
