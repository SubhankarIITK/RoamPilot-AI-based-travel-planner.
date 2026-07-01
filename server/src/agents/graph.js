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
import { applyTravelIntelligenceToPlan } from '../services/travelIntelligenceService.js';

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
  persistFoundation = async () => {},
  persistBatch = async () => {},
}) => {
  const resumeFoundation = options.resumeState?.foundation || null;
  const resumedItinerary = Array.isArray(options.resumeState?.partialItinerary)
    ? options.resumeState.partialItinerary
    : [];
  let context = {
    trip,
    profile,
    memories,
    options,
    researchTrip,
    requestJson,
    requestPlannerSection,
    report,
    persistFoundation,
    persistBatch,
    logger,
    totalDays: options.totalDays,
    research: resumeFoundation?.research || '',
    factualEvidence: resumeFoundation?.factualEvidence || null,
    webResearchUsed: Boolean(resumeFoundation?.webResearchUsed),
    strategy: null,
    logistics: null,
    itinerary: [...resumedItinerary],
    resumedDayCount: resumedItinerary.length,
    critique: null,
    repairDays: [],
    completedRepairDays: new Set(),
  };

  context.itinerary.forEach(day =>
    repairSafeDayOmissions(day, trip, context.factualEvidence));

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

  const finalPlan = applyTravelIntelligenceToPlan({
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
  }, context.factualEvidence);

  const qualityIssues = validatePlanQuality(finalPlan, context.totalDays, trip);
  const criticalIssues = getCriticalPlanQualityIssues(finalPlan, context.totalDays, trip);
  if (criticalIssues.length) {
    await report({
      key: 'quality-gate',
      agent: 'Quality Gate',
      status: 'failed',
      message: 'The itinerary still needs repair',
      detail: criticalIssues.slice(0, 3).join(' | '),
    });
    throw new ApiError(
      502,
      'All completed days are saved, but final validation found a targeted route or place issue. Retry to resume the repair without regenerating the itinerary.',
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
    providerUsage: context.factualEvidence?.providerUsage || [],
  };
};
