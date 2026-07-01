import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  isEmailConfigured,
  sendOtpEmail,
  sendPasswordChangedEmail,
} from '../services/emailService.js';
import { consumeOtp, issueOtp } from '../services/otpService.js';
import logger from '../services/logger.js';

const getJwtMaxAgeMs = () => {
  const value = String(process.env.JWT_EXPIRES_IN || '7d').trim().toLowerCase();
  const match = value.match(/^(\d+)\s*(ms|s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return Number(match[1]) * multipliers[match[2]];
};

const authCookieOptions = () => {
  const configuredSameSite = String(process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  const sameSite = ['strict', 'lax', 'none'].includes(configuredSameSite)
    ? configuredSameSite
    : 'lax';
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? sameSite : 'strict',
    maxAge: getJwtMaxAgeMs(),
  };
};

const clearAuthCookieOptions = () => {
  const { maxAge, ...options } = authCookieOptions();
  return options;
};

const publicUser = user => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified !== false,
});

const normalizeEmail = email => String(email || '').trim().toLowerCase();

export const isRegisteredVerifiedUser = user =>
  Boolean(user) && user.isEmailVerified !== false;

const requireEmailDelivery = () => {
  if (!isEmailConfigured()) {
    throw new ApiError(
      503,
      'Email verification is not configured. Add the SMTP settings and try again.',
    );
  }
};

const clearOtpAfterDeliveryFailure = async (user, field) => {
  user[field] = undefined;
  await user.save().catch(() => {});
};

export const signup = asyncHandler(async (req, res) => {
  requireEmailDelivery();
  const name = req.body.name?.trim();
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  const existing = await User.findOne({ email }).select('+emailVerification');

  if (isRegisteredVerifiedUser(existing)) {
    throw new ApiError(409, 'Email already registered');
  }

  const user = existing || await User.create({
    name,
    email,
    password,
    isEmailVerified: false,
  });
  const { code } = await issueOtp(user, 'verify-email');
  try {
    await sendOtpEmail({ to: user.email, code, purpose: 'verify-email' });
  } catch (error) {
    logger.error({ stage: 'signup-otp-email', error: error.message }, 'Could not send signup OTP');
    await clearOtpAfterDeliveryFailure(user, 'emailVerification');
    throw new ApiError(503, 'The verification email could not be sent. Check the SMTP settings and try again.');
  }

  res.status(existing ? 200 : 201).json(new ApiResponse(
    existing ? 200 : 201,
    { email: user.email, requiresVerification: true, expiresInSeconds: 600 },
    'Verification code sent. Check your email to finish creating the account.',
  ));
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email }).select('+emailVerification');
  if (!user || user.isEmailVerified !== false) {
    throw new ApiError(400, 'The verification code is invalid or expired.');
  }

  await consumeOtp(user, 'verify-email', req.body.otp);
  user.isEmailVerified = true;
  await user.save();

  const token = generateToken(user._id);
  res.cookie('token', token, authCookieOptions());
  res.json(new ApiResponse(
    200,
    { user: publicUser(user) },
    'Email verified. Your account is ready.',
  ));
});

export const resendVerification = asyncHandler(async (req, res) => {
  requireEmailDelivery();
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email }).select('+emailVerification');
  if (!user || user.isEmailVerified !== false) {
    return res.json(new ApiResponse(
      200,
      null,
      'If this email is awaiting verification, a new code has been sent.',
    ));
  }

  const { code } = await issueOtp(user, 'verify-email');
  try {
    await sendOtpEmail({ to: user.email, code, purpose: 'verify-email' });
  } catch (error) {
    logger.error({ stage: 'resend-verification-email', error: error.message }, 'Could not resend OTP');
    await clearOtpAfterDeliveryFailure(user, 'emailVerification');
    throw new ApiError(503, 'The verification email could not be sent. Try again shortly.');
  }
  res.json(new ApiResponse(200, null, 'A new verification code was sent.'));
});

export const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(req.body.password))) {
    throw new ApiError(401, 'Invalid credentials');
  }
  if (user.isEmailVerified === false) {
    return res.status(403).json({
      success: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Verify your email before signing in.',
      email: user.email,
    });
  }
  const token = generateToken(user._id);
  res.cookie('token', token, authCookieOptions());
  res.json(new ApiResponse(200, { user: publicUser(user) }, 'Login successful'));
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  requireEmailDelivery();
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({
    email,
    isEmailVerified: { $ne: false },
  }).select('+passwordReset');

  if (user) {
    try {
      const { code } = await issueOtp(user, 'reset-password');
      await sendOtpEmail({ to: user.email, code, purpose: 'reset-password' });
    } catch (error) {
      logger.error(
        { stage: 'password-reset-email', error: error.message },
        'Could not send password reset OTP',
      );
      if (error.statusCode !== 429) {
        await clearOtpAfterDeliveryFailure(user, 'passwordReset');
      }
    }
  }

  res.json(new ApiResponse(
    200,
    null,
    'If an eligible account exists for this email, a password reset code has been sent.',
  ));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({
    email,
    isEmailVerified: { $ne: false },
  }).select('+passwordReset');
  if (!user) {
    throw new ApiError(400, 'The verification code is invalid or expired.');
  }

  await consumeOtp(user, 'reset-password', req.body.otp);
  user.password = req.body.password;
  user.passwordChangedAt = new Date();
  await user.save();
  res.clearCookie('token', clearAuthCookieOptions());

  await sendPasswordChangedEmail(user.email).catch(error => logger.error(
    { stage: 'password-changed-email', error: error.message },
    'Could not send password changed notice',
  ));
  res.json(new ApiResponse(
    200,
    null,
    'Password reset complete. Sign in with your new password.',
  ));
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', clearAuthCookieOptions());
  res.json(new ApiResponse(200, null, 'Logout successful'));
});

export const getMe = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, publicUser(req.user)));
});

export const updateMe = asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();
  const email = normalizeEmail(req.body.email);
  if (!name || !email) throw new ApiError(400, 'Name and email are required');
  if (email !== req.user.email) {
    throw new ApiError(400, 'Email changes require verification and are not available from this form.');
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name },
    { new: true, runValidators: true },
  ).select('-password');
  res.json(new ApiResponse(200, publicUser(user), 'Account updated'));
});
