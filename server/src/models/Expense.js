import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  title: { type: String, required: true },
  category: { type: String, default: 'other' },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'INR' },
  paidBy: { type: String, default: '' },
  splitBetween: [String],
  date: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('Expense', expenseSchema);
