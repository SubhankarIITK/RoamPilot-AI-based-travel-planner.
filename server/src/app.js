import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { errorHandler } from './middlewares/errorMiddleware.js';
import logger from './services/logger.js';
import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import versionRoutes from './routes/versionRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import checklistRoutes from './routes/checklistRoutes.js';
import shareRoutes from './routes/shareRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import memoryRoutes from './routes/memoryRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import { razorpayWebhook } from './controllers/billingController.js';

const app = express();

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(pinoHttp({ logger }));
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const jsonRateLimitHandler = message => (req, res) => {
  const resetTime = req.rateLimit?.resetTime?.getTime?.();
  const retryAfterSeconds = resetTime
    ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
    : undefined;
  res.status(429).json({
    success: false,
    code: 'RATE_LIMITED',
    message,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  });
};

const skipPreflight = req => req.method === 'OPTIONS';
const isPlanningProgressRequest = req =>
  req.path.startsWith('/api/ai/plan-progress/');

// Broad protection must allow normal SPA navigation and must not consume the
// same budget as the planner's intentional progress polling.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: positiveInteger(process.env.API_RATE_LIMIT_MAX, 600),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req =>
    skipPreflight(req) ||
    req.path === '/api/health' ||
    isPlanningProgressRequest(req),
  handler: jsonRateLimitHandler('Too many API requests. Please wait briefly and try again.'),
});
const planningProgressLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: positiveInteger(process.env.PLANNING_PROGRESS_RATE_LIMIT_MAX, 600),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: skipPreflight,
  handler: jsonRateLimitHandler('Planning progress was requested too frequently.'),
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: positiveInteger(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 10),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: skipPreflight,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler('Too many failed login attempts. Please try again later.'),
});
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: positiveInteger(process.env.AUTH_SIGNUP_RATE_LIMIT_MAX, 5),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: skipPreflight,
  handler: jsonRateLimitHandler('Too many signup attempts. Please try again later.'),
});

const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://0.0.0.0:5173',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  exposedHeaders: ['X-Credit-Balance', 'X-Credit-Cost', 'X-Credit-Exempt'],
}));
app.use('/api/ai/plan-progress', planningProgressLimiter);
app.use(globalLimiter);
app.use(cookieParser());
app.post(
  '/api/billing/razorpay/webhook',
  express.raw({ type: 'application/json' }),
  razorpayWebhook,
);

// Documents alone may carry large JSON metadata; every other JSON route stays small.
app.use('/api/documents', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

app.post('/api/auth/login', loginLimiter);
app.post('/api/auth/signup', signupLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/billing', billingRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'RoamPilot' }));

app.use(errorHandler);

export default app;
