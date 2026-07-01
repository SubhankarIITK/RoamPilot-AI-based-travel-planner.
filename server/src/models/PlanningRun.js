import mongoose from 'mongoose';

const planningStepSchema = new mongoose.Schema({
  key: { type: String, required: true },
  agent: { type: String, required: true },
  status: {
    type: String,
    enum: ['running', 'completed', 'skipped', 'failed'],
    required: true,
  },
  message: { type: String, required: true },
  detail: { type: String, default: '' },
  occurredAt: { type: Date, default: Date.now },
}, { _id: false });

const planningBatchSchema = new mongoose.Schema({
  key: { type: String, required: true },
  startDay: { type: Number, required: true },
  endDay: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'repaired'],
    default: 'pending',
  },
  attempts: { type: Number, min: 0, default: 0 },
  days: { type: [mongoose.Schema.Types.Mixed], default: [] },
  error: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const planningRunSchema = new mongoose.Schema({
  workflowId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed'],
    default: 'running',
    index: true,
  },
  currentAgent: { type: String, default: 'Coordinator' },
  steps: { type: [planningStepSchema], default: [] },
  modelCalls: { type: Number, min: 0, default: 0 },
  error: { type: String, default: '' },
  resumeKey: { type: String, default: '', index: true },
  resumedFrom: { type: String, default: '' },
  totalDays: { type: Number, min: 0, default: 0 },
  foundation: { type: mongoose.Schema.Types.Mixed, default: null },
  batches: { type: [planningBatchSchema], default: [] },
  partialItinerary: { type: [mongoose.Schema.Types.Mixed], default: [] },
  draftUpdatedAt: { type: Date, default: null },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    index: { expires: 0 },
  },
}, { timestamps: true });

planningRunSchema.index({ userId: 1, tripId: 1, status: 1, updatedAt: -1 });
planningRunSchema.index({ userId: 1, tripId: 1, resumeKey: 1, updatedAt: -1 });

export default mongoose.model('PlanningRun', planningRunSchema);
