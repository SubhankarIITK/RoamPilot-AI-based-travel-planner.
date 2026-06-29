import SharedTrip from '../models/SharedTrip.js';
import Trip from '../models/Trip.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createShare = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  const allowedSections = req.body.allowedSections || ['overview', 'itinerary', 'budget'];
  let share = await SharedTrip.findOne({ tripId: req.params.tripId, userId: req.user._id });
  if (!share) {
    share = await SharedTrip.create({
      tripId: req.params.tripId,
      userId: req.user._id,
      allowedSections,
    });
  } else {
    share.allowedSections = allowedSections;
    share.isActive = true;
    await share.save();
  }

  res.json(new ApiResponse(200, share, 'Share link created'));
});

export const getPublicShare = asyncHandler(async (req, res) => {
  const share = await SharedTrip.findOne({ shareId: req.params.shareId, isActive: true }).populate('tripId');
  if (!share) throw new ApiError(404, 'Share link not found or inactive');

  const sourceTrip = share.tripId;
  const allowed = new Set(share.allowedSections);
  const trip = {
    _id: sourceTrip._id,
    title: sourceTrip.title,
    destination: sourceTrip.destination,
    startDate: sourceTrip.startDate,
    endDate: sourceTrip.endDate,
    travelers: sourceTrip.travelers,
    currency: sourceTrip.currency,
    aiPlan: {},
  };

  if (allowed.has('overview')) {
    trip.origin = sourceTrip.origin;
    trip.planningMode = sourceTrip.planningMode;
    trip.aiPlan.summary = sourceTrip.aiPlan?.summary;
    trip.aiPlan.tripTitle = sourceTrip.aiPlan?.tripTitle;
  }
  if (allowed.has('itinerary')) {
    trip.aiPlan.dayWiseItinerary = sourceTrip.aiPlan?.dayWiseItinerary;
  }
  if (allowed.has('budget')) {
    trip.budget = sourceTrip.budget;
    trip.aiPlan.budgetBreakdown = sourceTrip.aiPlan?.budgetBreakdown;
  }
  if (allowed.has('packing')) {
    trip.aiPlan.packingList = sourceTrip.aiPlan?.packingList;
  }
  if (allowed.has('safety')) {
    trip.aiPlan.safetyTips = sourceTrip.aiPlan?.safetyTips;
    trip.aiPlan.emergencyCard = sourceTrip.aiPlan?.emergencyCard;
  }

  res.json(new ApiResponse(200, {
    share: {
      shareId: share.shareId,
      allowedSections: share.allowedSections,
      createdAt: share.createdAt,
    },
    trip,
  }));
});

export const deactivateShare = asyncHandler(async (req, res) => {
  const share = await SharedTrip.findOneAndUpdate(
    { shareId: req.params.shareId, userId: req.user._id },
    { isActive: false },
    { new: true }
  );
  if (!share) throw new ApiError(404, 'Share not found');
  res.json(new ApiResponse(200, null, 'Share deactivated'));
});
