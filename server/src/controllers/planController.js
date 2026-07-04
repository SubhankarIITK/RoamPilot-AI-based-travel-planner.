import Trip from '../models/Trip.js';
import TravelProfile from '../models/TravelProfile.js';
import ChecklistItem from '../models/ChecklistItem.js';
import PlanningRun from '../models/PlanningRun.js';
import LazyPlan from '../models/LazyPlan.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildPlanningInterview } from '../services/planningInterviewService.js';
import {
  estimateTripBudget,
  normalizeBudgetPlan,
} from '../services/budgetEngine.js';
import { migratePlanV1ToV2 } from '../services/planMigration.js';
import { reconcileStalePlanningRun } from '../services/planningProgressService.js';
import { callAI, isAIAvailable } from '../services/aiService.js';
import { saveResearchBrief } from '../services/researchCacheService.js';
import {
  buildBookingResearchFallback,
  buildBookingResearchMessages,
  normalizeBookingResearchMarkdown,
} from '../prompts/bookingResearchPrompt.js';
import logger from '../services/logger.js';
import {
  addLegacyPeriods,
  executePlanTrip,
  getPlanTokenBudget,
  getTripDays,
  requestJson,
  researchTripOnline,
  saveVersion,
} from '../services/planHelpers.js';

const syncPlanV2 = trip => {
  trip.aiPlanV2 = migratePlanV1ToV2(trip.aiPlan);
  trip.planVersion = 2;
  trip.markModified('aiPlanV2');
};

const ensureNoUnfinishedLazyPlan = async (tripId, userId, action) => {
  const draft = await LazyPlan.exists({
    tripId,
    userId,
    status: { $ne: 'completed' },
  });
  if (draft) {
    throw new ApiError(
      409,
      `Finalize the day-wise plan before ${action}. Use the single-day repair controls while it is still a draft.`,
    );
  }
};

export const planTrip = asyncHandler(executePlanTrip);

export const getPlanningQuestions = asyncHandler(async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  const profile = await TravelProfile.findOne({ userId: req.user._id });
  const interview = buildPlanningInterview(trip, profile);
  res.json(new ApiResponse(200, interview, 'Planning questions ready'));
});

export const getPlanningProgress = asyncHandler(async (req, res) => {
  let run = await PlanningRun.findOne({
    workflowId: req.params.workflowId,
    userId: req.user._id,
  })
    .select(
      'workflowId tripId status currentAgent steps modelCalls error totalDays ' +
      'batches partialItinerary resumedFrom draftUpdatedAt createdAt updatedAt',
    )
    .lean();
  if (!run) throw new ApiError(404, 'Planning workflow not found');
  run = await reconcileStalePlanningRun(run);
  run.partialItinerary = (run.partialItinerary || []).map(day => ({
    day: day.day,
    date: day.date,
    theme: day.theme,
    scheduleCount: day.schedule?.length || 0,
    mealCount: day.meals?.length || 0,
  }));
  res.json(new ApiResponse(200, run));
});

export const getLatestTripPlanningProgress = asyncHandler(async (req, res) => {
  const lazyPlan = await LazyPlan.findOne({
    tripId: req.params.tripId,
    userId: req.user._id,
  }).select('status days.day days.status updatedAt').lean();
  if (lazyPlan) {
    const generatingDay = lazyPlan.days?.find(day => day.status === 'generating');
    const running = lazyPlan.status === 'foundation_generating' || Boolean(generatingDay);
    const repairRequired =
      lazyPlan.status === 'failed' ||
      lazyPlan.status === 'repair_required' ||
      lazyPlan.days?.some(day => ['failed', 'needs_repair'].includes(day.status));
    if (running || repairRequired) {
      return res.json(new ApiResponse(200, {
        workflowId: `lazy-${lazyPlan._id}`,
        tripId: req.params.tripId,
        status: running ? 'running' : 'failed',
        currentAgent: generatingDay
          ? `Day ${generatingDay.day} Architect`
          : lazyPlan.status === 'foundation_generating'
            ? 'Planning Foundation'
            : 'Targeted Day Repair',
        steps: [],
        modelCalls: 0,
        totalDays: lazyPlan.days?.length || 0,
        partialItinerary: [],
        updatedAt: lazyPlan.updatedAt,
        lazyGeneration: true,
      }));
    }
    throw new ApiError(404, 'No active planning workflow found');
  }
  let run = await PlanningRun.findOne({
    tripId: req.params.tripId,
    userId: req.user._id,
    expiresAt: { $gt: new Date() },
  })
    .sort({ updatedAt: -1 })
    .select(
      'workflowId tripId status currentAgent steps modelCalls error totalDays ' +
      'batches partialItinerary resumedFrom draftUpdatedAt createdAt updatedAt',
    )
    .lean();
  run = await reconcileStalePlanningRun(run);
  if (!run || run.status === 'completed') {
    throw new ApiError(404, 'No active planning workflow found');
  }
  run.partialItinerary = (run.partialItinerary || []).map(day => ({
    day: day.day,
    date: day.date,
    theme: day.theme,
    scheduleCount: day.schedule?.length || 0,
    mealCount: day.meals?.length || 0,
  }));
  res.json(new ApiResponse(200, run));
});

