import { randomUUID, createHash } from 'node:crypto';
import Trip from '../models/Trip.js';
import TravelProfile from '../models/TravelProfile.js';
import TripVersion from '../models/TripVersion.js';
import Notification from '../models/Notification.js';
import TripMemory from '../models/TripMemory.js';
import PlannerCache from '../models/PlannerCache.js';
import LazyPlan from '../models/LazyPlan.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { callAI, getActiveAIProvider, isAIAvailable } from './aiService.js';
import { searchTavily } from './tavilyService.js';
import safeJsonParse from '../utils/safeJsonParse.js';
import { runPlannerGraph } from '../agents/graph.js';
import {
  completePlanningRun,
  createPlanningRun,
  failPlanningRun,
  reportPlanningProviderUsage,
  reportPlanningStep,
  savePlanningBatch,
  savePlanningFoundation,
  touchPlanningRun,
} from './planningProgressService.js';
import {
  buildTravelerProfileSnapshot,
  compactTravelerProfileForPrompt,
} from './travelerProfileService.js';
import { getCachedResearch, saveCachedResearch } from './researchCacheService.js';
import logger from './logger.js';
import { migratePlanV1ToV2 } from './planMigration.js';
import {
  collectTravelIntelligence,
  formatTravelIntelligenceForPrompt,
} from './travelIntelligenceService.js';

export const LIGHT_AGENT_MODEL = process.env.GROQ_AGENT_MODEL ||
  process.env.GROQ_PLANNER_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';
const HEAVY_ITINERARY_MODEL = process.env.GROQ_ITINERARY_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';
const activePlanningWorkflows = new Set();

export const saveVersion = async (userId, tripId, plan, source) => {
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

export const requireAI = () => {
  if (!isAIAvailable()) {
    throw new ApiError(
      503,
      'AI service is not configured. Add GROQ_API_KEY or GEMINI_API_KEY to server/.env.',
    );
  }
};

export const requestJson = async (prompt, options = {}) => {
  requireAI();
  const { retryPrompt, ...groqOptions } = options;
  const jsonOptions = {
    response_format: { type: 'json_object' },
    model: LIGHT_AGENT_MODEL,
    max_tokens: 1000,
    ...groqOptions,
  };
  const parseResponse = async (requestPrompt, overrides = {}) => {
    const raw = await callAI(
      [{ role: 'user', content: requestPrompt }],
      { ...jsonOptions, ...overrides },
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
    let finalError = error;
    const canRetry = retryPrompt &&
      ['AI_INVALID_JSON', 'AI_OUTPUT_TRUNCATED'].includes(error.code);
    if (canRetry) {
      logger.warn(
        { stage: 'json-response-retry', errorCode: error.code },
        'AI JSON response needs a compact retry',
      );
      try {
        const initialMaxTokens = Math.max(1, Number(jsonOptions.max_tokens) || 1000);
        const provider = getActiveAIProvider(jsonOptions.provider);
        const retryMaxTokens = provider === 'gemini'
          ? Math.min(6500, Math.max(3600, initialMaxTokens + 1400))
          : Math.min(4000, Math.max(1800, initialMaxTokens + 600));
        return await parseResponse(retryPrompt, { max_tokens: retryMaxTokens });
      } catch (retryError) {
        finalError = retryError;
        logger.error(
          { stage: 'json-response-retry', error: retryError.message },
          'AI compact JSON retry failed',
        );
      }
    } else {
      logger.error({ stage: 'json-response', error: error.message }, 'AI JSON request failed');
    }
    if (finalError.code === 'AI_OUTPUT_TRUNCATED') {
      throw new ApiError(
        502,
        'The AI response reached its output limit twice. Retry the same request; no completed itinerary days need to be regenerated.',
      );
    }
    if (finalError.status === 429 || finalError.code === 429) {
      throw new ApiError(
        429,
        'The selected AI provider is temporarily at its rate limit. Please retry shortly or choose the other provider.',
      );
    }
    throw new ApiError(502, 'AI service failed to generate a valid response. Please try again.');
  }
};

export const requestPlannerSection = async (prompt, options = {}) => {
  requireAI();
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
      const content = await callAI([{ role: 'user', content: activePrompt }], {
        model: options.model || HEAVY_ITINERARY_MODEL,
        max_tokens: activeMaxTokens,
        temperature: options.temperature ?? 0.22,
        response_format: { type: 'json_object' },
        onWait: options.onWait,
      });
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
        activePrompt = compactPrompt;
        await new Promise(resolve => setTimeout(resolve, 750));
        continue;
      }
      break;
    }
  }

  logger.error(
    { stage: 'day-architect', error: lastError?.message },
    'Planner section request failed',
  );
  if (lastError?.code === 'AI_OUTPUT_TRUNCATED') {
    throw new ApiError(502, 'One itinerary section was too long. Please try generating again.');
  }
  if (lastError?.status === 429 || lastError?.code === 429) {
    throw new ApiError(
      429,
      'The selected AI provider is temporarily at its token limit. Retry shortly or choose the other provider.',
    );
  }
  throw new ApiError(502, 'AI could not complete an itinerary section. Please try again.');
};

