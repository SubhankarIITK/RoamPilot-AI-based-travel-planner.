import mongoose from 'mongoose';

const planningJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'done', 'failed', 'cancelled'],
    default: 'pending',
  },
  checkpointStage: { type: String, default: null },
  checkpointData: { type: mongoose.Schema.Types.Mixed, default: null },
  creditReservationId: { type: String, required: true },
  creditSettled: { type: Boolean, default: false },
  workerAttempts: { type: Number, default: 0 },
  lastError: { type: String, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

planningJobSchema.index({ jobId: 1 });
planningJobSchema.index({ userId: 1, tripId: 1 });
planningJobSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('PlanningJob', planningJobSchema);
