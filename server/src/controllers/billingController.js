import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import CreditTransaction from '../models/CreditTransaction.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  getBillingPlan,
  getBillingPlanByPriceId,
  getPublicBillingPlans,
  AI_CREDIT_COSTS,
} from '../config/billingPlans.js';
import { getOrCreateSubscription, isSubscriptionActive } from '../services/creditService.js';
import { getStripe, isStripeConfigured } from '../services/stripeService.js';
import { isCreditExemptUser } from '../config/creditAccess.js';

const stripeStatus = status => {
  const supported = ['incomplete', 'active', 'past_due', 'canceled', 'unpaid', 'paused'];
  return supported.includes(status) ? status : 'inactive';
};

const unixDate = value => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000) : null;
};

const getSubscriptionPriceId = stripeSubscription =>
  stripeSubscription.items?.data?.[0]?.price?.id || '';

const getSubscriptionPeriod = stripeSubscription => {
  const item = stripeSubscription.items?.data?.[0];
  return {
    start: unixDate(item?.current_period_start || stripeSubscription.current_period_start),
    end: unixDate(item?.current_period_end || stripeSubscription.current_period_end),
  };
};

const getInvoiceSubscriptionId = invoice => {
  const direct = invoice.subscription;
  if (typeof direct === 'string') return direct;
  if (direct?.id) return direct.id;

  const nested = invoice.parent?.subscription_details?.subscription;
  if (typeof nested === 'string') return nested;
  return nested?.id || '';
};

const getClientUrl = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();

const serializeSubscription = subscription => ({
  planKey: subscription.planKey,
  status: subscription.status,
  creditBalance:
    (subscription.weeklyFreeCreditBalance || 0) +
    (isSubscriptionActive(subscription) ? subscription.creditBalance : 0),
  paidCreditBalance: subscription.creditBalance,
  weeklyFreeCreditBalance: subscription.weeklyFreeCreditBalance,
  weeklyFreeCreditsRefreshAt: subscription.weeklyFreeCreditsRefreshAt,
  monthlyCreditAllowance: subscription.monthlyCreditAllowance,
  currentPeriodStart: subscription.currentPeriodStart,
  currentPeriodEnd: subscription.currentPeriodEnd,
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  hasActiveSubscription: isSubscriptionActive(subscription),
  hasBillingAccount: Boolean(subscription.stripeCustomerId),
});

const syncStripeSubscription = async stripeSubscription => {
  const priceId = getSubscriptionPriceId(stripeSubscription);
  const plan = getBillingPlanByPriceId(priceId) ||
    getBillingPlan(stripeSubscription.metadata?.planKey);
  const customerId = typeof stripeSubscription.customer === 'string'
    ? stripeSubscription.customer
    : stripeSubscription.customer?.id;
  const metadataUserId = stripeSubscription.metadata?.userId;

  let existing = await Subscription.findOne({
    $or: [
      { stripeSubscriptionId: stripeSubscription.id },
      ...(customerId ? [{ stripeCustomerId: customerId }] : []),
    ],
  });

  if (!existing && metadataUserId && mongoose.isValidObjectId(metadataUserId)) {
    existing = await Subscription.findOne({ userId: metadataUserId });
  }
  if (!existing && metadataUserId && mongoose.isValidObjectId(metadataUserId)) {
    existing = new Subscription({ userId: metadataUserId });
  }
  if (!existing) {
    console.error(`Stripe subscription ${stripeSubscription.id} has no matching RoamPilot user.`);
    return null;
  }

  const period = getSubscriptionPeriod(stripeSubscription);
  existing.planKey = plan?.key || existing.planKey;
  existing.status = stripeStatus(stripeSubscription.status);
  existing.monthlyCreditAllowance = plan?.monthlyCredits || existing.monthlyCreditAllowance;
  existing.stripeCustomerId = customerId || existing.stripeCustomerId;
  existing.stripeSubscriptionId = stripeSubscription.id;
  existing.stripePriceId = priceId || existing.stripePriceId;
  existing.currentPeriodStart = period.start || existing.currentPeriodStart;
  existing.currentPeriodEnd = period.end || existing.currentPeriodEnd;
  existing.cancelAtPeriodEnd = Boolean(stripeSubscription.cancel_at_period_end);
  await existing.save();
  return existing;
};

