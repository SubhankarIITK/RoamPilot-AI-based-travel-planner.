import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getEmergencyInfo, saveEmergencyInfo } from '../controllers/emergencyController.js';

const router = express.Router();
router.use(protect);
router.get('/trip/:tripId', getEmergencyInfo);
router.post('/', saveEmergencyInfo);
export default router;