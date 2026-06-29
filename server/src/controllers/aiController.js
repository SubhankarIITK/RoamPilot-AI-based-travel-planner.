import Trip from '../models/Trip.js';
import TravelProfile from '../models/TravelProfile.js';
import TripVersion from '../models/TripVersion.js';
import ChatMessage from '../models/ChatMessage.js';
import ChecklistItem from '../models/ChecklistItem.js';
import Notification from '../models/Notification.js';
import TripMemory from '../models/TripMemory.js';
import PlanningRun from '../models/PlanningRun.js';
import PlannerCache from '../models/PlannerCache.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  callGroq,
  callGroqWebSearch,
  isGroqAvailable,
} from '../services/groqService.js';
import { buildPlanningQuestionsPrompt } from '../prompts/planningQuestionsPrompt.js';
import { buildChatPrompt } from '../prompts/chatPrompt.js';
import safeJsonParse from '../utils/safeJsonParse.js';
import { randomUUID } from 'node:crypto';
import crypto from 'node:crypto';
import { runPlannerGraph } from '../agents/graph.js';
import {
  completePlanningRun,
  createPlanningRun,
  failPlanningRun,
  reportPlanningStep,
} from '../services/planningProgressService.js';

const saveVersion = async (userId, tripId, plan, source) => {
  await TripVersion.create({
    userId,
    tripId,
    versionName: `${source} - ${new Date().toLocaleDateString()}`,
    source,
    itinerary: plan.dayWiseItinerary,
    budgetBreakdown: plan.budgetBreakdown,
    fullPlan: plan,
    score: plan.tripScore,
  });
};

const requireGroq = () => {
  if (!isGroqAvailable()) {
    throw new ApiError(503, 'AI service is not configured. Add GROQ_API_KEY to server/.env.');
  }
};

const LIGHT_AGENT_MODEL = process.env.GROQ_AGENT_MODEL ||
  process.env.GROQ_PLANNER_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';
const HEAVY_ITINERARY_MODEL = process.env.GROQ_ITINERARY_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';

const requestJson = async (prompt, options = {}) => {
  requireGroq();

  const { retryPrompt, ...groqOptions } = options;
  const jsonOptions = {
    response_format: { type: 'json_object' },
    model: LIGHT_AGENT_MODEL,
    max_tokens: 1000,
    ...groqOptions,
  };
  const parseResponse = async (requestPrompt) => {
    const raw = await callGroq(
      [{ role: 'user', content: requestPrompt }],
      jsonOptions,
    );
    const parsed = safeJsonParse(raw);
    if (!parsed) {
      const error = new Error('AI returned invalid JSON');
          error.code = 'AI_INVALID_JSON';
      throw error;
    }
    return parsed;
  };

  try {
    return await parseResponse(prompt);
  } catch (error) {
    const canRetry =
      retryPrompt &&
      error.code === 'AI_INVALID_JSON';

    if (canRetry) {
      console.warn(`Groq JSON request ${error.code}; retrying with compact output.`);
      try {
        return await parseResponse(retryPrompt);
      } catch (retryError) {
        console.error('Groq compact JSON retry failed:', retryError.message);
      }
    } else {
      console.error('Groq JSON request failed:', error.message);
    }

    if (error.code === 'AI_OUTPUT_TRUNCATED') {
      throw new ApiError(
        502,
        'The itinerary was too long to complete. Please shorten the trip or reduce requested detail.',
      );
    }
    throw new ApiError(502, 'AI service failed to generate a valid response. Please try again.');
  }
};

