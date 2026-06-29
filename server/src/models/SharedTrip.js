import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const sharedTripSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shareId: { type: String, default: uuidv4, unique: true },
  isActive: { type: Boolean, default: true },
  allowedSections: [String],
}, { timestamps: true });

export default mongoose.model('SharedTrip', sharedTripSchema);