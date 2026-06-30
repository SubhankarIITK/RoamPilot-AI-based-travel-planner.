import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

const API_BASE = 'https://api.razorpay.com/v1';

export const isRazorpayConfigured = () => Boolean(
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET,
);

const credentials = () => {
  if (!isRazorpayConfigured()) {
    const error = new Error('Razorpay is not configured');
    error.code = 'PAYMENT_NOT_CONFIGURED';
    throw error;
  }
  return Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString('base64');
};

const razorpayRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${credentials()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.description || 'Payment provider request failed');
    error.statusCode = response.status;
    error.code = body?.error?.code || 'RAZORPAY_REQUEST_FAILED';
    throw error;
  }
  return body;
};

export const createRazorpayOrder = async ({
  amountPaise,
  currency,
  receipt,
  notes,
}) => razorpayRequest('/orders', {
  method: 'POST',
  body: JSON.stringify({
    amount: amountPaise,
    currency,
    receipt,
    notes,
  }),
});

export const getRazorpayPayment = paymentId =>
  razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);

const safeSignatureMatch = (expected, received) => {
  if (!/^[a-f0-9]{64}$/i.test(String(received || ''))) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  return expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);
};

export const verifyRazorpayPaymentSignature = ({
  orderId,
  paymentId,
  signature,
}) => {
  if (!isRazorpayConfigured()) return false;
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeSignatureMatch(expected, signature);
};

export const verifyRazorpayWebhookSignature = ({ rawBody, signature }) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(rawBody)) return false;
  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return safeSignatureMatch(expected, signature);
};

export const paymentMatchesOrder = (payment, order) =>
  payment?.status === 'captured' &&
  payment?.order_id === order.providerOrderId &&
  Number(payment?.amount) === Number(order.amountPaise) &&
  payment?.currency === order.currency;
