import TravelProfile from '../models/TravelProfile.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getProfile = asyncHandler(async (req, res) => {
  let profile = await TravelProfile.findOne({ userId: req.user._id });
  if (!profile) profile = await TravelProfile.create({ userId: req.user._id });
  res.json(new ApiResponse(200, profile));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const profile = await TravelProfile.findOneAndUpdate(
    { userId: req.user._id },
    { ...req.body, userId: req.user._id },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(new ApiResponse(200, profile, 'Profile updated'));
});