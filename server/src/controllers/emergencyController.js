import EmergencyInfo from '../models/EmergencyInfo.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import getOwnedTrip from '../utils/getOwnedTrip.js';

export const getEmergencyInfo = asyncHandler(async (req, res) => {
  const info = await EmergencyInfo.findOne({ tripId: req.params.tripId, userId: req.user._id });
  res.json(new ApiResponse(200, info || null));
});

export const saveEmergencyInfo = asyncHandler(async (req, res) => {
  await getOwnedTrip(req.body.tripId, req.user._id);
  const { userId, ...infoData } = req.body;
  const info = await EmergencyInfo.findOneAndUpdate(
    { tripId: req.body.tripId, userId: req.user._id },
    { ...infoData, userId: req.user._id },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(new ApiResponse(200, info, 'Emergency info saved'));
});
