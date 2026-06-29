import mongoose from 'mongoose';

const tripVersionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  versionName: { type: String, default: 'Version' },
  source: { type: String, default: 'ai-generated' },
  itinerary: { type: mongoose.Schema.Types.Mixed },
  budgetBreakdown: { type: mongoose.Schema.Types.Mixed },
  fullPlan: { type: mongoose.Schema.Types.Mixed },
  notes: { type: String, default: '' },
  score: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

tripVersionSchema.index({ userId: 1, tripId: 1, createdAt: -1 });

export default mongoose.model('TripVersion', tripVersionSchema);
