import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  title: { type: String, required: true },
  category: { type: String, default: 'general' },
  isDone: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  source: { type: String, default: 'manual' },
  dueDate: { type: Date },
}, { timestamps: true });

export default mongoose.model('ChecklistItem', checklistItemSchema);