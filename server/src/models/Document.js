import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String, default: 'image' },
  cloudinaryPublicId: { type: String, default: '' },
  cloudinaryResourceType: { type: String, default: 'image' },
  category: { type: String, default: 'other' },
  notes: { type: String, default: '' },
  originalName: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('Document', documentSchema);
