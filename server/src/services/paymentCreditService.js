import Subscription from '../models/Subscription.js';
import CreditTransaction from '../models/CreditTransaction.js';
import PaymentOrder from '../models/PaymentOrder.js';
import {
  getOrCreateSubscription,
  getSpendableBalance,
} from './creditService.js';

export const grantPurchasedCredits = async ({
  order,
  paymentId,
  webhookEventId = '',
}) => {
  await PaymentOrder.updateOne(
    { _id: order._id },
    {
      $set: {
        providerPaymentId: paymentId,
        status: 'paid',
        paidAt: order.paidAt || new Date(),
      },
      ...(webhookEventId
        ? { $addToSet: { processedWebhookEventIds: webhookEventId } }
        : {}),
    },
  );

  const subscription = await getOrCreateSubscription(order.userId);
  const grantKey = `razorpay-order:${order.providerOrderId}`;
  const updated = await Subscription.findOneAndUpdate(
    {
      _id: subscription._id,
      processedPaymentIds: { $ne: grantKey },
    },
    {
      $inc: { creditBalance: order.credits },
      $push: { processedPaymentIds: grantKey },
    },
    { new: true },
  );

  const current = updated || await Subscription.findById(subscription._id);
  if (updated) {
    try {
      await CreditTransaction.create({
        userId: order.userId,
        subscriptionId: current._id,
        type: 'credit_purchase',
        amount: order.credits,
        balanceAfter: getSpendableBalance(current),
        action: 'credit_purchase',
        description: `${order.credits} Razorpay credits purchased`,
        idempotencyKey: grantKey,
        metadata: {
          provider: 'razorpay',
          providerOrderId: order.providerOrderId,
          providerPaymentId: paymentId,
          packKey: order.packKey,
          amountPaise: order.amountPaise,
        },
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  await PaymentOrder.updateOne(
    { _id: order._id },
    { $set: { creditsGranted: true } },
  );
  return {
    alreadyGranted: !updated,
    creditsAdded: order.credits,
    creditBalance: getSpendableBalance(current),
  };
};