export const regenerateDay = asyncHandler(async (req, res) => {
  const { tripId, dayNumber, instruction } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip || !trip.aiPlan) throw new ApiError(404, 'Trip or plan not found');
  await ensureNoUnfinishedLazyPlan(trip._id, req.user._id, 'using legacy day regeneration');

  const parsedDayNumber = Number(dayNumber);
  const itinerary = trip.aiPlan.dayWiseItinerary;
  if (!Number.isInteger(parsedDayNumber) || parsedDayNumber < 1 ||
      parsedDayNumber > (itinerary?.length || 0)) {
    throw new ApiError(400, 'Invalid itinerary day number');
  }

  const currentDay = itinerary[parsedDayNumber - 1];
  const prompt = `You are a travel planner. Regenerate day ${parsedDayNumber} of this trip to ${trip.destination}.
Current day: ${JSON.stringify(currentDay)}
Instruction: ${instruction || 'Improve this day'}
Return ONLY a detailed JSON object for this day with:
{day, date, theme, summary, schedule:[{time,duration,activity,location,details,travelTime,transport,estimatedCost,bookingRequired,bookingAdvice}], meals:[{meal,time,placeOrArea,suggestion,estimatedCost}], dailyBudget:{activities,food,localTransport,total}, rainyDayAlternative, localTip, paceNotes}.
Use 4-6 chronological schedule entries with realistic travel time and specific details.`;
  const updatedDay = await requestJson(prompt, { max_tokens: 1200, temperature: 0.55 });
  updatedDay.day = parsedDayNumber;
  addLegacyPeriods({ dayWiseItinerary: [updatedDay] });

  trip.aiPlan.dayWiseItinerary[parsedDayNumber - 1] = updatedDay;
  trip.markModified('aiPlan');
  syncPlanV2(trip);
  await trip.save();
  await saveVersion(req.user._id, trip._id, trip.aiPlan, `day-${parsedDayNumber}-regenerated`);

  res.json(new ApiResponse(200, { updatedDay, trip }));
});

export const optimizeBudget = asyncHandler(async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip || !trip.aiPlan) throw new ApiError(404, 'Trip or plan not found');
  await ensureNoUnfinishedLazyPlan(trip._id, req.user._id, 'optimizing the final budget');

  const estimate = estimateTripBudget(trip, {
    comfort_level: trip.budgetMode === 'hard-budget' ? 'Budget' : trip.budgetMode,
    optimization_goal: 'Cheapest',
    hotelTier: trip.hotelTier,
    transportMode: trip.transportMode,
    foodStyle: trip.foodStyle,
  });
  const normalized = normalizeBudgetPlan(
    { warnings: trip.aiPlan.warnings || [] },
    trip,
    estimate,
  );

  trip.aiPlan.budgetBreakdown = normalized.budgetBreakdown;
  trip.aiPlan.budgetSummary = normalized.budgetSummary;
  trip.aiPlan.warnings = normalized.warnings;
  trip.markModified('aiPlan');
  syncPlanV2(trip);
  await trip.save();
  await saveVersion(req.user._id, trip._id, trip.aiPlan, 'budget-optimized');

  res.json(new ApiResponse(200, {
    budgetBreakdown: normalized.budgetBreakdown,
    budgetSummary: normalized.budgetSummary,
    trip,
  }, 'Budget optimized'));
});

export const createPackingList = asyncHandler(async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  const prompt = `Create a smart packing list for a trip to ${trip.destination} for ${trip.travelers} person(s), ${trip.travelStyle} style. Consider the itinerary and user notes: ${JSON.stringify({
    itinerary: trip.aiPlan?.dayWiseItinerary?.map(day => day.theme),
    notes: trip.notes,
  })}. Return ONLY a JSON object: {"packingList": [{ "category": "string", "items": ["string"] }]}`;
  const result = await requestJson(prompt, { max_tokens: 900, temperature: 0.4 });
  const packingList = Array.isArray(result) ? result : result.packingList;
  if (!Array.isArray(packingList)) throw new ApiError(502, 'AI returned an invalid packing list');

  if (packingList.length > 0) {
    await ChecklistItem.deleteMany({ tripId, userId: req.user._id, source: 'ai-packing' });
    const items = packingList.flatMap(category => (category.items || []).map(title => ({
      userId: req.user._id,
      tripId,
      title,
      category: category.category?.toLowerCase() || 'general',
      source: 'ai-packing',
    })));
    await ChecklistItem.insertMany(items);
  }
  res.json(new ApiResponse(200, packingList));
});

