import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getNotifications, markRead } from '../controllers/notificationController.js';

const router = express.Router();
router.use(protect);
router.get('/', getNotifications);
router.put('/:id/read', markRead);
export default router;