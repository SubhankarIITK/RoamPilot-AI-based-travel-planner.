import { AI_CREDIT_COSTS } from '../config/billingPlans.js';
import { consumeCredits, refundCredits } from '../services/creditService.js';
import { isCreditExemptUser } from '../config/creditAccess.js';

export const requireCredits = action => async (req, res, next) => {
  const cost = AI_CREDIT_COSTS[action];
  if (!Number.isInteger(cost) || cost <= 0) {
    return res.status(500).json({
      success: false,
      message: 'AI credit cost is not configured for this operation.',
    });
  }

  if (isCreditExemptUser(req.user)) {
    req.creditCharge = {
      action,
      cost: 0,
      chargeSource: 'admin_exempt',
      exempt: true,
    };
    res.set('X-Credit-Exempt', 'true');
    return next();
  }

  try {
    const result = await consumeCredits({ userId: req.user._id, action, cost });
    if (!result.charged) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: `This action needs ${cost} credits, but your spendable balance is ${result.spendableBalance}.`,
        requiredCredits: cost,
        creditBalance: result.spendableBalance,
        billingPath: '/billing',
      });
    }

    let refunded = false;
    const refund = async reason => {
      if (refunded) return;
      refunded = true;
      const refundResult = await refundCredits({
        userId: req.user._id,
        chargeId: result.chargeId,
        chargeSource: result.chargeSource,
        action,
        cost,
        reason,
      });
      if (refundResult && !res.headersSent) {
        res.set('X-Credit-Balance', String(refundResult.balanceAfter));
      }
    };

    req.creditCharge = {
      action,
      cost,
      chargeId: result.chargeId,
      chargeSource: result.chargeSource,
      balanceAfter: result.balanceAfter,
    };
    req.refundCredits = refund;
    res.set('X-Credit-Balance', String(result.balanceAfter));
    res.set('X-Credit-Cost', String(cost));

    res.on('finish', () => {
      if (res.statusCode >= 400) {
        refund(`Automatic refund after HTTP ${res.statusCode}`).catch(error => {
          console.error('Automatic credit refund failed:', error.message);
        });
      }
    });

    next();
  } catch (error) {
    next(error);
  }
};
