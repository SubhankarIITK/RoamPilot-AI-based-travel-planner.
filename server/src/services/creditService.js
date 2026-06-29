import { randomUUID } from 'node:crypto';
import Subscription from '../models/Subscription.js';
import CreditTransaction from '../models/CreditTransaction.js';
import {
  getWeeklyFreeCreditAllowance,
  WEEKLY_FREE_CREDIT_INTERVAL_MS,
} from '../config/billingPlans.js';

const getSpendableBalance = (subscription, now = new Date()) =>
  (subscription?.weeklyFreeCreditBalance || 0) +
  (isSubscriptionActive(subscription, now) ? subscription.creditBalance || 0 : 0);

const refreshWeeklyFreeCredits = async (userId, now = new Date()) => {
  const allowance = getWeeklyFreeCreditAllowance();
  const nextRefreshAt = new Date(now.getTime() + WEEKLY_FREE_CREDIT_INTERVAL_MS);

  return Subscription.findOneAndUpdate(
    {
      userId,
      $or: [
        { weeklyFreeCreditsRefreshAt: { $lte: now } },
        { weeklyFreeCreditsRefreshAt: null },
        { weeklyFreeCreditsRefreshAt: { $exists: false } },
      ],
    },
    {
      $set: {
        weeklyFreeCreditBalance: allowance,
        weeklyFreeCreditsRefreshAt: nextRefreshAt,
      },
    },
    { new: true },
  );
};

export const getOrCreateSubscription = async userId => {
  const now = new Date();
  let subscription = await Subscription.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        weeklyFreeCreditBalance: getWeeklyFreeCreditAllowance(),
        weeklyFreeCreditsRefreshAt: new Date(now.getTime() + WEEKLY_FREE_CREDIT_INTERVAL_MS),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const refreshed = await refreshWeeklyFreeCredits(userId, now);
  if (refreshed) subscription = refreshed;
  return subscription;
};

export const isSubscriptionActive = (subscription, now = new Date()) =>
  subscription?.status === 'active' &&
  subscription.currentPeriodEnd instanceof Date &&
  subscription.currentPeriodEnd > now;

export const consumeCredits = async ({ userId, action, cost }) => {
  const chargeId = randomUUID();
  const now = new Date();
  await getOrCreateSubscription(userId);

  let chargeSource = 'paid';
  let subscription = await Subscription.findOneAndUpdate(
    {
      userId,
      status: 'active',
      currentPeriodEnd: { $gt: now },
      creditBalance: { $gte: cost },
    },
    { $inc: { creditBalance: -cost } },
    { new: true },
  );

  if (!subscription) {
    chargeSource = 'weekly_free';
    subscription = await Subscription.findOneAndUpdate(
      {
        userId,
        weeklyFreeCreditBalance: { $gte: cost },
      },
      { $inc: { weeklyFreeCreditBalance: -cost } },
      { new: true },
    );
  }

  if (!subscription) {
    const current = await getOrCreateSubscription(userId);
    return {
      charged: false,
      subscription: current,
      spendableBalance: getSpendableBalance(current, now),
      reason: 'insufficient_credits',
    };
  }

  const balanceAfter = getSpendableBalance(subscription, now);
  try {
    await CreditTransaction.create({
      userId,
      subscriptionId: subscription._id,
      type: 'usage',
      amount: -cost,
      balanceAfter,
      action,
      description: `${action} AI usage (${chargeSource === 'weekly_free' ? 'weekly free' : 'paid'} credits)`,
      idempotencyKey: `usage:${chargeId}`,
      metadata: { chargeSource },
    });
  } catch (error) {
    console.error('Could not write credit usage ledger entry:', error.message);
  }

  return { charged: true, subscription, chargeId, chargeSource, balanceAfter };
};

export const refundCredits = async ({
  userId,
  chargeId,
  chargeSource,
  action,
  cost,
  reason,
}) => {
  const balanceField = chargeSource === 'weekly_free'
    ? 'weeklyFreeCreditBalance'
    : 'creditBalance';
  const subscription = await Subscription.findOneAndUpdate(
    { userId, refundedChargeIds: { $ne: chargeId } },
    {
      $inc: { [balanceField]: cost },
      $push: { refundedChargeIds: chargeId },
    },
    { new: true },
  );

  if (!subscription) return null;

  const balanceAfter = getSpendableBalance(subscription);
  try {
    await CreditTransaction.create({
      userId,
      subscriptionId: subscription._id,
      type: 'refund',
      amount: cost,
      balanceAfter,
      action,
      description: reason || `Refund for failed ${action}`,
      idempotencyKey: `refund:${chargeId}`,
      metadata: { chargeSource },
    });
  } catch (error) {
    console.error('Could not write credit refund ledger entry:', error.message);
  }

  return { subscription, balanceAfter };
};
