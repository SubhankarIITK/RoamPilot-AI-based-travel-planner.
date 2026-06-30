import ApiError from '../../utils/ApiError.js';
import { buildPlannerPrompt } from '../../prompts/plannerPrompt.js';
import {
  getSectionQualityIssues,
  repairSafeDayOmissions,
  validateDayBatch,
} from './stageSupport.js';

const MODEL = process.env.GROQ_ITINERARY_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';
const DEFAULT_MODEL_TOKEN_LIMIT = 131072;

const getPromptContext = (strategy, logistics, logger) => {
  const foundationSummary = JSON.stringify({ strategy, logistics });
  const tokenLimit = Number(process.env.GROQ_ITINERARY_CONTEXT_LIMIT) ||
    DEFAULT_MODEL_TOKEN_LIMIT;
  const estimatedTokens = foundationSummary.length * 0.25;
  if (estimatedTokens <= tokenLimit * 0.6) {
    return { planOverview: { ...strategy, ...logistics }, contextComment: '' };
  }

  logger.warn({ stage: 'DAY_BATCH', reason: 'context_trimmed' });
  return {
    planOverview: {
      foundationSummary: foundationSummary.slice(0, 1500),
      budgetBreakdown: logistics?.budgetBreakdown,
      transportStrategy: logistics?.transportStrategy,
      hotelSuggestions: logistics?.hotelSuggestions,
    },
    contextComment: '\n// context trimmed for token budget',
  };
};

export default async function dayStage(context) {
  const {
    trip, profile, memories, totalDays, agentOptions,
    requestPlannerSection, report, logger,
  } = context;
  const configuredBatchSize = Number(process.env.GROQ_ITINERARY_BATCH_SIZE);
  const batchSize = Number.isInteger(configuredBatchSize) && configuredBatchSize > 0
    ? Math.min(3, configuredBatchSize)
    : 3;
  const ranges = [];
  for (let start = 1; start <= totalDays; start += batchSize) {
    ranges.push({ start, end: Math.min(totalDays, start + batchSize - 1) });
  }

  const { planOverview, contextComment } = getPromptContext(
    context.strategy,
    context.logistics,
    logger,
  );
  while (ranges.length) {
    const range = ranges.shift();
    const key = `days-${range.start}-${range.end}`;
    await report({
      key,
      agent: 'Day Architect Agent',
      status: 'running',
      message: `Building detailed days ${range.start}-${range.end}`,
      detail: 'Venue-level schedule, transfers, meals, bookings, costs, walking, and fallback options',
      modelCall: true,
    });
    const basePrompt = buildPlannerPrompt(trip, profile, memories, {
      ...agentOptions,
      liveResearch: '',
      dayRange: range,
      planOverview,
    });
    const prompt = `${basePrompt}${contextComment}`;
    const daysInSection = range.end - range.start + 1;
    const sectionMaxTokens = 2000 + (daysInSection - 1) * 1600;
    const sectionLabel = range.start === range.end
      ? `day ${range.start}`
      : `days ${range.start}-${range.end}`;
    let section = await requestPlannerSection(prompt, {
      model: MODEL,
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
      if (daysInSection > 1) {
        const midpoint = Math.floor((range.start + range.end) / 2);
        await report({
          key,
          agent: 'Day Architect Agent',
          status: 'skipped',
          message: `Batch ${range.start}-${range.end} was incomplete; retrying smaller sections`,
          detail: `The workflow will continue with days ${range.start}-${midpoint} and ${midpoint + 1}-${range.end}`,
        });
        ranges.unshift(
          { start: range.start, end: midpoint },
          { start: midpoint + 1, end: range.end },
        );
        continue;
      }

      await report({
        key: `${key}-retry`,
        agent: 'Day Architect Agent',
        status: 'running',
        message: `Repairing incomplete day ${range.start}`,
        detail: 'The returned day count, schedule, or meal structure was incomplete',
        modelCall: true,
      });
      section = await requestPlannerSection(`${prompt}

CORRECTION: The prior output had an incomplete JSON structure.
Return every requested day exactly once with at least 4 schedule entries and 2 meals per day.
Use the exact schema keys, including placeOrArea for each meal.`, {
        model: MODEL,
        max_tokens: sectionMaxTokens,
        truncatedMaxTokens: sectionMaxTokens + 600,
        temperature: 0.12,
        compactPrompt: `${prompt}

COMPACT QUALITY REPAIR:
Return exactly ${sectionLabel}. Fix these issues:
${qualityIssues.slice(0, 6).map(issue => `- ${issue}`).join('\n') || '- incomplete JSON structure'}
Use 4-5 named stops and 3 named meals per day, numeric costs, short details under 35 words, and valid JSON only.`,
      });
      section?.dayWiseItinerary?.forEach(day => repairSafeDayOmissions(day, trip));
      qualityIssues = getSectionQualityIssues(section);
    }

    if (!validateDayBatch(section, range.start, range.end)) {
      throw new ApiError(502, `The day architect could not complete day ${range.start}. Please try again.`);
    }
    context.itinerary.push(...section.dayWiseItinerary);
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
  context.itinerary.sort((a, b) => Number(a.day) - Number(b.day));
  return context;
}
