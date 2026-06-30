import mongoose from 'mongoose';

const cardImageSchema = new mongoose.Schema({
  placeName: { type: String, required: true },
  imageUrl: { type: String, required: true },
  imageAttribution: { type: String, default: null },
  imagePageUrl: { type: String, default: null },
}, { _id: false });

const tripSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  origin: { type: String, default: '' },
  destination: { type: String, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  travelers: { type: Number, min: 1, default: 1 },
  budget: { type: Number, min: 0, default: 0 },
  budgetMode: {
    type: String,
    enum: ['ai-managed', 'budget-friendly', 'balanced', 'premium', 'luxury', 'hard-budget'],
    default: function budgetModeDefault() {
      return Number(this.budget) > 0 ? 'hard-budget' : 'ai-managed';
    },
  },
  currency: { type: String, default: 'INR' },
  travelStyle: { type: String, default: 'balanced' },
  planningMode: { type: String, default: 'Hidden Gems' },
  mustVisitPlaces: [String],
  avoidList: [String],
  notes: { type: String, default: '' },
  status: { type: String, enum: ['planning', 'confirmed', 'ongoing', 'completed', 'cancelled'], default: 'planning' },
  aiPlan: { type: mongoose.Schema.Types.Mixed, default: null },
  aiPlanV2: { type: mongoose.Schema.Types.Mixed, default: null },
  planVersion: { type: Number, default: 1 },
  lastGeneratedAt: { type: Date },
  cardImages: { type: [cardImageSchema], default: [] },
  cardImageSignature: { type: String, default: '' },
}, { timestamps: true });

tripSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Trip', tripSchema);