const requestPlannerSection = async (prompt, options = {}) => {
  requireGroq();
  let lastError;
  let activePrompt = prompt;
  let activeMaxTokens = options.max_tokens ?? 1800;
  const compactPrompt = options.compactPrompt || `${prompt}

COMPACT RETRY MODE:
- Return the same JSON schema, but keep the day concise enough to finish.
- Use 4-5 schedule entries, 3 named meals, and short concrete fields.
- Keep details under 35 words, bookingAdvice under 20 words, and sourceUrl empty unless essential.
- Keep openingHours, entryFee, routeDistance, travelTime, transport, estimatedCost, and dailyBudget numeric/concrete.
- Do not include markdown, notes outside JSON, or optional prose.`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await callGroq(
        [{ role: 'user', content: activePrompt }],
        {
          model: options.model || HEAVY_ITINERARY_MODEL,
          max_tokens: activeMaxTokens,
          temperature: options.temperature ?? 0.22,
          response_format: { type: 'json_object' },
        },
      );
      const parsed = safeJsonParse(content);
      if (!parsed) throw new Error('Planner model returned invalid JSON');
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;

      if (error.code === 'AI_OUTPUT_TRUNCATED') {
        activePrompt = compactPrompt;
        activeMaxTokens = Math.min(
          options.truncatedMaxTokens ?? 2600,
          Math.max(activeMaxTokens + 500, 2200),
        );
        await new Promise(resolve => setTimeout(resolve, 750));
        continue;
      }

      if (error.status === 429 || error.code === 429) break;

      if (/empty response|invalid JSON/i.test(error.message || '')) {
        if (attempt === 0) activePrompt = compactPrompt;
        await new Promise(resolve => setTimeout(resolve, 750));
        continue;
      }
      break;
    }
  }

  console.error('Planner section request failed:', lastError?.message);
  if (lastError?.code === 'AI_OUTPUT_TRUNCATED') {
    throw new ApiError(502, 'One itinerary section was too long. Please try generating again.');
  }
  if (lastError?.status === 429 || lastError?.code === 429) {
    throw new ApiError(
      429,
      'Groq is temporarily at its token limit. The planner already waited and retried; please try again shortly.',
    );
  }
  throw new ApiError(502, 'AI could not complete an itinerary section. Please try again.');
};

