import express from 'express';
import {
  createTrip,
  parseTripDescription,
  getTrips,
  getTripById,
  updateTrip,
  deleteTrip,
} from '../controllers/tripController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireCredits } from '../middlewares/creditMiddleware.js';

const router = express.Router();
router.use(protect);
router.post('/parse-description', requireCredits('parseTripDescription'), parseTripDescription);
router.post('/', createTrip);
router.get('/', getTrips);
router.get('/:id', getTripById);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);
export default router;
