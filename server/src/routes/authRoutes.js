import express from 'express';
import { signup, login, logout, getMe, updateMe } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateRequest.js';
import { loginSchema, signupSchema } from '../schemas/authSchemas.js';

const router = express.Router();
router.post('/signup', validate(signupSchema), signup);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
export default router;
