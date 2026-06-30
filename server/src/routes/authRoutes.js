import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  signup,
  verifyEmail,
  resendVerification,
  login,
  requestPasswordReset,
  resetPassword,
  logout,
  getMe,
  updateMe,
} from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateRequest.js';
import {
  emailOtpRequestSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from '../schemas/authSchemas.js';

const router = express.Router();
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    success: false,
    message: 'Too many verification-code requests. Try again later.',
  }),
});
const otpCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    success: false,
    message: 'Too many verification attempts. Try again later.',
  }),
});
router.post('/signup', validate(signupSchema), signup);
router.post('/verify-email', otpCheckLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', otpRequestLimiter, validate(emailOtpRequestSchema), resendVerification);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', otpRequestLimiter, validate(emailOtpRequestSchema), requestPasswordReset);
router.post('/reset-password', otpCheckLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
export default router;
