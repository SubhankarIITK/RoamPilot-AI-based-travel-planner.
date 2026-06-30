import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import ApiError from '../utils/ApiError.js';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

const stateField = purpose => {
  if (purpose === 'verify-email') return 'emailVerification';
  if (purpose === 'reset-password') return 'passwordReset';
  throw new Error('Unsupported OTP purpose');
};

const otpSecret = () => {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new ApiError(503, 'Email verification is not configured.');
  }
  return secret;
};

export const hashOtp = ({ email, purpose, code }) =>
  createHmac('sha256', otpSecret())
    .update(`${purpose}:${String(email).toLowerCase()}:${code}`)
    .digest('hex');

export const getOtpCooldownSeconds = (user, purpose, now = Date.now()) => {
  const state = user?.[stateField(purpose)];
  if (!state?.lastSentAt) return 0;
  const elapsed = now - new Date(state.lastSentAt).getTime();
  return Math.max(0, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000));
};

export const issueOtp = async (user, purpose, { ignoreCooldown = false } = {}) => {
  const field = stateField(purpose);
  const cooldownSeconds = getOtpCooldownSeconds(user, purpose);
  if (!ignoreCooldown && cooldownSeconds > 0) {
    throw new ApiError(
      429,
      `Please wait ${cooldownSeconds} seconds before requesting another code.`,
    );
  }

  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  user[field] = {
    codeHash: hashOtp({ email: user.email, purpose, code }),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    attempts: 0,
    lastSentAt: now,
  };
  await user.save();
  return { code, expiresAt: user[field].expiresAt };
};

export const consumeOtp = async (user, purpose, submittedCode) => {
  const field = stateField(purpose);
  const state = user?.[field];
  if (!state?.codeHash || !state?.expiresAt) {
    throw new ApiError(400, 'Request a new verification code.');
  }
  if (new Date(state.expiresAt).getTime() <= Date.now()) {
    user[field] = undefined;
    await user.save();
    throw new ApiError(400, 'This verification code has expired. Request a new one.');
  }
  if (Number(state.attempts) >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, 'Too many incorrect attempts. Request a new code.');
  }

  const submittedHash = hashOtp({
    email: user.email,
    purpose,
    code: String(submittedCode || ''),
  });
  const expected = Buffer.from(state.codeHash, 'hex');
  const actual = Buffer.from(submittedHash, 'hex');
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    state.attempts = Number(state.attempts) + 1;
    await user.save();
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - state.attempts);
    throw new ApiError(
      remaining > 0 ? 400 : 429,
      remaining > 0
        ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
        : 'Too many incorrect attempts. Request a new code.',
    );
  }

  user[field] = undefined;
};
