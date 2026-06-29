import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { createShare, getPublicShare, deactivateShare } from '../controllers/shareController.js';

const router = express.Router();
router.get('/public/:shareId', getPublicShare);
router.use(protect);
router.post('/:tripId', createShare);
router.delete('/:shareId', deactivateShare);
export default router;