const getTripDays = (trip) => {
  if (!trip.startDate || !trip.endDate) return 5;
  return Math.max(
    1,
    Math.floor((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1,
  );
};

const getPlanTokenBudget = (days) =>
  Math.min(1200, Math.max(800, 500 + days * 90));

const normalizePlanningAnswers = answers =>
  Object.fromEntries(
    Object.entries(answers || {})
      .slice(0, 10)
      .map(([key, value]) => [
        String(key).slice(0, 80),
        String(value || '').trim().slice(0, 500),
      ])
      .filter(([, value]) => value),
  );

const stablePlanInput = ({ trip, profile, memories, options }) => ({
  version: 4,
  trip: {
    title: trip.title,
    origin: trip.origin || '',
    destination: trip.destination,
    startDate: trip.startDate ? new Date(trip.startDate).toISOString().slice(0, 10) : '',
    endDate: trip.endDate ? new Date(trip.endDate).toISOString().slice(0, 10) : '',
    travelers: trip.travelers,
    budget: trip.budget,
    currency: trip.currency,
    travelStyle: trip.travelStyle,
    planningMode: trip.planningMode,
    mustVisitPlaces: trip.mustVisitPlaces || [],
    avoidList: trip.avoidList || [],
    notes: String(trip.notes || '').slice(0, 700),
  },
  profile: profile ? {
    budgetType: profile.budgetType,
    foodPreference: profile.foodPreference,
    travelPace: profile.travelPace,
    interests: profile.interests || [],
    adventureLevel: profile.adventureLevel,
  } : null,
  memories: memories.map(memory => ({
    likedPlaces: memory.likedPlaces?.slice(0, 4) || [],
    dislikedPlaces: memory.dislikedPlaces?.slice(0, 4) || [],
    preferredPace: memory.preferredPace || '',
    preferredFood: memory.preferredFood?.slice(0, 4) || [],
    notes: String(memory.notes || '').slice(0, 120),
  })),
  options,
});

const buildPlannerCacheKey = input =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');

const cloneJson = value => JSON.parse(JSON.stringify(value));

const addLegacyPeriods = plan => {
  if (!Array.isArray(plan?.dayWiseItinerary)) return plan;
  plan.dayWiseItinerary.forEach(day => {
    if (!Array.isArray(day.schedule)) return;
    const periods = { morning: [], afternoon: [], evening: [], night: [] };
    day.schedule.forEach(item => {
      const hour = Number.parseInt(String(item.time || '').split(':')[0], 10);
      const period = Number.isNaN(hour) || hour < 12
        ? 'morning'
        : hour < 17
          ? 'afternoon'
          : hour < 21
            ? 'evening'
            : 'night';
      periods[period].push(item.activity);
    });
    Object.assign(day, periods, {
      estimatedCost: day.dailyBudget?.total
        ? `${day.dailyBudget.total}`
        : day.estimatedCost || '',
      transportNotes: day.schedule
        .filter(item => item.travelTime || item.transport)
        .map(item => `${item.travelTime || ''} ${item.transport || ''}`.trim())
        .join(' · '),
      foodNotes: day.meals?.map(meal => `${meal.meal}: ${meal.suggestion}`).join(' · ') || '',
      tips: [day.localTip, day.paceNotes].filter(Boolean),
    });
  });
  return plan;
};

export const getPlanningQuestions = asyncHandler(async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  const profile = await TravelProfile.findOne({ userId: req.user._id });
  const fallback = {
    intro: 'A few choices will help me make each day realistic and personal.',
    questions: [
      { id: 'daily_pace', question: 'How full should each day feel?', reason: 'This controls activity count and rest time.', type: 'single_choice', options: ['Relaxed: 2-3 main stops', 'Balanced: 4-5 stops', 'Packed: see as much as possible'], required: true },
      { id: 'top_priority', question: `What matters most in ${trip.destination}?`, reason: 'Your answer determines which experiences get the best time slots.', type: 'single_choice', options: ['Famous highlights', 'Local culture', 'Food experiences', 'Nature and views', 'Hidden gems'], required: true },
      { id: 'food_style', question: 'What type of food plan do you prefer?', reason: 'This shapes restaurants, meal timing, and food budget.', type: 'single_choice', options: ['Local and authentic', 'Mix of local and familiar', 'Vegetarian-friendly', 'Fine dining', 'Budget-friendly'], required: true },
      { id: 'mobility', question: 'What is your walking and transport preference?', reason: 'This prevents tiring or impractical routes.', type: 'single_choice', options: ['Minimal walking', 'Moderate walking', 'Walking is fine', 'Prefer public transport', 'Prefer taxis or private car'], required: true },
      { id: 'special_requirements', question: 'Any special needs, celebrations, fixed bookings, or non-negotiable requests?', reason: 'These constraints need to be placed before the daily route is built.', type: 'text', options: [], required: false },
    ],
  };

  let interview = fallback;
  try {
    const generated = await requestJson(
      buildPlanningQuestionsPrompt(trip, profile),
      { max_tokens: 1000, temperature: 0.35 },
    );
    const questions = Array.isArray(generated.questions)
      ? generated.questions
        .slice(0, 6)
        .filter(question => question?.id && question?.question)
        .map(question => ({
          id: String(question.id).replace(/[^a-z0-9_]/gi, '_').slice(0, 80),
          question: String(question.question).slice(0, 240),
          reason: String(question.reason || '').slice(0, 180),
          type: question.type === 'text' ? 'text' : 'single_choice',
          options: Array.isArray(question.options) ? question.options.slice(0, 5).map(option => String(option).slice(0, 120)) : [],
          required: question.required !== false,
        }))
      : [];
    if (questions.length >= 4) {
      interview = {
        intro: String(generated.intro || fallback.intro).slice(0, 240),
        questions,
      };
    }
  } catch (error) {
    console.error('Planning interview generation failed; using fallback:', error.message);
    await req.refundCredits?.('Planning questions used the built-in fallback instead of AI.');
  }

  res.json(new ApiResponse(200, interview, 'Planning questions ready'));
});

const researchTripOnline = async (trip, focus = 'complete trip planning') => {
  requireGroq();
  const dates = trip.startDate && trip.endDate
    ? `${new Date(trip.startDate).toISOString().slice(0, 10)} to ${new Date(trip.endDate).toISOString().slice(0, 10)}`
    : 'flexible dates';
  const compactTrip = {
    origin: String(trip.origin || 'not specified').slice(0, 160),
    destination: String(trip.destination || '').slice(0, 160),
    travelers: Math.max(1, Number(trip.travelers) || 1),
    budget: `${String(trip.currency || 'INR').slice(0, 8)} ${Number(trip.budget) || 0}`,
    travelStyle: String(trip.travelStyle || '').slice(0, 80),
    planningMode: String(trip.planningMode || '').slice(0, 80),
    notes: String(trip.notes || 'none').slice(0, 500),
  };
  const messages = [
    {
      role: 'system',
      content: `You are RoamPilot's live travel researcher.
Use one web search for current, decision-relevant travel facts and named recommendations.
Return concise Markdown with source links. Separate confirmed facts from estimates.
Never claim that a price or availability is guaranteed. Do not return generic placeholders.`,
    },
    {
      role: 'user',
      content: `Research ${String(focus).slice(0, 160)} for this trip:
Origin: ${compactTrip.origin}
Destination: ${compactTrip.destination}
Dates: ${dates}
Travelers: ${compactTrip.travelers}
Budget: ${compactTrip.budget}
Travel style: ${compactTrip.travelStyle}
Planning mode: ${compactTrip.planningMode}
User notes: ${compactTrip.notes}

Prioritize current closures, transport, stay areas, named attractions and restaurants, weather,
safety, realistic costs, and useful booking or official URLs. Keep it under 450 words.`,
    },
  ];

  try {
    return await callGroqWebSearch(
      messages,
      { max_tokens: 800 },
    );
  } catch (error) {
    const isRequestTooLarge =
      error?.status === 413 ||
      error?.code === 'request_too_large' ||
      /request entity too large|request_too_large/i.test(String(error?.message || ''));
    if (!isRequestTooLarge) throw error;

    console.warn('Groq web research request was too large; retrying with minimal context.');
    return callGroqWebSearch(
      [{
        role: 'user',
        content: `Use one web search. Give concise current travel facts with source URLs for
${compactTrip.destination}, dates ${dates}, from ${compactTrip.origin}, budget ${compactTrip.budget}.
Cover closures, transport, weather, safety, costs, attractions, food, and stay areas. Under 300 words.`,
      }],
      { max_tokens: 600, retries: 0 },
    );
  }
};

export const planTrip = asyncHandler(async (req, res) => {
  const {
    tripId,
    instructions = '',
    useWebSearch = true,
    planningAnswers = {},
    workflowId: requestedWorkflowId,
  } = req.body;
  const workflowId = /^[a-zA-Z0-9-]{16,80}$/.test(String(requestedWorkflowId || ''))
    ? String(requestedWorkflowId)
    : randomUUID();
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  await createPlanningRun({
    workflowId,
    userId: req.user._id,
    tripId: trip._id,
  });

  try {
    const [profile, memories] = await Promise.all([
      TravelProfile.findOne({ userId: req.user._id }),
      TripMemory.find({
        userId: req.user._id,
        tripId: { $ne: trip._id },
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const days = getTripDays(trip);
    const normalizedAnswers = normalizePlanningAnswers(planningAnswers);
    const report = step => reportPlanningStep(workflowId, step);
    const plannerOptions = {
      totalDays: days,
      instructions: String(instructions || '').trim().slice(0, 700),
      planningAnswers: normalizedAnswers,
      useWebSearch: useWebSearch !== false,
    };
    const cacheInput = stablePlanInput({
      trip,
      profile,
      memories,
      options: plannerOptions,
    });
    const cacheKey = buildPlannerCacheKey(cacheInput);
    const cached = await PlannerCache.findOne({
      cacheKey,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (cached?.plan) {
      await report({
        key: 'cache-hit',
        agent: 'Planner Cache',
        status: 'completed',
        message: 'Reused a matching cached itinerary',
        detail: 'No Groq model calls were needed for this request',
      });

      const cachedPlan = addLegacyPeriods(cloneJson(cached.plan));
      trip.aiPlan = cachedPlan;
      trip.aiPlan.generationContext = {
        customInstructions: plannerOptions.instructions,
        planningAnswers: normalizedAnswers,
        webResearchUsed: cached.webResearchUsed,
        workflowId,
        workflowVersion: 4,
        cacheHit: true,
      };
      trip.markModified('aiPlan');
      trip.lastGeneratedAt = new Date();
      await trip.save();
      await completePlanningRun(workflowId);

      return res.json(new ApiResponse(200, {
        trip,
        plan: trip.aiPlan,
        workflowId,
        cacheHit: true,
      }, 'Detailed trip plan loaded from cache'));
    }

    const workflow = await runPlannerGraph({
      trip,
      profile,
      memories,
      options: plannerOptions,
      researchTrip: researchTripOnline,
      requestJson,
      requestPlannerSection,
      report,
    });

    const plan = addLegacyPeriods(workflow.plan);
    if (
      !Array.isArray(plan.dayWiseItinerary) ||
      plan.dayWiseItinerary.length !== days ||
      plan.dayWiseItinerary.some(day => !Array.isArray(day.schedule) || day.schedule.length < 4)
    ) {
      throw new ApiError(502, 'The agent workflow returned an incomplete itinerary.');
    }

    trip.aiPlan = plan;
    trip.aiPlan.generationContext = {
      customInstructions: plannerOptions.instructions,
      planningAnswers: normalizedAnswers,
      webResearchUsed: workflow.webResearchUsed,
      workflowId,
      workflowVersion: 4,
    };
    trip.markModified('aiPlan');
    trip.lastGeneratedAt = new Date();
    await trip.save();

    await Promise.all([
      saveVersion(req.user._id, trip._id, plan, 'agentic-ai-generated'),
      PlannerCache.findOneAndUpdate(
        { cacheKey },
        {
          cacheKey,
          userId: req.user._id,
          tripId: trip._id,
          plan,
          webResearchUsed: workflow.webResearchUsed,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
        },
        { upsert: true, new: true },
      ),
      Notification.create({
        userId: req.user._id,
        tripId: trip._id,
        title: 'Agentic AI plan ready',
        message: `Your detailed itinerary for ${trip.destination} has passed the critic review.`,
        type: 'ai-plan',
      }),
    ]);
    await completePlanningRun(workflowId);

    res.json(new ApiResponse(200, { trip, plan, workflowId }, 'Detailed agentic trip plan generated'));
  } catch (error) {
    await failPlanningRun(workflowId, error).catch(progressError => {
      console.error('Could not mark planning workflow failed:', progressError.message);
    });
    throw error;
  }
});

export const getPlanningProgress = asyncHandler(async (req, res) => {
  const run = await PlanningRun.findOne({
    workflowId: req.params.workflowId,
    userId: req.user._id,
  })
    .select('workflowId tripId status currentAgent steps modelCalls error createdAt updatedAt')
    .lean();
  if (!run) throw new ApiError(404, 'Planning workflow not found');
  res.json(new ApiResponse(200, run));
});

export const chatTrip = asyncHandler(async (req, res) => {
  const { tripId, message } = req.body;
  if (!message) throw new ApiError(400, 'Message required');

  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  await ChatMessage.create({ userId: req.user._id, tripId, role: 'user', content: message });

  const history = (await ChatMessage.find({ tripId, userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean())
    .reverse();

  requireGroq();

  let reply;
  try {
    const messages = buildChatPrompt(trip, history);
    const result = await callGroqWebSearch(messages, { max_tokens: 1000 });
    reply = result.content;
  } catch (error) {
    console.error('Groq chat failed:', error.message);
    throw new ApiError(502, 'AI chat is temporarily unavailable. Please try again.');
  }

  await ChatMessage.create({ userId: req.user._id, tripId, role: 'assistant', content: reply });

  res.json(new ApiResponse(200, { reply }));
});

export const getChatHistory = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');
  const messages = await ChatMessage.find({ tripId, userId: req.user._id }).sort({ createdAt: 1 });
  res.json(new ApiResponse(200, messages));
});

export const regenerateDay = asyncHandler(async (req, res) => {
  const { tripId, dayNumber, instruction } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip || !trip.aiPlan) throw new ApiError(404, 'Trip or plan not found');

  const parsedDayNumber = Number(dayNumber);
  const itinerary = trip.aiPlan.dayWiseItinerary;
  if (
    !Number.isInteger(parsedDayNumber) ||
    parsedDayNumber < 1 ||
    parsedDayNumber > (itinerary?.length || 0)
  ) {
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
  await trip.save();
  await saveVersion(req.user._id, trip._id, trip.aiPlan, `day-${parsedDayNumber}-regenerated`);

  res.json(new ApiResponse(200, { updatedDay, trip }));
});

export const optimizeBudget = asyncHandler(async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip || !trip.aiPlan) throw new ApiError(404, 'Trip or plan not found');

  const prompt = `Optimize this travel budget for ${trip.destination}. Current: ${JSON.stringify(trip.aiPlan.budgetBreakdown)}. Total budget: ${trip.currency} ${trip.budget}. Return ONLY a JSON budget object with: transport, stay, food, activities, localTransport, shoppingBuffer, emergencyBuffer, totalEstimated, savingTips array.`;
  const result = await requestJson(prompt, { max_tokens: 800, temperature: 0.4 });

  trip.aiPlan.budgetBreakdown = result;
  trip.markModified('aiPlan');
  await trip.save();
  await saveVersion(req.user._id, trip._id, trip.aiPlan, 'budget-optimized');

  res.json(new ApiResponse(200, { budgetBreakdown: result, trip }, 'Budget optimized'));
});

export const createPackingList = asyncHandler(async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

  const prompt = `Create a smart packing list for a trip to ${trip.destination} for ${trip.travelers} person(s), ${trip.travelStyle} style. Consider the itinerary and user notes: ${JSON.stringify({
    itinerary: trip.aiPlan?.dayWiseItinerary?.map(day => day.theme),
    notes: trip.notes,
  })}. Return ONLY a JSON object: {"packingList": [{ "category": "string", "items": ["string"] }]}`;
  const packingResult = await requestJson(prompt, { max_tokens: 900, temperature: 0.4 });
  const packingList = Array.isArray(packingResult)
    ? packingResult
    : packingResult.packingList;

  if (!Array.isArray(packingList)) {
    throw new ApiError(502, 'AI returned an invalid packing list');
  }

  if (packingList.length > 0) {
    await ChecklistItem.deleteMany({ tripId, userId: req.user._id, source: 'ai-packing' });
    const items = packingList.flatMap(cat =>
      (cat.items || []).map(item => ({
        userId: req.user._id,
        tripId,
        title: item,
        category: cat.category?.toLowerCase() || 'general',
        source: 'ai-packing',
      }))
    );
    await ChecklistItem.insertMany(items);
  }

  res.json(new ApiResponse(200, packingList));
});

export const safetyGuide = asyncHandler(async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');

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
  await trip.save();

  res.json(new ApiResponse(200, guide));
});

export const transformTrip = asyncHandler(async (req, res) => {
  const { tripId, transformation } = req.body;
  const trip = await Trip.findOne({ _id: tripId, userId: req.user._id });
  if (!trip || !trip.aiPlan) throw new ApiError(404, 'Trip or plan not found');

  const transformMap = {
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

  const instruction = transformMap[transformation];
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

  if (
    !Array.isArray(newPlan.dayWiseItinerary) ||
    newPlan.dayWiseItinerary.length !== itineraryDays
  ) {
    throw new ApiError(502, 'AI returned an incomplete transformed plan');
  }

  trip.aiPlan = newPlan;
  trip.markModified('aiPlan');
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
    const result = await researchTripOnline(trip, focus);
    res.json(new ApiResponse(200, {
      content: result.content,
      toolsUsed: result.executedTools.length,
    }, 'Live web research completed'));
  } catch (error) {
    console.error('Trip web research failed:', error.message);
    throw new ApiError(502, 'Live travel research is temporarily unavailable.');
  }
});
