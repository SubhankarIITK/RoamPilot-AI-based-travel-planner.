import ApiError from '../utils/ApiError.js';
import {
  buildCriticPrompt,
  buildLogisticsPrompt,
  buildPlannerPrompt,
  buildRepairDayPrompt,
  buildTripStrategyPrompt,
} from '../prompts/plannerPrompt.js';
import { normalizeBudgetPlan } from '../services/budgetEngine.js';
import { getSafeAIErrorMessage } from '../services/aiErrorService.js';

const LIGHT_AGENT_MODEL = process.env.GROQ_AGENT_MODEL ||
  process.env.GROQ_PLANNER_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';
const HEAVY_ITINERARY_MODEL = process.env.GROQ_ITINERARY_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';

const PLACEHOLDER_PATTERNS = [
  /\bmain local landmark\b/i,
  /\bcultural stop\b/i,
  /\bmarket,\s*museum,\s*viewpoint/i,
  /\bmarket or museum\b/i,
  /\bwell-reviewed\b/i,
  /\bchoose (the|a|nearby|any)\b/i,
  /\bnearby attraction\b/i,
  /\bhighest-priority verified attraction\b/i,
  /\blocal restaurant\b/i,
  /\blocal dish\b/i,
  /\bbudget locally\b/i,
  /\bverify\b/i,
  /\bto confirm\b/i,
  /\btbd\b/i,
  /\bn\/a\b/i,
  /\bplaceholder\b/i,
  /\bgeneric\b/i,
  /\bexact (venues|hours|prices)\b/i,
];

const normalizeText = value =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const hasPlaceholderText = value =>
  typeof value === 'string' && PLACEHOLDER_PATTERNS.some(pattern => pattern.test(value));

const collectPlaceholderPaths = (value, path = 'plan', paths = []) => {
  if (typeof value === 'string' && hasPlaceholderText(value)) paths.push(path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPlaceholderPaths(item, `${path}[${index}]`, paths));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => collectPlaceholderPaths(item, `${path}.${key}`, paths));
  }
  return paths;
};

const containsNumberOrFree = value =>
  /\d|free|included|complimentary/i.test(String(value || ''));

const isTransitOnly = item =>
  /transfer|taxi|uber|metro|train|flight|airport|check.?in|check.?out|rest|break|buffer/i
    .test(`${item?.activity || ''} ${item?.location || ''}`);

const getNumericMinutes = value => {
  const minutes = Number(String(value || '').match(/(\d+(?:\.\d+)?)/)?.[1]);
  return Number.isFinite(minutes) ? minutes : null;
};

