import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  createCheckoutSession,
  createPortalSession,
  getBillingSummary,
  getPlans,
} from '../controllers/billingController.js';

const router = express.Router();

router.get('/plans', getPlans);
router.use(protect);
router.get('/summary', getBillingSummary);
router.post('/checkout', createCheckoutSession);
router.post('/portal', createPortalSession);

export default router;
