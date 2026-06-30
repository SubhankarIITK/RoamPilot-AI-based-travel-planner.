import mongoose from 'mongoose';

const imageCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true, index: true },
  url: { type: String, default: null },
  source: {
    type: String,
    enum: ['pexels', 'none'],
    required: true,
  },
  attributionText: { type: String, default: null },
  pageUrl: { type: String, default: null },
  failureReason: {
    type: String,
    enum: ['not_found'],
    default: null,
  },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default mongoose.model('ImageCache', imageCacheSchema);