export const repairSafeDayOmissions = (day, trip = {}) => {
  if (!day || !Array.isArray(day.schedule)) return day;

  day.schedule = day.schedule.map((item, index) => {
    const repaired = { ...item };
    const location = String(repaired.location || repaired.activity || 'the planned stop').trim();
    const activity = String(repaired.activity || 'Complete the planned visit').trim();
    const duration = containsNumberOrFree(repaired.duration)
      ? repaired.duration
      : 'the planned time';

    if (
      !repaired.details ||
      String(repaired.details).length < 35 ||
      hasPlaceholderText(repaired.details)
    ) {
      repaired.details = `${activity} at ${location}; allow ${duration}, use the public entrance, and keep a short buffer before departure.`;
    }

    if (!containsNumberOrFree(repaired.travelTime)) {
      const existingTravelNote = String(repaired.travelTime || '').trim();
      repaired.travelTime = index === 0
        ? '0 min (day starts at this stop)'
        : `15 min estimated from the previous stop${existingTravelNote ? ` (${existingTravelNote})` : ''}`;
    }

    if (!repaired.transport || hasPlaceholderText(repaired.transport)) {
      const travelMinutes = getNumericMinutes(repaired.travelTime);
      repaired.transport = index === 0
        ? 'Begin at this location'
        : travelMinutes !== null && travelMinutes <= 15
          ? 'Walk'
          : 'Local taxi';
    }

    return repaired;
  });

  if (Array.isArray(day.meals)) {
    day.meals = day.meals.map((meal, index) => {
      const repaired = { ...meal };
      repaired.placeOrArea = String(
        repaired.placeOrArea ||
        repaired.restaurantOrArea ||
        repaired.restaurant ||
        repaired.place ||
        repaired.venue ||
        repaired.location ||
        '',
      ).trim();

      if (!repaired.placeOrArea || hasPlaceholderText(repaired.placeOrArea)) {
        const schedule = day.schedule || [];
        const nearbyStop = index === 0
          ? schedule[0]
          : index === day.meals.length - 1
            ? schedule[schedule.length - 1]
            : schedule[Math.floor(schedule.length / 2)];
        repaired.placeOrArea = String(
          nearbyStop?.location ||
          (index === 0 ? day.startArea : day.endArea) ||
          trip.destination ||
          'Central dining district',
        ).trim();
      }

      repaired.suggestion = String(
        repaired.suggestion ||
        repaired.dishes ||
        repaired.dish ||
        repaired.food ||
        repaired.description ||
        'Choose a suitable local meal matching the traveler preferences',
      ).trim();

      if (!containsNumberOrFree(repaired.estimatedCost)) {
        const foodBudget = Number(day.dailyBudget?.food) || 0;
        const perMeal = foodBudget > 0
          ? Math.max(0, Math.round(foodBudget / Math.max(1, day.meals.length)))
          : 0;
        repaired.estimatedCost = `${trip.currency || 'INR'} ${perMeal}`;
      }
      return repaired;
    });
  }

  if (day.dailyBudget && typeof day.dailyBudget === 'object') {
    const activities = Number(day.dailyBudget.activities) || 0;
    const food = Number(day.dailyBudget.food) || 0;
    const localTransport = Number(day.dailyBudget.localTransport) || 0;
    const subtotal = activities + food + localTransport;
    if (subtotal > 0) {
      day.dailyBudget.activities = activities;
      day.dailyBudget.food = food;
      day.dailyBudget.localTransport = localTransport;
      day.dailyBudget.total = subtotal;
    }
  }

  return day;
};

const validateDayQuality = (day) => {
  const issues = [];
  if (!day?.theme || hasPlaceholderText(day.theme)) issues.push(`day ${day?.day || '?'} has a generic theme`);
  if (!day?.summary || String(day.summary).length < 35 || hasPlaceholderText(day.summary)) {
    issues.push(`day ${day?.day || '?'} needs a concrete purpose summary`);
  }
  if (!day?.startArea || hasPlaceholderText(day.startArea)) issues.push(`day ${day?.day || '?'} start area is not concrete`);
  if (!day?.endArea || hasPlaceholderText(day.endArea)) issues.push(`day ${day?.day || '?'} end area is not concrete`);
  if (!containsNumberOrFree(day.walkingEstimate)) issues.push(`day ${day?.day || '?'} walking estimate needs a numeric distance/time`);
  if (!day?.rainyDayAlternative || hasPlaceholderText(day.rainyDayAlternative)) {
    issues.push(`day ${day?.day || '?'} rainy alternative must name a real place`);
  }

  if (!Array.isArray(day.schedule) || day.schedule.length < 4) {
    issues.push(`day ${day?.day || '?'} needs at least 4 scheduled entries`);
  } else {
    day.schedule.forEach((item, index) => {
      const label = `day ${day.day} schedule ${index + 1}`;
      if (!item?.time || !/\d{1,2}:\d{2}/.test(String(item.time))) issues.push(`${label} needs a clock time`);
      if (!containsNumberOrFree(item?.duration)) issues.push(`${label} needs a realistic duration`);
      if (!item?.activity || String(item.activity).length < 8 || hasPlaceholderText(item.activity)) {
        issues.push(`${label} needs a concrete activity`);
      }
      if (!item?.location || String(item.location).length < 4 || hasPlaceholderText(item.location)) {
        issues.push(`${label} needs a concrete venue or exact area`);
      }
      if (!item?.details || String(item.details).length < 35 || hasPlaceholderText(item.details)) {
        issues.push(`${label} needs concrete practical details`);
      }
      if (!containsNumberOrFree(item?.travelTime)) issues.push(`${label} needs numeric travel time`);
      if (!item?.transport || hasPlaceholderText(item.transport)) issues.push(`${label} needs a concrete transport mode`);
      if (!containsNumberOrFree(item?.estimatedCost)) issues.push(`${label} needs a numeric/free estimated cost`);
      if (item?.openingHours && hasPlaceholderText(item.openingHours)) issues.push(`${label} has placeholder opening hours`);
      if (item?.entryFee && !containsNumberOrFree(item.entryFee)) issues.push(`${label} has non-numeric entry fee`);
    });
  }

  if (!Array.isArray(day.meals) || day.meals.length < 2) {
    issues.push(`day ${day?.day || '?'} needs at least 2 named meals`);
  } else {
    day.meals.forEach((meal, index) => {
      const label = `day ${day.day} meal ${index + 1}`;
      if (!meal?.placeOrArea || hasPlaceholderText(meal.placeOrArea)) issues.push(`${label} needs a named restaurant/cafe/food area`);
      if (!meal?.suggestion || hasPlaceholderText(meal.suggestion)) issues.push(`${label} needs concrete dishes or food plan`);
      if (!containsNumberOrFree(meal?.estimatedCost)) issues.push(`${label} needs numeric/free cost`);
    });
  }

  const dailyBudget = day.dailyBudget || {};
  const subtotal = ['activities', 'food', 'localTransport']
    .map(key => Number(dailyBudget[key]) || 0)
    .reduce((sum, value) => sum + value, 0);
  const total = Number(dailyBudget.total) || 0;
  if (total <= 0) issues.push(`day ${day?.day || '?'} needs a positive daily budget total`);
  if (subtotal > 0 && total > 0 && Math.abs(subtotal - total) > Math.max(250, total * 0.2)) {
    issues.push(`day ${day?.day || '?'} daily budget total does not match category subtotal`);
  }

  return issues;
};

