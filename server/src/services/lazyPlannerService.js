import { createHash } from 'node:crypto';
import { buildPlannerPrompt } from '../prompts/plannerPrompt.js';
import {
  getCriticalPlanQualityIssues,
  normalizeScore,
  repairSafeDayOmissions,
  validateDayQuality,
  validatePlanQuality,
} from '../agents/stages/stageSupport.js';
import { applyTravelIntelligenceToPlan } from './travelIntelligenceService.js';
import { buildDestinationCoveragePlan } from './experiencePolicyService.js';

export const LAZY_ARCHITECTURE_VERSION = 2;
export const LAZY_FOUNDATION_PROMPT_VERSION = 'lazy-foundation-v2';
export const LAZY_DAY_PROMPT_VERSION = 'lazy-day-v2';

const normalizeText = value =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const numericMinutes = value => {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
};

const clone = value => structuredClone(value ?? null);

export const createLazyInputSignature = ({ trip, instructions, planningAnswers, useWebSearch }) =>
  createHash('sha256').update(JSON.stringify({
    trip: {
      title: trip.title,
      origin: trip.origin,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      travelers: trip.travelers,
      budget: trip.budget,
      budgetMode: trip.budgetMode,
      currency: trip.currency,
      travelStyle: trip.travelStyle,
      planningMode: trip.planningMode,
      mustVisitPlaces: trip.mustVisitPlaces,
      avoidList: trip.avoidList,
      notes: trip.notes,
    },
    instructions: String(instructions || '').trim(),
    planningAnswers: planningAnswers || {},
    useWebSearch: useWebSearch !== false,
    architectureVersion: LAZY_ARCHITECTURE_VERSION,
    promptVersion: LAZY_FOUNDATION_PROMPT_VERSION,
  })).digest('hex');

const getDailyTarget = (logistics, day) =>
  logistics?.dailySpendingTargets?.find(item => Number(item.day) === Number(day)) || {};

const reservedPlacesForDay = (trip, theme) => {
  const areaKey = normalizeText(theme?.primaryArea);
  const haystack = normalizeText(
    `${theme?.theme || ''} ${theme?.primaryArea || ''} ${(theme?.mustAccomplish || []).join(' ')}`,
  );
  return (trip.mustVisitPlaces || []).filter(place => {
    const key = normalizeText(place);
    return key && (haystack.includes(key) || (areaKey && key.includes(areaKey)));
  });
};

export const buildDaySkeletons = (trip, foundation, planningAnswers = {}) => {
  const themes = foundation?.strategy?.dayThemes || [];
  const coverage = buildDestinationCoveragePlan({
    trip,
    foundation,
    factualEvidence: foundation?.factualEvidence,
    planningAnswers,
  });
  foundation.strategy.experiencePolicy = coverage.policy;
  foundation.strategy.destinationHighlights = coverage.selectedPlaces.map(place => ({
    name: place.name,
    placeId: place.placeId,
    zone: place.zone,
    category: place.category,
    source: place.source,
    priority: place.required ? 'essential' : 'recommended',
    whyVisit: place.whyVisit || '',
  }));
  return themes.map((theme, index) => {
    const previous = themes[index - 1];
    const next = themes[index + 1];
    const budget = getDailyTarget(foundation?.logistics, theme.day);
    const requiredPlaces = coverage.dayAssignments.get(Number(theme.day)) || [];
    const experienceCount = Math.max(1, coverage.policy.experienceTypes.length);
    const experienceRequirements = [
      coverage.policy.experienceTypes[index % experienceCount],
      coverage.policy.experienceTypes[(index + 1) % experienceCount],
    ].filter(Boolean);
    theme.anchorPlaces = requiredPlaces.map(place => place.name);
    theme.experienceTypes = experienceRequirements;
    return {
      day: Number(theme.day),
      date: theme.date || null,
      cityZone: theme.primaryArea || trip.destination,
      theme: theme.theme,
      roughPace: trip.travelStyle || 'balanced',
      budgetEnvelope: Number(budget.target) || 0,
      budgetReason: budget.reason || '',
      preferredCategories: [...new Set([
        ...experienceRequirements,
        ...(theme.mustAccomplish || []),
      ])].slice(0, 6),
      reservedMustVisitPlaces: reservedPlacesForDay(trip, theme),
      requiredPlaces,
      experienceRequirements,
      minPrimaryExperiences: coverage.policy.mainExperiencesPerFullDay,
      attractionRule: coverage.policy.attractionRule,
      hotelRule: coverage.policy.hotelRule,
      mustAccomplish: theme.mustAccomplish || [],
      routeReason: theme.reason || '',
      previousDayContinuity: previous
        ? `Continue from ${previous.primaryArea || previous.theme}`
        : `Arrival or first-day start from ${trip.origin || 'the confirmed arrival point'}`,
      nextDayContinuity: next
        ? `Finish ready for ${next.primaryArea || next.theme}`
        : 'Finish with departure and final-night logistics resolved',
      status: 'pending_detail_generation',
    };
  });
};

