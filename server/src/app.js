import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorMiddleware.js';

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
import { stripeWebhook } from './controllers/billingController.js';

const app = express();

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
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
