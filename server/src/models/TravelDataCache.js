import mongoose from 'mongoose';

const travelDataCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true, index: true },
  provider: { type: String, required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default mongoose.model('TravelDataCache', travelDataCacheSchema);
