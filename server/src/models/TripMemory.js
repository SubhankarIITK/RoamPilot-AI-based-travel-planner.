import mongoose from 'mongoose';

const tripMemorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  likedPlaces: [String],
  dislikedPlaces: [String],
  preferredPace: { type: String, default: '' },
  preferredFood: [String],
  budgetBehavior: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('TripMemory', tripMemorySchema);