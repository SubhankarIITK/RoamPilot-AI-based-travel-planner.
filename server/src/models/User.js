import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const otpStateSchema = new mongoose.Schema({
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  // Existing accounts predate verification and must remain usable.
  isEmailVerified: { type: Boolean, default: true },
  emailVerification: { type: otpStateSchema, select: false, default: undefined },
  passwordReset: { type: otpStateSchema, select: false, default: undefined },
  passwordChangedAt: { type: Date, select: false, default: undefined },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model('User', userSchema);
