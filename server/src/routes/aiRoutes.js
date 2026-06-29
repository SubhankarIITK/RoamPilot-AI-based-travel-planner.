import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireCredits } from '../middlewares/creditMiddleware.js';
import {
  planTrip, chatTrip, getChatHistory, regenerateDay,
  optimizeBudget, createPackingList, safetyGuide,
  transformTrip, scoreTrip, researchTrip,
  getPlanningQuestions,
  getPlanningProgress,
} from '../controllers/aiController.js';

const router = express.Router();
router.use(protect);
router.post('/plan-trip', requireCredits('planTrip'), planTrip);
router.get('/plan-progress/:workflowId', getPlanningProgress);
router.post('/planning-questions', getPlanningQuestions);
router.post('/chat-trip', requireCredits('chatTrip'), chatTrip);
router.get('/chat-history/:tripId', getChatHistory);
router.post('/regenerate-day', requireCredits('regenerateDay'), regenerateDay);
router.post('/optimize-budget', requireCredits('optimizeBudget'), optimizeBudget);
router.post('/create-packing-list', requireCredits('createPackingList'), createPackingList);
router.post('/safety-guide', requireCredits('safetyGuide'), safetyGuide);
router.post('/transform-trip', requireCredits('transformTrip'), transformTrip);
router.post('/score-trip', scoreTrip);
router.post('/research-trip', requireCredits('researchTrip'), researchTrip);
export default router;
