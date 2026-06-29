import mongoose from 'mongoose';

const plannerCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  plan: { type: mongoose.Schema.Types.Mixed, required: true },
  webResearchUsed: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

plannerCacheSchema.index({ userId: 1, cacheKey: 1 });

export default mongoose.model('PlannerCache', plannerCacheSchema);
