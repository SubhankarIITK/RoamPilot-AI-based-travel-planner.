import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  planKey: {
    type: String,
    enum: ['none', 'explorer', 'navigator', 'voyager'],
    default: 'none',
  },
  status: {
    type: String,
    enum: ['inactive', 'incomplete', 'active', 'past_due', 'canceled', 'unpaid', 'paused'],
    default: 'inactive',
    index: true,
  },
  creditBalance: { type: Number, min: 0, default: 0 },
  monthlyCreditAllowance: { type: Number, min: 0, default: 0 },
  weeklyFreeCreditBalance: { type: Number, min: 0, default: 0 },
  weeklyFreeCreditsRefreshAt: { type: Date, default: null, index: true },
  stripeCustomerId: { type: String, default: undefined },
  stripeSubscriptionId: { type: String, default: undefined },
  stripePriceId: { type: String, default: '' },
  currentPeriodStart: { type: Date, default: null },
  currentPeriodEnd: { type: Date, default: null },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  processedPaymentIds: { type: [String], default: [] },
  refundedChargeIds: { type: [String], default: [] },
}, { timestamps: true });

subscriptionSchema.index({ stripeCustomerId: 1 }, { sparse: true });
subscriptionSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });

export default mongoose.model('Subscription', subscriptionSchema);
