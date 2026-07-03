import LazyPlan from '../models/LazyPlan.js';
import Trip from '../models/Trip.js';
import TravelProfile from '../models/TravelProfile.js';
import TripMemory from '../models/TripMemory.js';
import { runPlannerGraph } from '../agents/graph.js';
import {
  getTripDays,
  requestJson,
  requestPlannerSection,
  researchTripOnline,
  saveVersion,
} from '../services/planHelpers.js';
import {
  LAZY_ARCHITECTURE_VERSION,
  LAZY_DAY_PROMPT_VERSION,
  LAZY_FOUNDATION_PROMPT_VERSION,
  assembleLazyPlan,
  buildDaySkeletons,
  buildLazyPlanShell,
  createLazyInputSignature,
  generateLazyDayDetail,
  getLazyPlanStatus,
  serializeLazyPlan,
} from '../services/lazyPlannerService.js';
import { migratePlanV1ToV2 } from '../services/planMigration.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const normalizeAnswers = answers =>
  answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};

const saveTripShell = async (trip, lazyPlan) => {
  trip.aiPlan = buildLazyPlanShell({ trip, lazyPlan });
  trip.aiPlanV2 = migratePlanV1ToV2(trip.aiPlan);
  trip.planVersion = 2;
  trip.lastGeneratedAt = new Date();
  trip.markModified('aiPlan');
  trip.markModified('aiPlanV2');
  await trip.save();
};

const findOwnedTrip = (tripId, userId) =>
  Trip.findOne({ _id: tripId, userId });

