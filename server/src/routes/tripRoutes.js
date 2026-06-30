import express from 'express';
import {
  createTrip,
  parseTripDescription,
  getTrips,
  getTripById,
  updateTrip,
  deleteTrip,
} from '../controllers/tripController.js';
import {
  getTripCardImages,
  getTripPlaceImages,
} from '../controllers/placeImageController.js';
import { getTripCurrentWeather } from '../controllers/weatherController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireCredits } from '../middlewares/creditMiddleware.js';
import { validate } from '../middlewares/validateRequest.js';
import {
  createTripSchema,
  parseTripDescriptionSchema,
  tripCardImagesSchema,
} from '../schemas/tripSchemas.js';

const router = express.Router();
router.use(protect);
router.post('/parse-description', validate(parseTripDescriptionSchema), requireCredits('parseTripDescription'), parseTripDescription);
router.post('/card-images', validate(tripCardImagesSchema), getTripCardImages);
router.post('/', validate(createTripSchema), createTrip);
router.get('/', getTrips);
router.get('/:id/place-images', getTripPlaceImages);
router.get('/:id/weather', getTripCurrentWeather);
router.get('/:id', getTripById);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);
export default router;
