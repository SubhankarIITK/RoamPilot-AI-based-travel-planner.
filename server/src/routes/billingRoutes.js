import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  createPaymentOrder,
  getBillingSummary,
  getPlans,
  verifyPayment,
} from '../controllers/billingController.js';
import { validate } from '../middlewares/validateRequest.js';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
} from '../schemas/billingSchemas.js';

const router = express.Router();

router.get('/plans', getPlans);
router.use(protect);
router.get('/summary', getBillingSummary);
router.post('/order', validate(createPaymentOrderSchema), createPaymentOrder);
router.post('/verify', validate(verifyPaymentSchema), verifyPayment);

export default router;
