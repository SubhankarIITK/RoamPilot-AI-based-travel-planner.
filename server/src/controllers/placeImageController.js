import Trip from '../models/Trip.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildItineraryPlaceGallery } from '../services/itineraryGalleryService.js';
import { isPexelsAvailable } from '../services/pexelsService.js';
import {
  buildTripCardImageSet,
  getTripCardImageSignature,
  selectTripCardPlaces,
} from '../services/tripCardImageService.js';
import logger from '../services/logger.js';

export const getTripPlaceImages = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).select('destination aiPlan aiPlanV2 cardImages');
  if (!trip) throw new ApiError(404, 'Trip not found');

  const plan = trip.aiPlanV2 || trip.aiPlan;
  if (!plan?.dayWiseItinerary) {
    throw new ApiError(404, 'Generate an itinerary before loading place images');
  }

  try {
    const days = await buildItineraryPlaceGallery(plan, trip.destination, {
      seedImages: trip.cardImages || [],
    });
    const totalPlaces = days.reduce((sum, day) => sum + day.places.length, 0);
    const imagesFound = days.reduce(
      (sum, day) => sum + day.places.filter(place => place.imageUrl).length,
      0,
    );
    res.json(new ApiResponse(200, {
      configured: isPexelsAvailable(),
      destination: trip.destination,
      totalPlaces,
      imagesFound,
      days,
    }, 'Itinerary place gallery loaded'));
  } catch (error) {
    logger.error(
      { stage: 'PEXELS_GALLERY', error: error.message },
      'Itinerary place gallery failed safely',
    );
    res.json(new ApiResponse(200, {
      configured: isPexelsAvailable(),
      destination: trip.destination,
      totalPlaces: 0,
      imagesFound: 0,
      days: [],
    }, 'Place images are temporarily unavailable'));
  }
});

const resolveTripCardImages = async (trip, userId) => {
  const plan = trip.aiPlanV2 || trip.aiPlan;
  if (!plan?.dayWiseItinerary) return { tripId: trip._id, images: [] };

  const places = selectTripCardPlaces(plan);
  const signature = getTripCardImageSignature(places, trip.destination);
  if (signature && trip.cardImageSignature === signature && trip.cardImages?.length) {
    return { tripId: trip._id, images: trip.cardImages };
  }

  try {
    const result = await buildTripCardImageSet(plan, trip.destination);
    if (result.images.length) {
      await Trip.updateOne(
        { _id: trip._id, userId },
        {
          $set: {
            cardImages: result.images,
            cardImageSignature: result.signature,
          },
        },
      );
    }
    return { tripId: trip._id, images: result.images };
  } catch (error) {
    logger.warn(
      { stage: 'TRIP_CARD_IMAGES', tripId: trip._id, error: error.message },
      'Trip card images failed safely',
    );
    return { tripId: trip._id, images: trip.cardImages || [] };
  }
};

export const getTripCardImages = asyncHandler(async (req, res) => {
  const tripIds = [...new Set(req.body.tripIds.map(String))].slice(0, 12);
  const trips = await Trip.find({
    _id: { $in: tripIds },
    userId: req.user._id,
  }).select('destination aiPlan aiPlanV2 cardImages cardImageSignature');

  const results = await Promise.all(
    trips.map(trip => resolveTripCardImages(trip, req.user._id)),
  );
  res.json(new ApiResponse(200, { trips: results }, 'Trip card images loaded'));
});
