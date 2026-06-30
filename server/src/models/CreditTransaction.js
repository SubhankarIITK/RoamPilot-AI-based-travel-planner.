import mongoose from 'mongoose';

const creditTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['subscription_grant', 'usage', 'refund', 'admin_adjustment'],
    required: true,
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['reserved', 'completed', 'refunded'],
    default: 'completed',
    index: true,
  },
  action: { type: String, default: '' },
  description: { type: String, default: '' },
  idempotencyKey: { type: String, required: true, unique: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

creditTransactionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('CreditTransaction', creditTransactionSchema);
