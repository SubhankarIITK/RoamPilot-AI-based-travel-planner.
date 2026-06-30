import logger from '../services/logger.js';
import ApiError from '../utils/ApiError.js';
import intentStage from './stages/intentStage.js';
import researchStage from './stages/researchStage.js';
import foundationStage from './stages/foundationStage.js';
import dayStage from './stages/dayStage.js';
import criticStage from './stages/criticStage.js';
import repairStage from './stages/repairStage.js';
import {
  normalizeScore,
  getCriticalPlanQualityIssues,
  repairSafeDayOmissions,
  validatePlanQuality,
} from './stages/stageSupport.js';

export { repairSafeDayOmissions };

const stages = [
  intentStage,
  researchStage,
  foundationStage,
  dayStage,
  criticStage,
  repairStage,
];

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
  let context = {
    trip,
    profile,
    memories,
    options,
    researchTrip,
    requestJson,
    requestPlannerSection,
    report,
    logger,
    totalDays: options.totalDays,
    research: '',
    webResearchUsed: false,
    strategy: null,
    logistics: null,
    itinerary: [],
    critique: null,
    repairDays: [],
    completedRepairDays: new Set(),
  };

  for (const stage of stages) {
    context = await stage(context);
  }

  await report({
    key: 'finalize',
    agent: 'Final Planner Agent',
    status: 'running',
    message: 'Merging and validating the final travel plan',
    detail: `Checking ${context.totalDays} days and all required supporting sections`,
  });

  const finalPlan = {
    ...context.strategy,
    ...context.logistics,
    dayWiseItinerary: context.itinerary,
    criticNotes: (context.critique?.criticNotes || []).filter(note =>
      ![...context.completedRepairDays].some(day =>
        new RegExp(`\\bday\\s*${day}\\b`, 'i').test(String(note)),
      ),
    ),
    tripScore: normalizeScore(context.critique?.tripScore),
    researchSources: context.strategy.researchSources || [],
  };

  const qualityIssues = validatePlanQuality(finalPlan, context.totalDays, trip);
  const criticalIssues = getCriticalPlanQualityIssues(finalPlan, context.totalDays, trip);
  if (criticalIssues.length) {
    await report({
      key: 'quality-gate',
      agent: 'Quality Gate',
      status: 'failed',
      message: 'The itinerary still needs repair',
      detail: 'Budget totals or named-place details did not pass final validation.',
    });
    throw new ApiError(
      502,
      'The itinerary still needs repair because its budget totals or named-place details are incomplete. Please generate it again.',
    );
  }
  if (qualityIssues.length) {
    await report({
      key: 'quality-gate',
      agent: 'Quality Gate',
      status: 'completed',
      message: 'Final itinerary accepted with minor quality notes',
      detail: qualityIssues.slice(0, 3).join(' | '),
    });
    finalPlan.criticNotes = [
      ...(finalPlan.criticNotes || []),
      ...qualityIssues.slice(0, 5).map(issue => `Quality note: ${issue}`),
    ];
  }

  await report({
    key: 'finalize',
    agent: 'Final Planner Agent',
    status: 'completed',
    message: 'Final plan validated',
    detail: `${context.itinerary.length} complete days · ${context.itinerary.reduce(
      (sum, day) => sum + day.schedule.length,
      0,
    )} scheduled steps`,
  });

  return {
    plan: finalPlan,
    webResearchUsed: context.webResearchUsed,
  };
};
