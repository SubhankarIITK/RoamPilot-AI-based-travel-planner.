import mongoose from 'mongoose';

const paymentOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  provider: {
    type: String,
    enum: ['razorpay'],
    default: 'razorpay',
  },
  packKey: { type: String, required: true },
  credits: { type: Number, min: 1, required: true },
  amountPaise: { type: Number, min: 100, required: true },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  receipt: { type: String, required: true, unique: true },
  providerOrderId: { type: String, required: true, unique: true, index: true },
  providerPaymentId: { type: String, default: undefined },
  status: {
    type: String,
    enum: ['created', 'paid', 'failed'],
    default: 'created',
    index: true,
  },
  creditsGranted: { type: Boolean, default: false },
  paidAt: { type: Date, default: null },
  failureReason: { type: String, default: '' },
  processedWebhookEventIds: { type: [String], default: [] },
}, { timestamps: true });

paymentOrderSchema.index(
  { providerPaymentId: 1 },
  { unique: true, sparse: true },
);
paymentOrderSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('PaymentOrder', paymentOrderSchema);