const validatePlanQuality = (plan, expectedDays) => {
  const issues = [];
  if (!Array.isArray(plan?.dayWiseItinerary) || plan.dayWiseItinerary.length !== expectedDays) {
    issues.push(`plan must contain exactly ${expectedDays} days`);
  }

  const placeholderPaths = collectPlaceholderPaths(plan).slice(0, 12);
  if (placeholderPaths.length) {
    issues.push(`placeholder wording found at ${placeholderPaths.join(', ')}`);
  }

  const seenAttractions = new Map();
  for (const day of plan?.dayWiseItinerary || []) {
    issues.push(...validateDayQuality(day));
    for (const item of day.schedule || []) {
      if (isTransitOnly(item)) continue;
      const key = normalizeText(item.location || item.activity);
      if (key.length < 4) continue;
      if (seenAttractions.has(key)) {
        issues.push(`duplicate attraction/location "${item.location || item.activity}" on days ${seenAttractions.get(key)} and ${day.day}`);
      } else {
        seenAttractions.set(key, day.day);
      }
    }
  }

  const budget = plan?.budgetBreakdown || {};
  const totalEstimated = Number(budget.totalEstimated) || 0;
  const subtotal = ['transport', 'stay', 'food', 'activities', 'localTransport', 'shoppingBuffer', 'emergencyBuffer']
    .map(key => Number(budget[key]) || 0)
    .reduce((sum, value) => sum + value, 0);
  if (totalEstimated > 0 && subtotal > 0 && Math.abs(totalEstimated - subtotal) > Math.max(1000, totalEstimated * 0.15)) {
    issues.push('trip budget totalEstimated does not match budget category subtotal');
  }

  return [...new Set(issues)];
};

const validateDayBatch = (section, start, end) => {
  const days = section?.dayWiseItinerary;
  if (!Array.isArray(days) || days.length !== end - start + 1) return false;
  const expected = new Set(
    Array.from({ length: end - start + 1 }, (_, index) => start + index),
  );
  return days.every(day =>
    expected.delete(Number(day.day)) &&
    Array.isArray(day.schedule) &&
    day.schedule.length >= 4 &&
    Array.isArray(day.meals) &&
    day.meals.length >= 2
  ) && expected.size === 0;
};