export const safetyGuide = asyncHandler(async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');
  await ensureNoUnfinishedLazyPlan(trip._id, req.user._id, 'saving a final safety guide');

  const prompt = `Give a safety guide for traveling to ${trip.destination}. Include verified general guidance, scam warnings, areas requiring extra caution, emergency numbers, local rules, and cultural etiquette. Return ONLY JSON: {"safetyTips": [], "emergencyNumbers": {}, "culturalTips": [], "scamWarnings": [], "localRules": []}`;
  const guide = await requestJson(prompt, { max_tokens: 1200, temperature: 0.3 });
  trip.aiPlan = trip.aiPlan || {};
  trip.aiPlan.safetyTips = guide.safetyTips || [];
  trip.aiPlan.emergencyCard = {
    destination: trip.destination,
    ...(guide.emergencyNumbers || {}),
    embassyTip: guide.culturalTips?.[0] || '',
  };
  trip.markModified('aiPlan');
  syncPlanV2(trip);
  await trip.save();
  res.json(new ApiResponse(200, guide));
});

export const transformTrip = asyncHandler(async (req, res) => {
  const { tripId, transformation } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip || !trip.aiPlan) throw new ApiError(404, 'Trip or plan not found');
  await ensureNoUnfinishedLazyPlan(trip._id, req.user._id, 'transforming the complete itinerary');

  const transforms = {
    cheaper: 'Make the entire trip more budget-friendly without compromising experience quality.',
    relaxed: 'Reduce the pace, add more rest time, fewer activities per day.',
    adventurous: 'Add adventurous and outdoor activities, remove overly touristy spots.',
    'hidden-gems': 'Replace mainstream attractions with local, off-the-beaten-path hidden gems.',
    'reduce-walking': 'Minimize walking distances, use more transport between spots.',
    'food-focus': 'Make the trip more food-centric with local culinary experiences.',
    'family-friendly': 'Make the trip suitable for families with children.',
    romantic: 'Transform the trip into a romantic couple experience.',
    'rainy-safe': 'Rework the itinerary for rainy weather with indoor alternatives.',
  };
  const instruction = transforms[transformation];
  if (!instruction) throw new ApiError(400, 'Invalid trip transformation');

  const prompt = `You are a travel planner. Transform this trip plan: ${instruction}
Current complete plan: ${JSON.stringify(trip.aiPlan)}
Return the COMPLETE updated trip plan JSON with all original fields but transformed. Same JSON structure as before.`;
  const itineraryDays = trip.aiPlan.dayWiseItinerary?.length || getTripDays(trip);
  const newPlan = addLegacyPeriods(await requestJson(prompt, {
    max_tokens: getPlanTokenBudget(itineraryDays),
    temperature: 0.45,
    retryPrompt: `${prompt}

RETRY COMPACTLY: Keep all fields and exactly ${itineraryDays} itinerary days, but use short
activity names, no prose paragraphs, at most 2 items per period, and at most 2 tips per day.`,
  }));
  if (!Array.isArray(newPlan.dayWiseItinerary) ||
      newPlan.dayWiseItinerary.length !== itineraryDays) {
    throw new ApiError(502, 'AI returned an incomplete transformed plan');
  }

  trip.aiPlan = newPlan;
  trip.markModified('aiPlan');
  syncPlanV2(trip);
  await trip.save();
  await saveVersion(req.user._id, trip._id, newPlan, `transform-${transformation}`);
  res.json(new ApiResponse(200, { trip, plan: newPlan }));
});

export const scoreTrip = asyncHandler(async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip || !trip.aiPlan) throw new ApiError(404, 'Trip or plan not found');
  res.json(new ApiResponse(200, trip.aiPlan.tripScore || {}));
});

export const researchTrip = asyncHandler(async (req, res) => {
  const { tripId, focus = 'current travel options and practical planning' } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  try {
    const result = await researchTripOnline(trip, focus, { userId: req.user._id });
    let content = result.brief || '';
    let synthesizedByAI = Boolean(content);
    if (!content && isAIAvailable()) {
      try {
        content = await callAI(
          buildBookingResearchMessages(trip, focus, result),
          {
            model: process.env.GROQ_AGENT_MODEL ||
              process.env.GROQ_PLANNER_MODEL,
            max_tokens: 1100,
            temperature: 0.2,
          },
        );
        synthesizedByAI = true;
      } catch (error) {
        logger.warn(
          { stage: 'booking-research-synthesis', error: error.message },
          'Booking research synthesis unavailable; using structured fallback',
        );
      }
    }
    if (!content) content = buildBookingResearchFallback(trip, focus, result);
    content = normalizeBookingResearchMarkdown(content);
    if (synthesizedByAI && !result.brief) {
      await saveResearchBrief({
        userId: req.user._id,
        trip,
        focus,
        brief: content,
      }).catch(error => logger.warn(
        { stage: 'booking-research-brief-cache', error: error.message },
        'Could not cache booking research brief',
      ));
    }
    res.json(new ApiResponse(200, {
      content,
      toolsUsed: result.executedTools.length,
      cacheHit: result.cacheHit,
      briefCacheHit: Boolean(result.brief),
      synthesizedByAI,
      providers: (result.providerUsage || [])
        .filter(provider => provider.status === 'used')
        .map(provider => provider.label),
      sources: (result.sources || []).filter(source => source?.url).slice(0, 10),
    }, 'Live web research completed'));
  } catch (error) {
    logger.error({ stage: 'trip-research', error: error.message }, 'Trip web research failed');
    throw new ApiError(502, 'Live travel research is temporarily unavailable.');
  }
});
