import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { saveMemory, getMyMemories, getTripMemory } from '../controllers/memoryController.js';

const router = express.Router();
router.use(protect);
router.post('/', saveMemory);
router.get('/me', getMyMemories);
router.get('/trip/:tripId', getTripMemory);
export default router;