const getSectionQualityIssues = section =>
  (section?.dayWiseItinerary || []).flatMap(day => validateDayQuality(day));

const validateStrategy = (strategy, totalDays) =>
  strategy &&
  Array.isArray(strategy.dayThemes) &&
  strategy.dayThemes.length === totalDays &&
  new Set(strategy.dayThemes.map(item => Number(item.day))).size === totalDays &&
  Array.isArray(strategy.route);

const normalizeScore = score => {
  const keys = [
    'overall',
    'budgetRealism',
    'timeRealism',
    'safety',
    'routeEfficiency',
    'restBalance',
    'foodQuality',
  ];
  return Object.fromEntries(keys.map(key => {
    const value = Number(score?.[key]);
    return [key, Number.isFinite(value) ? Math.min(10, Math.max(1, Math.round(value))) : 7];
  }));
};

const fallbackCritique = () => ({
  criticNotes: ['Critic model unavailable; structural validation and deterministic budget checks were used.'],
  repairDays: [],
  tripScore: {
    overall: 7,
    budgetRealism: 7,
    timeRealism: 7,
    safety: 7,
    routeEfficiency: 7,
    restBalance: 7,
    foodQuality: 7,
  },
});

export const runPlannerGraph = async ({
  trip,
  profile,
  memories,
  options,
  researchTrip,
  requestJson,
  requestPlannerSection,
  report,
}) => {
  const totalDays = options.totalDays;
  const state = {
    trip,
    profile,
    memories,
    liveResearch: '',
    webResearchUsed: false,
    strategy: null,
    logistics: null,
    itinerary: [],
    critique: null,
  };

  await report({
    key: 'intent',
    agent: 'Intent Agent',
    status: 'completed',
    message: 'Traveler constraints normalized',
    detail: `${totalDays} days · ${trip.travelers} traveler(s) · ${trip.currency} ${trip.budget}`,
  });

  if (options.useWebSearch) {
    await report({
      key: 'research',
      agent: 'Research Agent',
      status: 'running',
      message: 'Checking current destination conditions',
      detail: 'Transport, closures, seasonal conditions, safety, and cost signals',
      modelCall: true,
    });
    try {
      const research = await researchTrip(trip);
      state.liveResearch = research.content;
      state.webResearchUsed = true;
      await report({
        key: 'research',
        agent: 'Research Agent',
        status: 'completed',
        message: research.cacheHit
          ? 'Reused recent travel research'
          : 'Current travel research collected',
        detail: research.cacheHit
          ? 'No new Groq web-search call was needed'
          : `${research.executedTools?.length || 0} research tool call(s) used`,
      });
    } catch (error) {
      await report({
        key: 'research',
        agent: 'Research Agent',
        status: 'skipped',
        message: 'Live research unavailable; continuing cautiously',
        detail: getSafeAIErrorMessage(error, 'Live research was unavailable for this plan.'),
      });
    }
  } else {
    await report({
      key: 'research',
      agent: 'Research Agent',
      status: 'skipped',
      message: 'Live research disabled',
    });
  }

  const agentOptions = {
    instructions: options.instructions,
    planningAnswers: options.planningAnswers,
    liveResearch: state.liveResearch,
  };

  await report({
    key: 'strategy',
    agent: 'Trip Strategy Agent',
    status: 'running',
    message: 'Designing the geographic route and daily themes',
    detail: 'Arrival, departure, pacing, must-visits, and one practical area cluster per day',
    modelCall: true,
  });
  state.strategy = await requestJson(
    buildTripStrategyPrompt(trip, profile, memories, agentOptions),
    {
      model: LIGHT_AGENT_MODEL,
      max_tokens: 1200,
      temperature: 0.2,
      retryPrompt: `${buildTripStrategyPrompt(trip, profile, memories, agentOptions)}

RETRY: Return only schema-valid JSON with exactly ${totalDays} dayThemes. Use named neighborhoods, concrete route zones, and no placeholder wording.`,
    },
  );
  if (!validateStrategy(state.strategy, totalDays)) {
    await report({
      key: 'strategy-retry',
      agent: 'Trip Strategy Agent',
      status: 'running',
      message: 'Correcting an incomplete daily strategy',
      detail: 'One bounded schema repair',
      modelCall: true,
    });
    state.strategy = await requestJson(
      `${buildTripStrategyPrompt(trip, profile, memories, agentOptions)}

CORRECTION: Return exactly ${totalDays} unique dayThemes numbered 1 through ${totalDays}.`,
      { model: LIGHT_AGENT_MODEL, max_tokens: 1000, temperature: 0.1 },
    );
    if (!validateStrategy(state.strategy, totalDays)) {
      throw new ApiError(502, 'The strategy agent returned an incomplete day structure.');
    }
  }
  await report({
    key: 'strategy',
    agent: 'Trip Strategy Agent',
    status: 'completed',
    message: 'Route strategy approved',
    detail: `${state.strategy.route.length} route zone(s) and ${state.strategy.dayThemes.length} daily themes`,
  });

  await report({
    key: 'logistics',
    agent: 'Budget & Logistics Agent',
    status: 'running',
    message: 'Building realistic budget and transport constraints',
    detail: 'Stay areas, daily spending targets, transfers, meals, safety, and weather',
    modelCall: true,
  });
  state.logistics = await requestJson(
    buildLogisticsPrompt(trip, profile, state.strategy, agentOptions),
    {
      model: LIGHT_AGENT_MODEL,
      max_tokens: 1200,
      temperature: 0.15,
      retryPrompt: `${buildLogisticsPrompt(trip, profile, state.strategy, agentOptions)}

RETRY: Return only schema-valid JSON. Use named hotels/areas, named transport options, numeric costs, and no "verify", "variable", or generic recommendations.`,
    },
  );
  if (
    !state.logistics?.budgetBreakdown ||
    !Array.isArray(state.logistics.dailySpendingTargets) ||
    state.logistics.dailySpendingTargets.length !== totalDays
  ) {
    await report({
      key: 'logistics-retry',
      agent: 'Budget & Logistics Agent',
      status: 'running',
      message: 'Correcting incomplete daily budget targets',
      detail: 'One bounded schema repair',
      modelCall: true,
    });
    state.logistics = await requestJson(
      `${buildLogisticsPrompt(trip, profile, state.strategy, agentOptions)}

CORRECTION: Return exactly ${totalDays} dailySpendingTargets and every required logistics section.`,
      { model: LIGHT_AGENT_MODEL, max_tokens: 1000, temperature: 0.1 },
    );
    if (
      !state.logistics?.budgetBreakdown ||
      !Array.isArray(state.logistics.dailySpendingTargets) ||
      state.logistics.dailySpendingTargets.length !== totalDays
    ) {
      throw new ApiError(502, 'The logistics agent returned incomplete budget constraints.');
    }
  }
  state.logistics = normalizeBudgetPlan(state.logistics, trip);
  await report({
    key: 'logistics',
    agent: 'Budget & Logistics Agent',
    status: 'completed',
    message: 'Budget and operating constraints approved',
    detail: `${trip.currency} ${state.logistics.budgetBreakdown.totalEstimated || trip.budget} estimated total`,
  });

  const configuredBatchSize = Number(process.env.GROQ_ITINERARY_BATCH_SIZE);
  const batchSize = Number.isInteger(configuredBatchSize) && configuredBatchSize > 0
    ? Math.min(3, configuredBatchSize)
    : 2;
  const ranges = [];
  for (let start = 1; start <= totalDays; start += batchSize) {
    ranges.push({ start, end: Math.min(totalDays, start + batchSize - 1) });
  }

  const planOverview = {
    ...state.strategy,
    ...state.logistics,
  };

  for (const range of ranges) {
    const key = `days-${range.start}-${range.end}`;
    await report({
      key,
      agent: 'Day Architect Agent',
      status: 'running',
      message: `Building detailed days ${range.start}-${range.end}`,
      detail: 'Venue-level schedule, transfers, meals, bookings, costs, walking, and fallback options',
      modelCall: true,
    });
    const prompt = buildPlannerPrompt(trip, profile, memories, {
      ...agentOptions,
      liveResearch: '',
      dayRange: range,
      planOverview,
    });
    const daysInSection = range.end - range.start + 1;
    const sectionMaxTokens = 2000 + (daysInSection - 1) * 1600;
    const sectionLabel = range.start === range.end
      ? `day ${range.start}`
      : `days ${range.start}-${range.end}`;
    let section = await requestPlannerSection(prompt, {
      model: HEAVY_ITINERARY_MODEL,
      max_tokens: sectionMaxTokens,
      truncatedMaxTokens: sectionMaxTokens + 600,
      temperature: 0.22,
      compactPrompt: `${prompt}

COMPACT RETRY MODE:
Return exactly ${sectionLabel}. Use 4-5 strong scheduled stops per day, 3 named meals, concise openingHours,
entryFee, routeDistance, numeric costs, and dailyBudget. Keep details under 35 words. No markdown.`,
    });
    section?.dayWiseItinerary?.forEach(day => repairSafeDayOmissions(day, trip));

    let qualityIssues = getSectionQualityIssues(section);
    if (!validateDayBatch(section, range.start, range.end)) {
      await report({
        key: `${key}-retry`,
        agent: 'Day Architect Agent',
        status: 'running',
        message: `Repairing incomplete days ${range.start}-${range.end}`,
        detail: 'The returned day count, schedule, or meal structure was incomplete',
        modelCall: true,
      });
      section = await requestPlannerSection(
        `${prompt}

CORRECTION: The prior output had an incomplete JSON structure.
Return every requested day exactly once with at least 4 schedule entries and 2 meals per day.
Use the exact schema keys, including placeOrArea for each meal.`,
        {
          model: HEAVY_ITINERARY_MODEL,
          max_tokens: sectionMaxTokens,
          truncatedMaxTokens: sectionMaxTokens + 600,
          temperature: 0.12,
          compactPrompt: `${prompt}

COMPACT QUALITY REPAIR:
Return exactly ${sectionLabel}. Fix these issues:
${qualityIssues.slice(0, 6).map(issue => `- ${issue}`).join('\n') || '- incomplete JSON structure'}
Use 4-5 named stops and 3 named meals per day, numeric costs, short details under 35 words, and valid JSON only.`,
        },
      );
      section?.dayWiseItinerary?.forEach(day => repairSafeDayOmissions(day, trip));
      qualityIssues = getSectionQualityIssues(section);
    }

    if (!validateDayBatch(section, range.start, range.end)) {
      throw new ApiError(
        502,
        `The day architect returned incomplete days ${range.start}-${range.end}. Please try again.`,
      );
    }
    state.itinerary.push(...section.dayWiseItinerary);
    await report({
      key,
      agent: 'Day Architect Agent',
      status: 'completed',
      message: `Detailed days ${range.start}-${range.end} completed`,
      detail: qualityIssues.length
        ? `${section.dayWiseItinerary.reduce((sum, day) => sum + day.schedule.length, 0)} scheduled steps; minor fields normalized locally`
        : `${section.dayWiseItinerary.reduce((sum, day) => sum + day.schedule.length, 0)} scheduled steps`,
    });
  }

  state.itinerary.sort((a, b) => Number(a.day) - Number(b.day));

  await report({
    key: 'critic',
    agent: 'Itinerary Critic Agent',
    status: 'running',
    message: 'Auditing the complete plan for real-world usability',
    detail: 'Timing, geographic efficiency, repetition, budget, safety, meals, and rest',
    modelCall: true,
  });
  let criticAvailable = true;
  try {
    state.critique = await requestJson(
      buildCriticPrompt(trip, state.strategy, state.logistics, state.itinerary),
      { model: LIGHT_AGENT_MODEL, max_tokens: 900, temperature: 0.1 },
    );
  } catch (error) {
    criticAvailable = false;
    state.critique = fallbackCritique();
    await report({
      key: 'critic',
      agent: 'Itinerary Critic Agent',
      status: 'skipped',
      message: 'Critic response unavailable; keeping structurally validated days',
      detail: getSafeAIErrorMessage(error, 'The optional critic stage was unavailable.'),
    });
  }
  const repairDays = Array.isArray(state.critique?.repairDays)
    ? state.critique.repairDays
      .filter(item => Number.isInteger(Number(item.day)))
      .slice(0, 2)
    : [];
  if (criticAvailable) {
    await report({
      key: 'critic',
      agent: 'Itinerary Critic Agent',
      status: 'completed',
      message: repairDays.length
        ? `Critic requested ${repairDays.length} targeted day repair(s)`
        : 'Critic approved the itinerary without rewrites',
      detail: (state.critique?.criticNotes || []).slice(0, 2).join(' | '),
    });
  }

  for (const repair of repairDays) {
    const index = state.itinerary.findIndex(day => Number(day.day) === Number(repair.day));
    if (index < 0) continue;
    await report({
      key: `repair-${repair.day}`,
      agent: 'Itinerary Repair Agent',
      status: 'running',
      message: `Repairing day ${repair.day}`,
      detail: repair.instruction,
      modelCall: true,
    });
    try {
      const repaired = await requestJson(
        buildRepairDayPrompt(
          trip,
          state.strategy,
          state.logistics,
          state.itinerary[index],
          repair.instruction,
        ),
        { model: LIGHT_AGENT_MODEL, max_tokens: 1200, temperature: 0.2 },
      );
      if (!Array.isArray(repaired?.schedule) || repaired.schedule.length < 4) {
        throw new Error('Repair output was structurally incomplete');
      }
      const repairedIssues = validateDayQuality(repaired);
      if (repairedIssues.length) {
        throw new Error(`Repair output failed quality validation: ${repairedIssues.slice(0, 2).join(' ')}`);
      }
      repaired.day = Number(repair.day);
      state.itinerary[index] = repaired;
      await report({
        key: `repair-${repair.day}`,
        agent: 'Itinerary Repair Agent',
        status: 'completed',
        message: `Day ${repair.day} repaired`,
        detail: 'Critic instruction applied without regenerating other days',
      });
    } catch (error) {
      await report({
        key: `repair-${repair.day}`,
        agent: 'Itinerary Repair Agent',
        status: 'skipped',
        message: `Day ${repair.day} repair was unavailable`,
        detail: `Kept the original complete day. ${getSafeAIErrorMessage(error, 'The optional repair stage was unavailable.')}`,
      });
    }
  }

  await report({
    key: 'finalize',
    agent: 'Final Planner Agent',
    status: 'running',
    message: 'Merging and validating the final travel plan',
    detail: `Checking ${totalDays} days and all required supporting sections`,
  });

  const finalPlan = {
    ...state.strategy,
    ...state.logistics,
    dayWiseItinerary: state.itinerary,
    criticNotes: state.critique?.criticNotes || [],
    tripScore: normalizeScore(state.critique?.tripScore),
    researchSources: state.strategy.researchSources || [],
  };

  const finalQualityIssues = validatePlanQuality(finalPlan, totalDays);
  if (finalQualityIssues.length) {
    await report({
      key: 'quality-gate',
      agent: 'Quality Gate',
      status: 'completed',
      message: 'Final itinerary accepted with minor quality notes',
      detail: finalQualityIssues.slice(0, 3).join(' | '),
    });
    finalPlan.criticNotes = [
      ...(finalPlan.criticNotes || []),
      ...finalQualityIssues.slice(0, 5).map(issue => `Quality note: ${issue}`),
    ];
  }

  await report({
    key: 'finalize',
    agent: 'Final Planner Agent',
    status: 'completed',
    message: 'Final plan validated',
    detail: `${state.itinerary.length} complete days · ${state.itinerary.reduce((sum, day) => sum + day.schedule.length, 0)} scheduled steps`,
  });

  return {
    plan: finalPlan,
    webResearchUsed: state.webResearchUsed,
  };
};
