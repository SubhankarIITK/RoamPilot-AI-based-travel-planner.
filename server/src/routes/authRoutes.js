import express from 'express';
import { signup, login, getMe, updateMe } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.post('/signup', signup);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
export default router;
