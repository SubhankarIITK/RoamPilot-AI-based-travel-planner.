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
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    index: { expires: 0 },
  },
}, { timestamps: true });

planningRunSchema.index({ userId: 1, tripId: 1, status: 1, updatedAt: -1 });

export default mongoose.model('PlanningRun', planningRunSchema);
