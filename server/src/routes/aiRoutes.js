import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/authMiddleware.js';
import { requireCredits } from '../middlewares/creditMiddleware.js';
import { validate } from '../middlewares/validateRequest.js';
import {
  chatSchema,
  planTripSchema,
  regenerateDaySchema,
  transformTripSchema,
} from '../schemas/planSchemas.js';
import {
  planTrip, regenerateDay,
  optimizeBudget, createPackingList, safetyGuide,
  transformTrip, scoreTrip, researchTrip,
  getPlanningQuestions,
  getPlanningProgress,
} from '../controllers/planController.js';
import { chatTrip, getChatHistory } from '../controllers/chatController.js';
import { transcribeSpeech } from '../controllers/transcriptionController.js';
import { uploadSpeechAudio } from '../config/speechUpload.js';

const router = express.Router();
const speechRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    success: false,
    code: 'VOICE_RATE_LIMITED',
    message: 'Voice transcription was requested too frequently. Wait briefly and try again.',
  }),
});
router.use(protect);
router.post(
  '/transcribe',
  speechRateLimiter,
  requireCredits('transcribeSpeech'),
  uploadSpeechAudio,
  transcribeSpeech,
);
router.post('/plan-trip', validate(planTripSchema), requireCredits('planTrip'), planTrip);
router.get('/plan-progress/:workflowId', getPlanningProgress);
router.post('/planning-questions', getPlanningQuestions);
router.post('/chat-trip', validate(chatSchema), requireCredits('chatTrip'), chatTrip);
router.get('/chat-history/:tripId', getChatHistory);
router.post('/regenerate-day', validate(regenerateDaySchema), requireCredits('regenerateDay'), regenerateDay);
router.post('/optimize-budget', requireCredits('optimizeBudget'), optimizeBudget);
router.post('/create-packing-list', requireCredits('createPackingList'), createPackingList);
router.post('/safety-guide', requireCredits('safetyGuide'), safetyGuide);
router.post('/transform-trip', validate(transformTripSchema), requireCredits('transformTrip'), transformTrip);
router.post('/score-trip', scoreTrip);
router.post('/research-trip', requireCredits('researchTrip'), researchTrip);
export default router;