export const initializeLazyPlan = asyncHandler(async (req, res) => {
  const {
    tripId,
    instructions = '',
    planningAnswers = {},
    useWebSearch = true,
  } = req.body;
  const trip = await findOwnedTrip(tripId, req.user._id);
  if (!trip) throw new ApiError(404, 'Trip not found');

  const normalizedOptions = {
    instructions: String(instructions || '').trim().slice(0, 700),
    planningAnswers: normalizeAnswers(planningAnswers),
    useWebSearch: useWebSearch !== false,
  };
  const inputSignature = createLazyInputSignature({ trip, ...normalizedOptions });
  const existing = await LazyPlan.findOne({ tripId: trip._id, userId: req.user._id });
  if (existing?.inputSignature === inputSignature && existing.foundation) {
    await req.refundCredits?.('Matching lazy foundation already exists.');
    await saveTripShell(trip, existing);
    return res.json(new ApiResponse(200, {
      trip,
      lazyPlan: serializeLazyPlan(existing),
      reused: true,
    }, 'Existing trip foundation reused'));
  }
  if (
    existing?.status === 'foundation_generating' &&
    Date.now() - new Date(existing.updatedAt).getTime() < 3 * 60 * 1000
  ) {
    throw new ApiError(409, 'This trip foundation is already being generated.');
  }
  const previousStatus = existing?.status === 'foundation_generating'
    ? getLazyPlanStatus(existing.days || [])
    : existing?.status || null;
  const markFoundationFailure = message => existing?.foundation
    ? LazyPlan.updateOne(
      { _id: existing._id, userId: req.user._id },
      {
        $set: {
          status: previousStatus,
          lastError: `${message} The previous foundation was retained.`,
        },
      },
    )
    : LazyPlan.updateOne(
      { tripId: trip._id, userId: req.user._id, inputSignature },
      { $set: { status: 'failed', lastError: message } },
    );
  if (!existing || !existing.foundation) {
    await LazyPlan.findOneAndUpdate(
      { tripId: trip._id, userId: req.user._id },
      {
        userId: req.user._id,
        tripId: trip._id,
        status: 'foundation_generating',
        foundation: null,
        factualEvidence: null,
        days: [],
        usedPlaceIds: [],
        validationIssues: [],
        generationOptions: normalizedOptions,
        inputSignature,
        architectureVersion: LAZY_ARCHITECTURE_VERSION,
        promptVersion: LAZY_FOUNDATION_PROMPT_VERSION,
        finalizedPlan: null,
        finalizedAt: null,
        lastError: '',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  let totalDays;
  let workflow;
  try {
    const [profile, memories] = await Promise.all([
      TravelProfile.findOne({ userId: req.user._id }).lean(),
      TripMemory.find({ userId: req.user._id, tripId: { $ne: trip._id } })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
    ]);
    totalDays = getTripDays(trip);
    workflow = await runPlannerGraph({
      trip,
      profile,
      memories,
      options: {
        ...normalizedOptions,
        totalDays,
        foundationOnly: true,
        resumeState: {},
      },
      researchTrip: currentTrip =>
        researchTripOnline(currentTrip, 'route, places, weather, logistics and current costs', {
          userId: req.user._id,
          includeWebSearch: normalizedOptions.useWebSearch,
        }),
      requestJson,
      requestPlannerSection,
      report: async () => {},
      persistFoundation: async () => {},
      persistBatch: async () => {},
    });
  } catch (error) {
    await markFoundationFailure(
      'The trip foundation could not be completed. Retry the foundation.',
    ).catch(() => {});
    throw error;
  }
  if (!workflow.foundation?.strategy || !workflow.foundation?.logistics) {
    await markFoundationFailure(
      'The planner returned an incomplete foundation. Retry the foundation.',
    ).catch(() => {});
    throw new ApiError(502, 'The planner could not create a complete trip foundation.');
  }

  const skeletons = buildDaySkeletons(
    trip,
    workflow.foundation,
    normalizedOptions.planningAnswers,
  );
  if (skeletons.length !== totalDays) {
    await markFoundationFailure(
      'The foundation did not include every requested day. Retry the foundation.',
    ).catch(() => {});
    throw new ApiError(502, 'The planner foundation did not contain every requested day.');
  }
  const lazyPlan = await LazyPlan.findOneAndUpdate(
    { tripId: trip._id, userId: req.user._id },
    {
      userId: req.user._id,
      tripId: trip._id,
      status: 'foundation_ready',
      foundation: workflow.foundation,
      factualEvidence: workflow.foundation.factualEvidence || null,
      days: skeletons.map(skeleton => ({
        day: skeleton.day,
        skeleton,
        detail: null,
        status: 'pending',
        promptVersion: LAZY_DAY_PROMPT_VERSION,
      })),
      usedPlaceIds: [],
      validationIssues: [],
      generationOptions: normalizedOptions,
      inputSignature,
      architectureVersion: LAZY_ARCHITECTURE_VERSION,
      promptVersion: LAZY_FOUNDATION_PROMPT_VERSION,
      finalizedPlan: null,
      finalizedAt: null,
      lastError: '',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await saveTripShell(trip, lazyPlan);
  res.status(201).json(new ApiResponse(201, {
    trip,
    lazyPlan: serializeLazyPlan(lazyPlan),
    reused: false,
  }, 'Trip foundation and day skeletons are ready'));
});

export const getLazyPlan = asyncHandler(async (req, res) => {
  let lazyPlan = await LazyPlan.findOne({
    tripId: req.params.tripId,
    userId: req.user._id,
  });
  if (!lazyPlan) throw new ApiError(404, 'No lazy trip plan exists yet');
  let changed = false;
  const staleBefore = Date.now() - 3 * 60 * 1000;
  if (
    lazyPlan.status === 'foundation_generating' &&
    new Date(lazyPlan.updatedAt).getTime() < staleBefore
  ) {
    lazyPlan.status = lazyPlan.foundation
      ? getLazyPlanStatus(lazyPlan.days)
      : 'failed';
    lazyPlan.lastError = lazyPlan.foundation
      ? 'The replacement foundation stopped early; the previous foundation was retained.'
      : 'Foundation generation stopped before completion. Retry the foundation.';
    changed = true;
  }
  lazyPlan.days.forEach(day => {
    if (day.status === 'generating' && new Date(day.updatedAt).getTime() < staleBefore) {
      day.status = 'failed';
      day.lastError = 'Generation stopped before this day was saved. Retry only this day.';
      day.updatedAt = new Date();
      changed = true;
    }
  });
  if (changed) {
    lazyPlan.status = getLazyPlanStatus(lazyPlan.days);
    lazyPlan.markModified('days');
    lazyPlan = await lazyPlan.save();
  }
  res.json(new ApiResponse(200, serializeLazyPlan(lazyPlan)));
});

const executeDayGeneration = async ({ req, allowCompleted = false }) => {
  const { tripId, dayNumber, instruction = '' } = req.body;
  const trip = await findOwnedTrip(tripId, req.user._id);
  if (!trip) throw new ApiError(404, 'Trip not found');

  const existing = await LazyPlan.findOne({
    tripId: trip._id,
    userId: req.user._id,
  });
  if (!existing) throw new ApiError(404, 'Create the trip foundation first');
  const currentDay = existing.days.find(day => Number(day.day) === Number(dayNumber));
  if (!currentDay) throw new ApiError(400, 'Invalid itinerary day number');
  if (currentDay.status === 'completed' && !allowCompleted) {
    return { trip, lazyPlan: existing, day: currentDay.detail, reused: true };
  }
  if (currentDay.status === 'generating') {
    throw new ApiError(409, `Day ${dayNumber} is already generating`);
  }
  if (allowCompleted && Number(currentDay.repairCount) >= 3) {
    throw new ApiError(
      429,
      `Day ${dayNumber} reached its targeted repair limit. Adjust the trip foundation before trying again.`,
    );
  }
  if (!allowCompleted && Number(currentDay.retryCount) >= 4) {
    throw new ApiError(
      429,
      `Day ${dayNumber} reached its safe retry limit. Use targeted repair instructions instead.`,
    );
  }

  const allowedStatuses = allowCompleted
    ? ['pending', 'failed', 'needs_repair', 'completed']
    : ['pending', 'failed', 'needs_repair'];
  const locked = await LazyPlan.findOneAndUpdate(
    {
      _id: existing._id,
      userId: req.user._id,
      days: { $elemMatch: { day: Number(dayNumber), status: { $in: allowedStatuses } } },
    },
    {
      $set: {
        'days.$.status': 'generating',
        'days.$.lastError': '',
        'days.$.updatedAt': new Date(),
      },
      $inc: { 'days.$.retryCount': 1 },
    },
    { new: true },
  );
  if (!locked) throw new ApiError(409, `Day ${dayNumber} could not acquire a generation lock`);

  try {
    const generated = await generateLazyDayDetail({
      trip,
      lazyPlan: locked,
      dayNumber,
      requestPlannerSection,
      instruction,
    });
    const criticalIssues = generated.issues.filter(issue => issue.severity === 'critical');
    const nextStatus = criticalIssues.length ? 'needs_repair' : 'completed';
    const dayIndex = locked.days.findIndex(day => Number(day.day) === Number(dayNumber));
    locked.days[dayIndex].detail = generated.detail;
    locked.days[dayIndex].status = nextStatus;
    locked.days[dayIndex].validationIssues = generated.issues;
    locked.days[dayIndex].lastError = '';
    locked.days[dayIndex].generatedAt = new Date();
    locked.days[dayIndex].updatedAt = new Date();
    locked.days[dayIndex].version += allowCompleted ? 1 : 0;
    if (allowCompleted) locked.days[dayIndex].repairCount += 1;
    locked.usedPlaceIds = generated.usedPlaceIds;
    locked.status = getLazyPlanStatus(locked.days);
    locked.markModified('days');
    await locked.save();
    await saveTripShell(trip, locked);
    return {
      trip,
      lazyPlan: locked,
      day: generated.detail,
      reused: false,
    };
  } catch (error) {
    await LazyPlan.updateOne(
      { _id: locked._id, userId: req.user._id },
      {
        $set: {
          'days.$[day].status': 'failed',
          'days.$[day].lastError': 'This day could not be generated. Retry only this day.',
          'days.$[day].updatedAt': new Date(),
          status: getLazyPlanStatus(
            locked.days.map(day => Number(day.day) === Number(dayNumber)
              ? { ...day.toObject(), status: 'failed' }
              : day),
          ),
        },
      },
      { arrayFilters: [{ 'day.day': Number(dayNumber) }] },
    );
    throw error;
  }
};

export const generateLazyDay = asyncHandler(async (req, res) => {
  const result = await executeDayGeneration({ req });
  res.json(new ApiResponse(200, {
    trip: result.trip,
    lazyPlan: serializeLazyPlan(result.lazyPlan),
    day: result.day,
    reused: result.reused,
  }, result.reused ? 'Completed day reused' : 'Day generated and saved'));
});

export const repairLazyDay = asyncHandler(async (req, res) => {
  const result = await executeDayGeneration({ req, allowCompleted: true });
  res.json(new ApiResponse(200, {
    trip: result.trip,
    lazyPlan: serializeLazyPlan(result.lazyPlan),
    day: result.day,
  }, 'Day repaired and saved'));
});

export const finalizeLazyPlan = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.body.tripId, req.user._id);
  if (!trip) throw new ApiError(404, 'Trip not found');
  const lazyPlan = await LazyPlan.findOne({ tripId: trip._id, userId: req.user._id });
  if (!lazyPlan) throw new ApiError(404, 'No lazy trip plan exists');
  const missing = lazyPlan.days.filter(day => !day.detail).map(day => day.day);
  if (missing.length) {
    throw new ApiError(409, `Generate the remaining days first: ${missing.join(', ')}`);
  }

  const { plan, qualityIssues, criticalIssues } = assembleLazyPlan({ trip, lazyPlan });
  lazyPlan.validationIssues = criticalIssues.map(message => {
    const mentionedDays = [...message.matchAll(/\bday\s+(\d+)/ig)]
      .map(match => Number(match[1]))
      .filter(Number.isInteger);
    return {
      code: 'global_validation',
      severity: 'critical',
      message,
      day: mentionedDays.at(-1) || null,
    };
  });
  lazyPlan.finalizedPlan = plan;
  if (criticalIssues.length) {
    lazyPlan.status = 'repair_required';
    lazyPlan.validationIssues.forEach(issue => {
      const affectedDay = lazyPlan.days.find(day => Number(day.day) === Number(issue.day));
      if (affectedDay) {
        affectedDay.status = 'needs_repair';
        if (!affectedDay.validationIssues.some(existing => existing.message === issue.message)) {
          affectedDay.validationIssues.push(issue);
        }
      }
    });
    lazyPlan.markModified('days');
    lazyPlan.markModified('validationIssues');
    lazyPlan.markModified('finalizedPlan');
    await lazyPlan.save();
    await saveTripShell(trip, lazyPlan);
    return res.json(new ApiResponse(200, {
      trip,
      lazyPlan: serializeLazyPlan(lazyPlan),
      plan,
      finalized: false,
      qualityIssues,
      criticalIssues,
    }, 'The complete draft is viewable, but targeted day repairs are required'));
  }

  lazyPlan.status = 'completed';
  lazyPlan.finalizedAt = new Date();
  lazyPlan.markModified('finalizedPlan');
  await lazyPlan.save();
  trip.aiPlan = plan;
  trip.aiPlanV2 = migratePlanV1ToV2(plan);
  trip.planVersion = 2;
  trip.lastGeneratedAt = new Date();
  trip.markModified('aiPlan');
  trip.markModified('aiPlanV2');
  await trip.save();
  await saveVersion(req.user._id, trip._id, plan, 'lazy-plan-finalized');
  res.json(new ApiResponse(200, {
    trip,
    lazyPlan: serializeLazyPlan(lazyPlan),
    plan,
    finalized: true,
    qualityIssues,
  }, 'Detailed trip plan finalized'));
});
