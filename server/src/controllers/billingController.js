import { randomUUID } from 'node:crypto';
import PaymentOrder from '../models/PaymentOrder.js';
import CreditTransaction from '../models/CreditTransaction.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  AI_CREDIT_COSTS,
  COMPLETE_TRIAL_CREDITS,
  getCreditPack,
  getPublicCreditPacks,
  getWeeklyFreeCreditAllowance,
} from '../config/billingPlans.js';
import {
  getOrCreateSubscription,
  getSpendableBalance,
} from '../services/creditService.js';
import {
  createRazorpayOrder,
  getRazorpayPayment,
  isRazorpayConfigured,
  paymentMatchesOrder,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from '../services/razorpayService.js';
import { grantPurchasedCredits } from '../services/paymentCreditService.js';
import { isCreditExemptUser } from '../config/creditAccess.js';
import logger from '../services/logger.js';

const serializeCredits = subscription => ({
  creditBalance: getSpendableBalance(subscription),
  paidCreditBalance: subscription.creditBalance || 0,
  weeklyFreeCreditBalance: subscription.weeklyFreeCreditBalance || 0,
  weeklyFreeCreditsRefreshAt: subscription.weeklyFreeCreditsRefreshAt,
  weeklyFreeCreditAllowance: getWeeklyFreeCreditAllowance(),
});

export const getBillingSummary = asyncHandler(async (req, res) => {
  const subscription = await getOrCreateSubscription(req.user._id);
  const transactions = await CreditTransaction.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(25)
    .select('type amount balanceAfter action description createdAt')
    .lean();

  res.json(new ApiResponse(200, {
    subscription: serializeCredits(subscription),
    transactions,
    creditCosts: AI_CREDIT_COSTS,
    completeTrialCredits: COMPLETE_TRIAL_CREDITS,
    paymentProvider: 'razorpay',
    paymentConfigured: isRazorpayConfigured(),
    creditExempt: isCreditExemptUser(req.user),
  }));
});

export const getPlans = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, getPublicCreditPacks().map(pack => ({
    ...pack,
    checkoutAvailable: isRazorpayConfigured(),
  }))));
});

export const createPaymentOrder = asyncHandler(async (req, res) => {
  if (isCreditExemptUser(req.user)) {
    throw new ApiError(400, 'This administrator account already has unlimited AI access.');
  }
  if (!isRazorpayConfigured()) {
    throw new ApiError(503, 'Razorpay checkout is not configured yet.');
  }
  const pack = getCreditPack(req.body.packKey);
  if (!pack) throw new ApiError(400, 'Invalid credit pack');

  const receipt = `rp_${randomUUID().replaceAll('-', '').slice(0, 28)}`;
  let providerOrder;
  try {
    providerOrder = await createRazorpayOrder({
      amountPaise: pack.amountPaise,
      currency: pack.currency,
      receipt,
      notes: {
        userId: String(req.user._id),
        packKey: pack.key,
        credits: String(pack.credits),
      },
    });
  } catch (error) {
    logger.error(
      { stage: 'razorpay-create-order', code: error.code, statusCode: error.statusCode },
      'Could not create Razorpay order',
    );
    throw new ApiError(502, 'Secure checkout is temporarily unavailable. Try again shortly.');
  }

  const order = await PaymentOrder.create({
    userId: req.user._id,
    packKey: pack.key,
    credits: pack.credits,
    amountPaise: pack.amountPaise,
    currency: pack.currency,
    receipt,
    providerOrderId: providerOrder.id,
  });

  res.json(new ApiResponse(200, {
    keyId: process.env.RAZORPAY_KEY_ID,
    orderId: order.providerOrderId,
    amount: order.amountPaise,
    currency: order.currency,
    credits: order.credits,
    packName: pack.name,
    prefill: {
      name: req.user.name,
      email: req.user.email,
    },
  }, 'Payment order created'));
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body;
  const order = await PaymentOrder.findOne({
    providerOrderId: orderId,
    userId: req.user._id,
  });
  if (!order) throw new ApiError(404, 'Payment order was not found.');
  if (!verifyRazorpayPaymentSignature({ orderId: order.providerOrderId, paymentId, signature })) {
    throw new ApiError(400, 'Payment verification failed.');
  }

  let payment;
  try {
    payment = await getRazorpayPayment(paymentId);
  } catch {
    throw new ApiError(502, 'Payment confirmation is delayed. Your credits will be recovered by the payment webhook.');
  }
  if (!paymentMatchesOrder(payment, order)) {
    throw new ApiError(409, 'Payment is not captured yet. Credits will be added after confirmation.');
  }

  const grant = await grantPurchasedCredits({ order, paymentId });
  res.json(new ApiResponse(200, grant, 'Payment verified and credits added.'));
});

export const razorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!verifyRazorpayWebhookSignature({ rawBody: req.body, signature })) {
    return res.status(400).json({ received: false });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ received: false });
  }

  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const order = await PaymentOrder.findOne({ providerOrderId: payment?.order_id });
      if (order && paymentMatchesOrder(payment, order)) {
        await grantPurchasedCredits({
          order,
          paymentId: payment.id,
          webhookEventId: String(req.headers['x-razorpay-event-id'] || ''),
        });
      }
    } else if (event.event === 'payment.failed') {
      const payment = event.payload?.payment?.entity;
      await PaymentOrder.updateOne(
        { providerOrderId: payment?.order_id, status: 'created' },
        {
          $set: {
            status: 'failed',
            failureReason: String(payment?.error_description || 'Payment failed').slice(0, 300),
          },
        },
      );
    }
    return res.json({ received: true });
  } catch (error) {
    logger.error(
      { stage: 'razorpay-webhook', event: event?.event, error: error.message },
      'Razorpay webhook processing failed',
    );
    return res.status(500).json({ received: false });
  }
};
