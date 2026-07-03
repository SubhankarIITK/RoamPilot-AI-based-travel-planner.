import mongoose from 'mongoose';

const validationIssueSchema = new mongoose.Schema({
  code: { type: String, required: true },
  severity: {
    type: String,
    enum: ['warning', 'critical'],
    default: 'warning',
  },
  message: { type: String, required: true },
  day: { type: Number, min: 1, default: null },
  field: { type: String, default: '' },
}, { _id: false });

const lazyDaySchema = new mongoose.Schema({
  day: { type: Number, min: 1, required: true },
  skeleton: { type: mongoose.Schema.Types.Mixed, required: true },
  detail: { type: mongoose.Schema.Types.Mixed, default: null },
  status: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'failed', 'needs_repair'],
    default: 'pending',
  },
  validationIssues: { type: [validationIssueSchema], default: [] },
  retryCount: { type: Number, min: 0, default: 0 },
  repairCount: { type: Number, min: 0, default: 0 },
  version: { type: Number, min: 1, default: 1 },
  promptVersion: { type: String, default: 'lazy-day-v2' },
  lastError: { type: String, default: '' },
  generatedAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const lazyPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: [
      'foundation_generating',
      'foundation_ready',
      'partially_generated',
      'ready_to_finalize',
      'repair_required',
      'completed',
      'failed',
    ],
    default: 'foundation_generating',
  },
  foundation: { type: mongoose.Schema.Types.Mixed, default: null },
  factualEvidence: { type: mongoose.Schema.Types.Mixed, default: null },
  days: { type: [lazyDaySchema], default: [] },
  usedPlaceIds: { type: [String], default: [] },
  validationIssues: { type: [validationIssueSchema], default: [] },
  generationOptions: { type: mongoose.Schema.Types.Mixed, default: {} },
  inputSignature: { type: String, required: true, index: true },
  architectureVersion: { type: Number, default: 2 },
  promptVersion: { type: String, default: 'lazy-foundation-v2' },
  finalizedPlan: { type: mongoose.Schema.Types.Mixed, default: null },
  finalizedAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
}, { timestamps: true });

lazyPlanSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('LazyPlan', lazyPlanSchema);