export const buildLazyPlanShell = ({ trip, lazyPlan }) => {
  const strategy = lazyPlan.foundation?.strategy || {};
  const logistics = lazyPlan.foundation?.logistics || {};
  const completedDays = lazyPlan.days
    .filter(day => ['completed', 'needs_repair'].includes(day.status) && day.detail)
    .map(day => clone(day.detail))
    .sort((left, right) => Number(left.day) - Number(right.day));
  return {
    ...clone(strategy),
    ...clone(logistics),
    dayWiseItinerary: completedDays,
    criticNotes: lazyPlan.validationIssues?.map(issue => issue.message) || [],
    tripScore: lazyPlan.finalizedPlan?.tripScore || null,
    generationContext: {
      ...(trip.aiPlan?.generationContext || {}),
      lazyGeneration: true,
      architectureVersion: lazyPlan.architectureVersion,
      promptVersion: lazyPlan.promptVersion,
      planningStatus: lazyPlan.status,
      completedDays: completedDays.length,
      totalDays: lazyPlan.days.length,
      webResearchUsed: Boolean(lazyPlan.foundation?.webResearchUsed),
      dataProviders: lazyPlan.foundation?.factualEvidence?.providerUsage || [],
    },
  };
};

export const serializeLazyPlan = lazyPlan => {
  const source = lazyPlan?.toObject ? lazyPlan.toObject() : lazyPlan;
  if (!source) return null;
  const completed = (source.days || []).filter(day => day.status === 'completed').length;
  const repair = (source.days || []).filter(day => day.status === 'needs_repair').length;
  return {
    id: source._id,
    tripId: source.tripId,
    status: source.status,
    architectureVersion: source.architectureVersion,
    promptVersion: source.promptVersion,
    completedDays: completed,
    totalDays: source.days?.length || 0,
    needsRepairDays: repair,
    canFinalize:
      (source.days?.length || 0) > 0 &&
      completed + repair === (source.days?.length || 0),
    days: (source.days || []).map(day => ({
      day: day.day,
      skeleton: day.skeleton,
      detail: day.detail,
      status: day.status,
      validationIssues: day.validationIssues || [],
      retryCount: day.retryCount || 0,
      repairCount: day.repairCount || 0,
      version: day.version || 1,
      lastError: day.lastError || '',
      generatedAt: day.generatedAt,
    })),
    validationIssues: source.validationIssues || [],
    lastError: source.lastError || '',
    dataProviders:
      source.factualEvidence?.providerUsage ||
      source.foundation?.factualEvidence?.providerUsage ||
      [],
    foundation: {
      strategy: source.foundation?.strategy || {},
      logistics: source.foundation?.logistics || {},
    },
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

const compactEvidenceForSkeleton = (evidence, skeleton, usedPlaceIds) => {
  if (!evidence) return null;
  const area = normalizeText(skeleton?.cityZone);
  const used = new Set((usedPlaceIds || []).map(String));
  const available = (evidence.places || []).filter(place => !used.has(String(place.placeId)));
  const requiredNames = new Set(
    (skeleton?.requiredPlaces || []).map(place => normalizeText(place.name)),
  );
  const required = available.filter(place => requiredNames.has(normalizeText(place.name)));
  const isSupport = place => ['hotel', 'restaurant', 'cafe'].includes(place.type);
  const experiences = available.filter(place => !isSupport(place));
  const relevant = experiences.filter(place => {
    const text = normalizeText(`${place.name} ${place.address} ${(place.categories || []).join(' ')}`);
    return area && (text.includes(area) || area.includes(normalizeText(place.name)));
  });
  const restaurants = available.filter(place => place.type === 'restaurant').slice(0, 4);
  const cafes = available.filter(place => place.type === 'cafe').slice(0, 2);
  const hotels = available.filter(place => place.type === 'hotel').slice(0, 1);
  return {
    ...clone(evidence),
    places: [
      ...required,
      ...relevant.slice(0, 10),
      ...experiences.slice(0, 10),
      ...restaurants,
      ...cafes,
      ...hotels,
    ]
      .filter((place, index, all) =>
        all.findIndex(candidate => candidate.placeId === place.placeId) === index)
      .slice(0, 20),
  };
};

const previousDaySummary = day => day ? {
  day: day.day,
  theme: day.theme,
  endArea: day.endArea,
  finalStop: day.schedule?.at(-1)?.location || '',
  finishTime: day.schedule?.at(-1)?.time || '',
} : null;

const toIssue = (message, day, severity = 'critical') => ({
  code: normalizeText(message).replaceAll(' ', '_').slice(0, 80) || 'day_quality_issue',
  severity,
  message,
  day: Number(day),
});

const collectUsedPlaces = days => {
  const ids = new Set();
  days.forEach(day => {
    [...(day.detail?.schedule || []), ...(day.detail?.meals || [])].forEach(item => {
      if (item.placeId) ids.add(String(item.placeId));
    });
  });
  return [...ids];
};

const getDuplicateIssues = (candidate, days) => {
  const usedStops = new Map();
  const usedMeals = new Map();
  days.forEach(day => {
    if (!day.detail || Number(day.day) === Number(candidate.day)) return;
    (day.detail.schedule || []).forEach(item => {
      const key = item.placeId || normalizeText(item.location || item.placeOrArea || item.activity);
      if (key) usedStops.set(String(key), Number(day.day));
    });
    (day.detail.meals || []).forEach(item => {
      const key = item.placeId || normalizeText(item.placeOrArea);
      if (key) usedMeals.set(String(key), Number(day.day));
    });
  });
  const issues = [];
  (candidate.schedule || []).forEach(item => {
    const label = String(item.location || item.activity || '');
    if (/airport|station|hotel|accommodation|transfer|road|highway/i.test(label)) return;
    const key = item.placeId || normalizeText(label);
    if (key && usedStops.has(String(key))) {
      issues.push(toIssue(
        `Place "${label}" repeats day ${usedStops.get(String(key))}`,
        candidate.day,
      ));
    }
  });
  (candidate.meals || []).forEach(item => {
    const label = String(item.placeOrArea || '');
    if (/hotel|resort|homestay|accommodation/i.test(label)) return;
    const key = item.placeId || normalizeText(label);
    if (key && usedMeals.has(String(key))) {
      issues.push(toIssue(
        `Food place "${label}" repeats day ${usedMeals.get(String(key))}`,
        candidate.day,
        'warning',
      ));
    }
  });
  return issues;
};

const getContinuityIssues = (candidate, previousDetail) => {
  if (!previousDetail) return [];
  const previousArea = normalizeText(previousDetail.endArea);
  const currentArea = normalizeText(candidate.startArea);
  const firstStop = candidate.schedule?.[0];
  if (
    previousArea &&
    currentArea &&
    previousArea !== currentArea &&
    numericMinutes(firstStop?.travelTime) === 0 &&
    !/transfer|train|flight|drive|bus|ferry/i.test(String(firstStop?.activity || ''))
  ) {
    return [toIssue(
      `Day ${candidate.day} must include the transfer from ${previousDetail.endArea} to ${candidate.startArea}`,
      candidate.day,
    )];
  }
  return [];
};

const getBudgetIssues = (candidate, skeleton) => {
  const envelope = Number(skeleton?.budgetEnvelope) || 0;
  const total = Number(candidate?.dailyBudget?.total) || 0;
  if (!envelope || !total) return [];
  const deviation = Math.abs(total - envelope) / envelope;
  return deviation > 0.45
    ? [toIssue(
      `Day ${candidate.day} budget ${total} is outside its ${envelope} planning envelope`,
      candidate.day,
      'warning',
    )]
    : [];
};

const getCoverageIssues = (candidate, skeleton) => {
  const searchableStops = (candidate.schedule || []).map(item => ({
    id: String(item.placeId || ''),
    text: normalizeText(`${item.location || ''} ${item.activity || ''}`),
  }));
  const missing = (skeleton?.requiredPlaces || []).filter(place => {
    const requiredId = String(place.placeId || '');
    const requiredName = normalizeText(place.name);
    return !searchableStops.some(stop =>
      (requiredId && stop.id === requiredId) ||
      (requiredName && stop.text && (
        stop.text.includes(requiredName) ||
        requiredName.includes(stop.text)
      )));
  });
  const issues = missing.map(place => toIssue(
    `Day ${candidate.day} is missing required destination experience "${place.name}"`,
    candidate.day,
  ));
  const primaryExperiences = (candidate.schedule || []).filter(item => {
    const text = normalizeText(`${item.activity || ''} ${item.location || ''}`);
    return !/hotel|check in|check out|breakfast|lunch|dinner|transfer|airport|station|drive/
      .test(text);
  });
  const minimum = Number(skeleton?.minPrimaryExperiences) || 2;
  if (primaryExperiences.length < minimum) {
    issues.push(toIssue(
      `Day ${candidate.day} needs ${minimum} real place visits or destination experiences; hotel and transfer time do not count`,
      candidate.day,
    ));
  }
  const hotelStops = (candidate.schedule || []).filter(item =>
    /hotel|resort|homestay|check in|check out|rest at/i
      .test(`${item.activity || ''} ${item.location || ''}`));
  if (hotelStops.length > 1) {
    issues.push(toIssue(
      `Day ${candidate.day} overuses hotel time; keep only necessary check-in or check-out logistics`,
      candidate.day,
    ));
  }
  return issues;
};

export const generateLazyDayDetail = async ({
  trip,
  lazyPlan,
  dayNumber,
  requestPlannerSection,
  instruction = '',
}) => {
  const dayRecord = lazyPlan.days.find(day => Number(day.day) === Number(dayNumber));
  if (!dayRecord) throw new Error('Lazy day not found');
  const previousRecord = lazyPlan.days.find(day =>
    Number(day.day) === Number(dayNumber) - 1 && day.detail);
  const nextRecord = lazyPlan.days.find(day => Number(day.day) === Number(dayNumber) + 1);
  const otherDays = lazyPlan.days.filter(day => Number(day.day) !== Number(dayNumber));
  const usedPlaceIds = collectUsedPlaces(otherDays);
  const evidence = compactEvidenceForSkeleton(
    lazyPlan.factualEvidence,
    dayRecord.skeleton,
    usedPlaceIds,
  );
  const foundation = lazyPlan.foundation;
  const planOverview = {
    summary: foundation.strategy?.summary,
    route: foundation.strategy?.route,
    dayThemes: foundation.strategy?.dayThemes,
    budgetBreakdown: foundation.logistics?.budgetBreakdown,
    dailySpendingTargets: foundation.logistics?.dailySpendingTargets,
    transportStrategy: foundation.logistics?.transportStrategy,
    hotelSuggestions: foundation.logistics?.hotelSuggestions,
    experiencePolicy: foundation.strategy?.experiencePolicy,
    usedMajorPlaces: otherDays.flatMap(day =>
      day.detail?.schedule?.map(item => item.location || item.activity) || []),
  };
  const basePrompt = buildPlannerPrompt(trip, null, [], {
    ...lazyPlan.generationOptions,
    factualEvidence: evidence,
    liveResearch: foundation.research || '',
    dayRange: { start: Number(dayNumber), end: Number(dayNumber) },
    planOverview,
  });
  const prompt = `${basePrompt}

LAZY DAY CONTRACT:
- Approved day skeleton: ${JSON.stringify(dayRecord.skeleton)}
- Previous generated day summary: ${JSON.stringify(previousDaySummary(previousRecord?.detail))}
- Next day skeleton: ${JSON.stringify(nextRecord?.skeleton || null)}
- Already used verified place IDs: ${JSON.stringify(usedPlaceIds)}
- Foundation constraints: ${JSON.stringify(foundation.strategy?.nonNegotiableConstraints || [])}
- Generate this day only. Preserve the foundation route, budget envelope, must-visits, and continuity.
- Do not reuse an already-used place ID unless it is a hotel, station, airport, or explicit multi-day base.
${instruction ? `- Explicit repair/regeneration instruction: ${String(instruction).slice(0, 700)}` : ''}`;
  const section = await requestPlannerSection(prompt, {
    max_tokens: 2300,
    truncatedMaxTokens: 2700,
    temperature: 0.2,
    compactPrompt: `${prompt}

COMPACT RETRY: Return one JSON day in dayWiseItinerary. Use exactly 4 strong stops,
3 named meals, concise fields, numeric costs, and no markdown.`,
  });
  const detail = section?.dayWiseItinerary?.[0];
  if (!detail) throw new Error('Day architect returned no day detail');
  detail.day = Number(dayNumber);
  repairSafeDayOmissions(detail, trip, evidence);
  applyTravelIntelligenceToPlan({ dayWiseItinerary: [detail] }, evidence);

  const issues = [
    ...validateDayQuality(detail).map(message => toIssue(message, dayNumber)),
    ...getDuplicateIssues(detail, lazyPlan.days),
    ...getContinuityIssues(detail, previousRecord?.detail),
    ...getBudgetIssues(detail, dayRecord.skeleton),
    ...getCoverageIssues(detail, dayRecord.skeleton),
  ];
  return {
    detail,
    issues: issues.filter((issue, index, all) =>
      all.findIndex(candidate => candidate.message === issue.message) === index),
    usedPlaceIds: collectUsedPlaces([
      ...lazyPlan.days.filter(day => Number(day.day) !== Number(dayNumber)),
      { detail },
    ]),
  };
};

export const getLazyPlanStatus = days => {
  const completed = days.filter(day => day.status === 'completed').length;
  const repair = days.filter(day => day.status === 'needs_repair').length;
  if (completed + repair === days.length) {
    return repair ? 'repair_required' : 'ready_to_finalize';
  }
  if (completed + repair > 0) return 'partially_generated';
  return 'foundation_ready';
};

export const assembleLazyPlan = ({ trip, lazyPlan }) => {
  const dayWiseItinerary = lazyPlan.days
    .filter(day => day.detail)
    .map(day => clone(day.detail))
    .sort((left, right) => Number(left.day) - Number(right.day));
  const base = {
    ...clone(lazyPlan.foundation.strategy),
    ...clone(lazyPlan.foundation.logistics),
    dayWiseItinerary,
    criticNotes: [],
    tripScore: normalizeScore(lazyPlan.finalizedPlan?.tripScore),
    generationContext: {
      customInstructions: lazyPlan.generationOptions?.instructions || '',
      planningAnswers: lazyPlan.generationOptions?.planningAnswers || {},
      webResearchUsed: Boolean(lazyPlan.foundation.webResearchUsed),
      dataProviders: lazyPlan.factualEvidence?.providerUsage || [],
      lazyGeneration: true,
      architectureVersion: lazyPlan.architectureVersion,
      promptVersion: lazyPlan.promptVersion,
      planningStatus: 'completed',
      completedDays: dayWiseItinerary.length,
      totalDays: lazyPlan.days.length,
    },
  };
  const plan = applyTravelIntelligenceToPlan(base, lazyPlan.factualEvidence);
  const factualStops = dayWiseItinerary.flatMap(day => day.schedule || []);
  const verifiedStops = factualStops.filter(item =>
    item.factualStatus === 'api-verified-place' || item.placeId).length;
  const coverage = factualStops.length
    ? Math.round((verifiedStops / factualStops.length) * 100)
    : 0;
  const qualityIssues = validatePlanQuality(plan, lazyPlan.days.length, trip);
  if (factualStops.length && coverage < 60) {
    qualityIssues.push(
      `only ${coverage}% of scheduled stops matched the available place evidence; unmatched facts are marked estimated`,
    );
  }
  const coverageIssues = lazyPlan.days.flatMap(day =>
    day.detail ? getCoverageIssues(day.detail, day.skeleton) : [])
    .filter(issue => issue.severity === 'critical')
    .map(issue => issue.message);
  qualityIssues.push(...coverageIssues);
  const criticalIssues = [
    ...getCriticalPlanQualityIssues(plan, lazyPlan.days.length, trip),
    ...coverageIssues,
  ].filter((issue, index, all) => all.indexOf(issue) === index);
  plan.criticNotes = qualityIssues
    .filter(issue => !criticalIssues.includes(issue))
    .slice(0, 8)
    .map(issue => `Quality note: ${issue}`);
  return { plan, qualityIssues, criticalIssues };
};
