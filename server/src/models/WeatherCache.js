import mongoose from 'mongoose';

const weatherCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true, index: true },
  locationQuery: { type: String, required: true },
  provider: { type: String, enum: ['open-meteo'], default: 'open-meteo' },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default mongoose.model('WeatherCache', weatherCacheSchema);
