import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getTripChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem } from '../controllers/checklistController.js';

const router = express.Router();
router.use(protect);
router.get('/trip/:tripId', getTripChecklist);
router.post('/', addChecklistItem);
router.put('/:id/toggle', toggleChecklistItem);
router.delete('/:id', deleteChecklistItem);
export default router;