import mongoose from 'mongoose';

const researchCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true, index: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
    index: true,
  },
  destination: { type: String, required: true },
  content: { type: String, required: true },
  brief: { type: String, default: '' },
  evidence: { type: mongoose.Schema.Types.Mixed, default: null },
  toolsUsed: { type: Number, min: 0, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default mongoose.model('ResearchCache', researchCacheSchema);
