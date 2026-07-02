import Trip from '../models/Trip.js';
import TripVersion from '../models/TripVersion.js';
import ChatMessage from '../models/ChatMessage.js';
import Document from '../models/Document.js';
import Expense from '../models/Expense.js';
import ChecklistItem from '../models/ChecklistItem.js';
import SharedTrip from '../models/SharedTrip.js';
import EmergencyInfo from '../models/EmergencyInfo.js';
import TripMemory from '../models/TripMemory.js';
import Notification from '../models/Notification.js';
import PlannerCache from '../models/PlannerCache.js';
import PlanningRun from '../models/PlanningRun.js';
import ResearchCache from '../models/ResearchCache.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { deleteCloudinaryAsset } from '../services/cloudinaryService.js';
import { callGroq, isGroqAvailable } from '../services/groqService.js';
import safeJsonParse from '../utils/safeJsonParse.js';
import { migratePlanV1ToV2 } from '../services/planMigration.js';

const allowedTravelStyles = new Set(['relaxed', 'balanced', 'packed']);

export const parseTripDescription = asyncHandler(async (req, res) => {
  const description = req.body.description?.trim();
  if (!description || description.length < 15) {
    throw new ApiError(400, 'Describe your trip in at least 15 characters');
  }
  if (!isGroqAvailable()) throw new ApiError(503, 'AI service is not configured');

  let draft;
  try {
    const raw = await callGroq(
      [
        {
          role: 'system',
          content: `Extract travel details from natural language into JSON.
Do not invent dates, origin, destination, or budget when the user did not provide them.
Use YYYY-MM-DD dates. Use null for missing scalar values and [] for missing lists.
Return only the requested JSON object.`,
        },
        {
          role: 'user',
          content: `Today is ${new Date().toISOString().slice(0, 10)}.
Trip description:
${description.slice(0, 4000)}

Return:
{
  "title": "short trip title or null",
  "origin": "city or null",
  "destination": "city/region/country or null",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "travelers": 1,
  "budget": 0,
  "currency": "INR|USD|EUR|GBP",
  "travelStyle": "relaxed|balanced|packed",
  "planningMode": "AI decides|Budget Saver|Luxury Comfort|Hidden Gems|Foodie|Family Safe|Couple Romantic|Backpacker|Weekend Fast Plan|Slow Travel|Photography|Adventure|Spiritual/Cultural",
  "mustVisitPlaces": [],
  "avoidList": [],
  "notes": "important requirements not represented above"
}`,
        },
      ],
      {
        max_tokens: 700,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      },
    );
    draft = safeJsonParse(raw);
  } catch (error) {
    console.error('Trip description extraction failed:', error.message);
    throw new ApiError(502, 'Could not understand the trip description. Please try again.');
  }

  if (!draft) throw new ApiError(502, 'AI returned invalid trip details');

  const normalized = {
    title: draft.title || '',
    origin: draft.origin || '',
    destination: draft.destination || '',
    startDate: draft.startDate || '',
    endDate: draft.endDate || '',
    travelers: Math.max(1, Number(draft.travelers) || 1),
    budget: Math.max(0, Number(draft.budget) || 0),
    currency: ['INR', 'USD', 'EUR', 'GBP'].includes(draft.currency) ? draft.currency : 'INR',
    travelStyle: allowedTravelStyles.has(draft.travelStyle) ? draft.travelStyle : 'balanced',
    planningMode: draft.planningMode || 'Hidden Gems',
    mustVisitPlaces: Array.isArray(draft.mustVisitPlaces) ? draft.mustVisitPlaces : [],
    avoidList: Array.isArray(draft.avoidList) ? draft.avoidList : [],
    notes: draft.notes || '',
  };

  const missingFields = ['title', 'destination']
    .filter(field => !normalized[field]);

  res.json(new ApiResponse(200, { draft: normalized, missingFields }, 'Trip details extracted'));
});

export const createTrip = asyncHandler(async (req, res) => {
  const { userId, ...tripData } = req.body;
  if (
    tripData.startDate &&
    tripData.endDate &&
    new Date(tripData.endDate) < new Date(tripData.startDate)
  ) {
    throw new ApiError(400, 'End date must be on or after the start date');
  }
  const trip = await Trip.create({ ...tripData, userId: req.user._id });
  await Notification.create({
    userId: req.user._id,
    tripId: trip._id,
    title: 'Trip created',
    message: `${trip.title} is ready for planning.`,
    type: 'trip',
  });
  res.status(201).json(new ApiResponse(201, trip, 'Trip created'));
});

export const getTrips = asyncHandler(async (req, res) => {
  const trips = await Trip.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json(new ApiResponse(200, trips));
});

export const getTripById = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');
  if (!trip.aiPlanV2 && trip.aiPlan) {
    const v2 = migratePlanV1ToV2(trip.aiPlan);
    await Trip.updateOne(
      { _id: trip._id, userId: req.user._id },
      { aiPlanV2: v2, planVersion: 2 },
    );
    trip.aiPlanV2 = v2;
    trip.planVersion = 2;
  }
  res.json(new ApiResponse(200, trip));
});

export const updateTrip = asyncHandler(async (req, res) => {
  const { userId, _id, ...updates } = req.body;
  if (
    updates.startDate &&
    updates.endDate &&
    new Date(updates.endDate) < new Date(updates.startDate)
  ) {
    throw new ApiError(400, 'End date must be on or after the start date');
  }
  const trip = await Trip.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    updates,
    { new: true, runValidators: true }
  );
  if (!trip) throw new ApiError(404, 'Trip not found');
  res.json(new ApiResponse(200, trip, 'Trip updated'));
});

export const deleteTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  const documents = await Document.find({
    tripId: trip._id,
    userId: req.user._id,
  }).select('cloudinaryPublicId cloudinaryResourceType');

  await Promise.allSettled(
    documents.map(document =>
      deleteCloudinaryAsset(document.cloudinaryPublicId, document.cloudinaryResourceType),
    ),
  );

  await Promise.all([
    TripVersion.deleteMany({ tripId: trip._id, userId: req.user._id }),
    ChatMessage.deleteMany({ tripId: trip._id, userId: req.user._id }),
    Document.deleteMany({ tripId: trip._id, userId: req.user._id }),
    Expense.deleteMany({ tripId: trip._id, userId: req.user._id }),
    ChecklistItem.deleteMany({ tripId: trip._id, userId: req.user._id }),
    SharedTrip.deleteMany({ tripId: trip._id, userId: req.user._id }),
    EmergencyInfo.deleteMany({ tripId: trip._id, userId: req.user._id }),
    TripMemory.deleteMany({ tripId: trip._id, userId: req.user._id }),
    Notification.deleteMany({ tripId: trip._id, userId: req.user._id }),
    PlannerCache.deleteMany({ tripId: trip._id, userId: req.user._id }),
    PlanningRun.deleteMany({ tripId: trip._id, userId: req.user._id }),
    ResearchCache.deleteMany({ tripId: trip._id, userId: req.user._id }),
  ]);

  await trip.deleteOne();
  res.json(new ApiResponse(200, null, 'Trip deleted'));
});