export const getTripDays = trip => {
  if (!trip.startDate || !trip.endDate) return 5;
  return Math.max(
    1,
    Math.floor((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1,
  );
};

export const getPlanTokenBudget = days =>
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
  version: 10,
  ownerId: String(trip.userId || ''),
  trip: {
    title: trip.title,
    origin: trip.origin || '',
    destination: trip.destination,
    startDate: trip.startDate ? new Date(trip.startDate).toISOString().slice(0, 10) : '',
    endDate: trip.endDate ? new Date(trip.endDate).toISOString().slice(0, 10) : '',
    travelers: trip.travelers,
    budget: trip.budget,
    budgetMode: trip.budgetMode || (Number(trip.budget) > 0 ? 'hard-budget' : 'ai-managed'),
    currency: trip.currency,
    travelStyle: trip.travelStyle,
    planningMode: trip.planningMode,
    mustVisitPlaces: trip.mustVisitPlaces || [],
    avoidList: trip.avoidList || [],
    notes: String(trip.notes || '').slice(0, 700),
  },
  profile: profile ? compactTravelerProfileForPrompt(profile) : null,
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
  createHash('sha256').update(JSON.stringify(input)).digest('hex');
const cloneJson = value => JSON.parse(JSON.stringify(value));

export const addLegacyPeriods = plan => {
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
          : hour < 21 ? 'evening' : 'night';
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

export const researchTripOnline = async (
  trip,
  focus = 'complete trip planning',
  { userId, includeWebSearch = true } = {},
) => {
  const cacheFocus = `${focus}|web:${includeWebSearch !== false ? 'on' : 'off'}`;
  const cached = await getCachedResearch({ userId, trip, focus: cacheFocus }).catch(error => {
    logger.warn({ stage: 'research-cache-read', error: error.message }, 'Could not read research cache');
    return null;
  });
  if (cached?.content) {
    const providerUsage = (cached.evidence?.providerUsage || []).map(provider => ({
      ...provider,
      mode: provider.status === 'used' ? 'research-cache' : provider.mode,
    }));
    return {
      content: cached.content,
      brief: cached.brief || '',
      evidence: cached.evidence || null,
      providerUsage,
      sources: cached.evidence?.sources || [],
      executedTools: Array.from(
        { length: cached.toolsUsed || 0 },
        () => ({ type: 'cached_travel_research' }),
      ),
      cacheHit: true,
      webSearchUsed: (cached.evidence?.providerUsage || []).some(provider =>
        provider.key === 'tavily' && provider.status === 'used'),
    };
  }

  const dates = trip.startDate && trip.endDate
    ? `${new Date(trip.startDate).toISOString().slice(0, 10)} to ${new Date(trip.endDate).toISOString().slice(0, 10)}`
    : 'flexible dates';
  const query =
    `Top must-visit places and distinctive local experiences in ` +
    `${String(trip.destination || '').slice(0, 120)} for a ${trip.travelStyle || 'balanced'} ` +
    `${trip.planningMode || 'AI decides'} trip. Give exact attraction, nature, waterfall, lake, hill, ` +
    `temple, heritage, market and viewpoint names with areas, access or closure notes, and useful ` +
    `official or local tourism URLs. Travel dates: ${dates}.`;
  const [intelligenceResult, tavilyResult] = await Promise.allSettled([
    collectTravelIntelligence(trip),
    includeWebSearch !== false
      ? searchTavily(query, {
        searchDepth: process.env.TAVILY_PLANNER_SEARCH_DEPTH || 'advanced',
        maxResults: 6,
        includeAnswer: 'advanced',
      })
      : Promise.resolve(null),
  ]);
  const evidence = intelligenceResult.status === 'fulfilled'
    ? intelligenceResult.value
    : null;
  const factualContent = formatTravelIntelligenceForPrompt(evidence);
  const webResult = tavilyResult.status === 'fulfilled' ? tavilyResult.value : null;
  const providerUsage = [
    ...(evidence?.providerUsage || []),
    {
      key: 'tavily',
      label: 'Tavily Search API',
      status: includeWebSearch === false
        ? 'disabled'
        : webResult
          ? 'used'
          : process.env.TAVILY_API_KEY ? 'unavailable' : 'not-configured',
      mode: includeWebSearch === false ? 'disabled' : 'live',
      detail: includeWebSearch === false
        ? 'Optional web search was disabled; structured travel APIs still ran'
        : webResult
        ? `${webResult.sources?.length || 0} current web source(s) supplied`
        : process.env.TAVILY_API_KEY
          ? 'Tavily did not return usable research'
          : 'No TAVILY_API_KEY is configured',
    },
  ];
  if (evidence) evidence.providerUsage = providerUsage;
  const content = [
    factualContent
      ? `STRUCTURED TRAVEL API DATA (authoritative where populated):\n${factualContent}`
      : '',
    webResult?.content
      ? `GENERAL WEB RESEARCH (supporting reference only):\n${webResult.content}`
      : '',
  ].filter(Boolean).join('\n\n').slice(0, 12000);
  if (!content) {
    throw tavilyResult.status === 'rejected'
      ? tavilyResult.reason
      : new Error('No travel research provider returned usable data');
  }
  const executedTools = [
    ...(evidence?.sources || []).map(source => ({
      type: source.title.toLowerCase().replace(/\W+/g, '_'),
    })),
    ...(webResult?.executedTools || []),
  ];
  await saveCachedResearch({
    userId,
    trip,
    focus: cacheFocus,
    content,
    evidence,
    toolsUsed: executedTools.length,
  }).catch(error => {
    logger.warn({ stage: 'research-cache-write', error: error.message }, 'Could not save research cache');
  });
  return {
    content,
    brief: '',
    evidence,
    providerUsage,
    sources: [...(evidence?.sources || []), ...(webResult?.sources || [])],
    executedTools,
    cacheHit: false,
    webSearchUsed: Boolean(webResult),
  };
};

export const executePlanTrip = async (req, res) => {
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
  const lazyPlanExists = await LazyPlan.exists({ tripId: trip._id, userId: req.user._id });
  if (lazyPlanExists) {
    throw new ApiError(
      409,
      'This trip uses day-wise generation. Continue from its pending day or rebuild the foundation.',
    );
  }

  const planningLockKey = `${req.user._id}:${trip._id}`;
  if (activePlanningWorkflows.has(planningLockKey)) {
    throw new ApiError(
      409,
      'A plan for this trip is already being generated. Keep this page open to follow its progress.',
    );
  }
  activePlanningWorkflows.add(planningLockKey);
  let heartbeatTimer = null;

  try {
    const [profile, memories] = await Promise.all([
      TravelProfile.findOne({ userId: req.user._id }),
      TripMemory.find({ userId: req.user._id, tripId: { $ne: trip._id } })
        .sort({ updatedAt: -1 }).limit(5).lean(),
    ]);
    const days = getTripDays(trip);
    const normalizedAnswers = normalizePlanningAnswers(planningAnswers);
    const profileSnapshot = buildTravelerProfileSnapshot({
      trip, profile, memories, planningAnswers: normalizedAnswers,
    });
    const report = step => reportPlanningStep(workflowId, step);
    const plannerOptions = {
      totalDays: days,
      instructions: String(instructions || '').trim().slice(0, 700),
      planningAnswers: normalizedAnswers,
      useWebSearch: useWebSearch !== false,
      aiProvider: getActiveAIProvider(),
    };
    const cacheKey = buildPlannerCacheKey(stablePlanInput({
      trip, profile: profileSnapshot, memories, options: plannerOptions,
    }));
    if (process.env.VERCEL) {
      const configuredBudget = Number(process.env.PLANNER_INVOCATION_BUDGET_MS);
      const invocationBudget = Number.isFinite(configuredBudget)
        ? Math.min(240_000, Math.max(120_000, configuredBudget))
        : 210_000;
      plannerOptions.deadlineAt = Date.now() + invocationBudget;
    }
    const planningRun = await createPlanningRun({
      workflowId,
      userId: req.user._id,
      tripId: trip._id,
      resumeKey: cacheKey,
      totalDays: days,
    });
    heartbeatTimer = setInterval(() => {
      touchPlanningRun(workflowId).catch(error => {
        logger.warn(
          { jobId: workflowId, stage: 'workflow-heartbeat', error: error.message },
          'Could not update planning workflow heartbeat',
        );
      });
    }, 15_000);
    heartbeatTimer.unref?.();
    plannerOptions.resumeState = {
      foundation: planningRun?.foundation || null,
      partialItinerary: planningRun?.partialItinerary || [],
      batches: planningRun?.batches || [],
    };
    if (planningRun?.resumedFrom && planningRun.partialItinerary?.length) {
      await report({
        key: 'resume',
        agent: 'Planning Checkpoint',
        status: 'completed',
        message: `Recovered ${planningRun.partialItinerary.length} completed day(s)`,
        detail: 'The planner will continue from the first missing day',
      });
    }
    const cached = await PlannerCache.findOne({
      cacheKey, userId: req.user._id, expiresAt: { $gt: new Date() },
    }).lean();
    const cacheUsable = !plannerOptions.useWebSearch || cached?.webResearchUsed === true;

    if (cached?.plan && cacheUsable) {
      await report({
        key: 'cache-hit', agent: 'Planner Cache', status: 'completed',
        message: 'Reused a matching cached itinerary',
        detail: 'No Groq model calls were needed for this request',
      });
      await reportPlanningProviderUsage(
        report,
        cached.plan?.generationContext?.dataProviders || [],
        { forceCache: true },
      );
      trip.aiPlan = addLegacyPeriods(cloneJson(cached.plan));
      trip.aiPlan.generationContext = {
        customInstructions: plannerOptions.instructions,
        planningAnswers: normalizedAnswers,
        webResearchUsed: cached.webResearchUsed,
        dataProviders: cached.plan?.generationContext?.dataProviders || [],
        workflowId,
        workflowVersion: 10,
        cacheHit: true,
      };
      trip.aiPlanV2 = migratePlanV1ToV2(trip.aiPlan);
      trip.planVersion = 2;
      trip.markModified('aiPlan');
      trip.markModified('aiPlanV2');
      trip.lastGeneratedAt = new Date();
      await trip.save();
      await completePlanningRun(workflowId);
      await req.refundCredits?.('Matching cached plan reused; no AI calls were needed.');
      return res.json(new ApiResponse(200, {
        trip, plan: trip.aiPlan, workflowId, cacheHit: true,
      }, 'Detailed trip plan loaded from cache'));
    }

    if (cached?.plan && !cacheUsable) {
      await report({
        key: 'cache-bypass', agent: 'Planner Cache', status: 'skipped',
        message: 'Cached plan did not contain requested live research',
        detail: 'Generating again so Tavily can supply current sources',
      });
    }

    const onModelWait = async ({ waiting, durationMs, reason }) => {
      const seconds = Math.max(1, Math.ceil((Number(durationMs) || 0) / 1000));
      await report({
        key: 'rate-limit-window',
        agent: 'Model Capacity Manager',
        status: waiting ? 'running' : 'completed',
        message: waiting
          ? 'Waiting for model rate-limit window'
          : 'Model capacity available; continuing',
        detail: waiting
          ? `Automatic ${reason === 'rate-limit' ? 'provider' : 'token-budget'} cooldown · about ${seconds}s`
          : 'No user action is required',
      });
    };
    const workflow = await runPlannerGraph({
      trip,
      profile: profileSnapshot,
      memories,
      options: plannerOptions,
      researchTrip: targetTrip => researchTripOnline(
        targetTrip,
        'complete trip planning',
        {
          userId: req.user._id,
          includeWebSearch: plannerOptions.useWebSearch,
        },
      ),
      requestJson: (prompt, options = {}) =>
        requestJson(prompt, {
          ...options,
          provider: plannerOptions.aiProvider,
          onWait: onModelWait,
        }),
      requestPlannerSection: (prompt, options = {}) =>
        requestPlannerSection(prompt, {
          ...options,
          provider: plannerOptions.aiProvider,
          onWait: onModelWait,
        }),
      report,
      persistFoundation: foundation => savePlanningFoundation(workflowId, foundation),
      persistBatch: batch => savePlanningBatch(workflowId, batch),
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
      dataProviders: workflow.providerUsage || [],
      workflowId,
      workflowVersion: 10,
    };
    trip.aiPlanV2 = migratePlanV1ToV2(trip.aiPlan);
    trip.planVersion = 2;
    trip.markModified('aiPlan');
    trip.markModified('aiPlanV2');
    trip.lastGeneratedAt = new Date();
    await trip.save();
    await Promise.all([
      saveVersion(req.user._id, trip._id, plan, 'agentic-ai-generated'),
      PlannerCache.findOneAndUpdate(
        { cacheKey, userId: req.user._id },
        {
          cacheKey,
          userId: req.user._id,
          tripId: trip._id,
          plan,
          webResearchUsed: workflow.webResearchUsed,
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
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
    return res.json(new ApiResponse(
      200,
      { trip, plan, workflowId },
      'Detailed agentic trip plan generated',
    ));
  } catch (error) {
    await failPlanningRun(workflowId, error).catch(progressError => {
      logger.error(
        { jobId: workflowId, stage: 'workflow-failure-persistence', error: progressError.message },
        'Could not mark planning workflow failed',
      );
    });
    throw error;
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    activePlanningWorkflows.delete(planningLockKey);
  }
};
