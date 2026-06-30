import { randomUUID } from 'node:crypto';
import Subscription from '../models/Subscription.js';
import CreditTransaction from '../models/CreditTransaction.js';
import {
  AI_CREDIT_COSTS,
  getWeeklyFreeCreditAllowance,
  WEEKLY_FREE_CREDIT_INTERVAL_MS,
} from '../config/billingPlans.js';
import logger from './logger.js';

const CURRENT_WEEKLY_ALLOWANCE_VERSION = 2;

export const getSpendableBalance = subscription =>
  (subscription?.weeklyFreeCreditBalance || 0) +
  (subscription?.creditBalance || 0);

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
        weeklyAllowanceVersion: CURRENT_WEEKLY_ALLOWANCE_VERSION,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const upgraded = await Subscription.findOneAndUpdate(
    {
      userId,
      $or: [
        { weeklyAllowanceVersion: { $lt: CURRENT_WEEKLY_ALLOWANCE_VERSION } },
        { weeklyAllowanceVersion: { $exists: false } },
      ],
    },
    {
      $set: {
        weeklyFreeCreditBalance: getWeeklyFreeCreditAllowance(),
        weeklyFreeCreditsRefreshAt: new Date(now.getTime() + WEEKLY_FREE_CREDIT_INTERVAL_MS),
        weeklyAllowanceVersion: CURRENT_WEEKLY_ALLOWANCE_VERSION,
      },
    },
    { new: true },
  );
  if (upgraded) subscription = upgraded;

  const refreshed = await refreshWeeklyFreeCredits(userId, now);
  if (refreshed) subscription = refreshed;
  return subscription;
};

export const consumeCredits = async ({ userId, action, cost }) => {
  const chargeId = randomUUID();
  await getOrCreateSubscription(userId);

  let chargeSource = 'weekly_free';
  let subscription = await Subscription.findOneAndUpdate(
    {
      userId,
      weeklyFreeCreditBalance: { $gte: cost },
    },
    { $inc: { weeklyFreeCreditBalance: -cost } },
    { new: true },
  );

  if (!subscription) {
    chargeSource = 'paid';
    subscription = await Subscription.findOneAndUpdate(
      {
        userId,
        creditBalance: { $gte: cost },
      },
      { $inc: { creditBalance: -cost } },
      { new: true },
    );
  }

  if (!subscription) {
    const current = await getOrCreateSubscription(userId);
    return {
      charged: false,
      subscription: current,
      spendableBalance: getSpendableBalance(current),
      reason: 'insufficient_credits',
    };
  }

  const balanceAfter = getSpendableBalance(subscription);
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

export const reserveCredits = async (userId, action, reservationId) => {
  const existing = await CreditTransaction.findOne({
    idempotencyKey: reservationId,
  }).lean();
  if (existing) return { alreadyReserved: true };

  const cost = AI_CREDIT_COSTS[action];
  if (!Number.isInteger(cost) || cost <= 0) {
    throw new Error(`Credit cost is not configured for ${action}`);
  }

  await getOrCreateSubscription(userId);
  let chargeSource = 'weekly_free';
  let subscription = await Subscription.findOneAndUpdate(
    {
      userId,
      weeklyFreeCreditBalance: { $gte: cost },
    },
    { $inc: { weeklyFreeCreditBalance: -cost } },
    { new: true },
  );

  if (!subscription) {
    chargeSource = 'paid';
    subscription = await Subscription.findOneAndUpdate(
      { userId, creditBalance: { $gte: cost } },
      { $inc: { creditBalance: -cost } },
      { new: true },
    );
  }

  if (!subscription) {
    const current = await getOrCreateSubscription(userId);
    return {
      reserved: false,
      subscription: current,
      spendableBalance: getSpendableBalance(current),
      reason: 'insufficient_credits',
    };
  }

  const balanceAfter = getSpendableBalance(subscription);
  try {
    await CreditTransaction.create({
      userId,
      subscriptionId: subscription._id,
      type: 'usage',
      amount: -cost,
      balanceAfter,
      status: 'reserved',
      action,
      description: `${action} AI credit reservation`,
      idempotencyKey: reservationId,
      metadata: { chargeSource },
    });
  } catch (error) {
    const balanceField = chargeSource === 'weekly_free'
      ? 'weeklyFreeCreditBalance'
      : 'creditBalance';
    await Subscription.updateOne(
      { _id: subscription._id },
      { $inc: { [balanceField]: cost } },
    );
    if (error?.code === 11000) return { alreadyReserved: true };
    throw error;
  }

  return {
    reserved: true,
    creditsCharged: cost,
    subscription,
    chargeSource,
    balanceAfter,
  };
};

export const settleCredits = async (reservationId, outcome) => {
  if (!['charge', 'refund'].includes(outcome)) {
    throw new Error('Credit settlement outcome must be charge or refund');
  }

  if (outcome === 'charge') {
    const transaction = await CreditTransaction.findOneAndUpdate(
      { idempotencyKey: reservationId, status: 'reserved' },
      { $set: { status: 'completed' } },
      { new: true },
    );
    if (!transaction) {
      logger.warn(
        { stage: 'credit-settlement', reservationId, outcome },
        'Reserved credit transaction was not found',
      );
      return { notFound: true };
    }
    return { settled: true, outcome };
  }

  const transaction = await CreditTransaction.findOneAndUpdate(
    { idempotencyKey: reservationId, status: 'reserved' },
    { $set: { status: 'refunded', type: 'refund' } },
    { new: true },
  );
  if (!transaction) {
    logger.warn(
      { stage: 'credit-settlement', reservationId, outcome },
      'Reserved credit transaction was not found',
    );
    return { notFound: true };
  }

  const chargeSource = transaction.metadata?.chargeSource || 'paid';
  const balanceField = chargeSource === 'weekly_free'
    ? 'weeklyFreeCreditBalance'
    : 'creditBalance';
  const credits = Math.abs(Number(transaction.amount) || 0);
  const subscription = await Subscription.findByIdAndUpdate(
    transaction.subscriptionId,
    { $inc: { [balanceField]: credits } },
    { new: true },
  );
  const balanceAfter = getSpendableBalance(subscription);
  await CreditTransaction.updateOne(
    { _id: transaction._id },
    {
      $set: {
        balanceAfter,
        description: `Refunded ${transaction.action} AI credit reservation`,
      },
    },
  );

  return { settled: true, outcome, balanceAfter };
};
