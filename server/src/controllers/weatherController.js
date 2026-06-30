import Trip from '../models/Trip.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getTripWeather } from '../services/weatherService.js';

export const getTripCurrentWeather = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).select('destination');
  if (!trip) throw new ApiError(404, 'Trip not found');

  const weather = await getTripWeather(trip.destination);
  if (!weather) {
    res.json(new ApiResponse(200, {
      available: false,
      destination: trip.destination,
    }, 'Weather is temporarily unavailable'));
    return;
  }

  res.json(new ApiResponse(200, {
    available: true,
    destination: trip.destination,
    weather,
  }, 'Weather loaded'));
});
