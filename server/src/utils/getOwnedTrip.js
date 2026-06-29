import Trip from '../models/Trip.js';
import ApiError from './ApiError.js';

const getOwnedTrip = async (tripId, userId) => {
  const trip = await Trip.findOne({ _id: tripId, userId });
  if (!trip) throw new ApiError(404, 'Trip not found');
  return trip;
};

export default getOwnedTrip;
