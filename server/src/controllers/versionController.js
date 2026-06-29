import TripVersion from '../models/TripVersion.js';
import Trip from '../models/Trip.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getTripVersions = asyncHandler(async (req, res) => {
  const versions = await TripVersion.find({ tripId: req.params.tripId, userId: req.user._id }).sort({ createdAt: -1 });
  res.json(new ApiResponse(200, versions));
});

export const getVersion = asyncHandler(async (req, res) => {
  const version = await TripVersion.findOne({ _id: req.params.id, userId: req.user._id });
  if (!version) throw new ApiError(404, 'Version not found');
  res.json(new ApiResponse(200, version));
});

export const deleteVersion = asyncHandler(async (req, res) => {
  const version = await TripVersion.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!version) throw new ApiError(404, 'Version not found');
  res.json(new ApiResponse(200, null, 'Version deleted'));
});

export const restoreVersion = asyncHandler(async (req, res) => {
  const version = await TripVersion.findOne({ _id: req.params.id, userId: req.user._id });
  if (!version?.fullPlan) throw new ApiError(404, 'Restorable version not found');

  const trip = await Trip.findOne({ _id: version.tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  if (trip.aiPlan) {
    await TripVersion.create({
      userId: req.user._id,
      tripId: trip._id,
      versionName: `Before restore - ${new Date().toLocaleDateString()}`,
      source: 'pre-restore-backup',
      itinerary: trip.aiPlan.dayWiseItinerary,
      budgetBreakdown: trip.aiPlan.budgetBreakdown,
      fullPlan: trip.aiPlan,
      score: trip.aiPlan.tripScore,
    });
  }

  trip.aiPlan = version.fullPlan;
  trip.markModified('aiPlan');
  await trip.save();

  res.json(new ApiResponse(200, { trip }, 'Trip version restored'));
});
