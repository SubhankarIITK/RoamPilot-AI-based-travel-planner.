import TripMemory from '../models/TripMemory.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import getOwnedTrip from '../utils/getOwnedTrip.js';

export const saveMemory = asyncHandler(async (req, res) => {
  await getOwnedTrip(req.body.tripId, req.user._id);
  const { userId, ...memoryData } = req.body;
  const memory = await TripMemory.findOneAndUpdate(
    { tripId: req.body.tripId, userId: req.user._id },
    { ...memoryData, userId: req.user._id },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(new ApiResponse(200, memory, 'Memory saved'));
});

export const getMyMemories = asyncHandler(async (req, res) => {
  const memories = await TripMemory.find({ userId: req.user._id }).populate('tripId', 'title destination').sort({ createdAt: -1 });
  res.json(new ApiResponse(200, memories));
});

export const getTripMemory = asyncHandler(async (req, res) => {
  await getOwnedTrip(req.params.tripId, req.user._id);
  const memory = await TripMemory.findOne({
    tripId: req.params.tripId,
    userId: req.user._id,
  });
  res.json(new ApiResponse(200, memory || null));
});