const grantInvoiceCredits = async invoice => {
  if (!['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason)) return;

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const stripeSubscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const synced = await syncStripeSubscription(stripeSubscription);
  if (!synced || synced.status !== 'active') return;

  const plan = getBillingPlanByPriceId(getSubscriptionPriceId(stripeSubscription)) ||
    getBillingPlan(synced.planKey);
  if (!plan) return;

  const updated = await Subscription.findOneAndUpdate(
    { _id: synced._id, processedPaymentIds: { $ne: invoice.id } },
    {
      $inc: { creditBalance: plan.monthlyCredits },
      $push: { processedPaymentIds: invoice.id },
      $set: {
        monthlyCreditAllowance: plan.monthlyCredits,
        planKey: plan.key,
      },
    },
    { new: true },
  );
  if (!updated) return;

  try {
    await CreditTransaction.create({
      userId: updated.userId,
      subscriptionId: updated._id,
      type: 'subscription_grant',
      amount: plan.monthlyCredits,
      balanceAfter: updated.creditBalance + (updated.weeklyFreeCreditBalance || 0),
      action: 'monthly_credit_grant',
      description: `${plan.name} monthly credit grant`,
      idempotencyKey: `invoice:${invoice.id}`,
      metadata: { invoiceId: invoice.id, stripeSubscriptionId: subscriptionId },
    });
  } catch (error) {
    console.error('Could not write monthly credit grant ledger entry:', error.message);
  }
};

export const getBillingSummary = asyncHandler(async (req, res) => {
  const subscription = await getOrCreateSubscription(req.user._id);
  const transactions = await CreditTransaction.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(25)
    .select('type amount balanceAfter action description createdAt')
    .lean();

  res.json(new ApiResponse(200, {
    subscription: serializeSubscription(subscription),
    transactions,
    creditCosts: AI_CREDIT_COSTS,
    stripeConfigured: isStripeConfigured(),
    creditExempt: isCreditExemptUser(req.user),
  }));
});

export const getPlans = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, getPublicBillingPlans()));
});

export const createCheckoutSession = asyncHandler(async (req, res) => {
  if (isCreditExemptUser(req.user)) {
    throw new ApiError(400, 'This administrator account already has unlimited AI access.');
  }
  const plan = getBillingPlan(req.body.planKey);
  if (!plan) throw new ApiError(400, 'Invalid subscription plan');
  if (!plan.stripePriceId) {
    throw new ApiError(503, `${plan.name} checkout is not configured yet.`);
  }

  const subscription = await getOrCreateSubscription(req.user._id);
  if (isSubscriptionActive(subscription) || subscription.status === 'incomplete') {
    throw new ApiError(409, 'You already have a subscription. Use Manage billing to change it.');
  }

  const stripe = getStripe();
  let customerId = subscription.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      name: req.user.name,
      metadata: { userId: String(req.user._id) },
    });
    customerId = customer.id;
    subscription.stripeCustomerId = customerId;
    await subscription.save();
  }

  const clientUrl = getClientUrl();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: String(req.user._id),
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${clientUrl}/billing?checkout=success`,
    cancel_url: `${clientUrl}/billing?checkout=cancelled`,
    subscription_data: {
      metadata: {
        userId: String(req.user._id),
        planKey: plan.key,
      },
    },
    metadata: {
      userId: String(req.user._id),
      planKey: plan.key,
    },
  });

  res.json(new ApiResponse(200, { url: session.url }));
});

export const createPortalSession = asyncHandler(async (req, res) => {
  const subscription = await getOrCreateSubscription(req.user._id);
  if (!subscription.stripeCustomerId) {
    throw new ApiError(400, 'No billing account exists for this user.');
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${getClientUrl()}/billing`,
  });
  res.json(new ApiResponse(200, { url: session.url }));
});

export const stripeWebhook = async (req, res) => {
  let event;
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).send('Stripe webhook secret is not configured.');
    }
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    return res.status(400).send(`Webhook signature verification failed: ${error.message}`);
  }

  try {
    const object = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = object.metadata?.userId || object.client_reference_id;
        if (userId && mongoose.isValidObjectId(userId)) {
          await Subscription.findOneAndUpdate(
            { userId },
            {
              $set: {
                stripeCustomerId: typeof object.customer === 'string' ? object.customer : object.customer?.id,
                stripeSubscriptionId: typeof object.subscription === 'string'
                  ? object.subscription
                  : object.subscription?.id,
                planKey: object.metadata?.planKey || 'none',
              },
            },
            { upsert: true, setDefaultsOnInsert: true },
          );
        }
        break;
      }
      case 'invoice.paid':
        await grantInvoiceCredits(object);
        break;
      case 'invoice.payment_failed': {
        const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
        if (customerId) {
          await Subscription.findOneAndUpdate(
            { stripeCustomerId: customerId },
            { $set: { status: 'past_due' } },
          );
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncStripeSubscription(object);
        break;
      default:
        break;
    }
    return res.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook ${event.id} failed:`, error);
    return res.status(500).json({ received: false });
  }
};
