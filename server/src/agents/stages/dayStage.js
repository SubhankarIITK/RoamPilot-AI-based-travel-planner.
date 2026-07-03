import ApiError from '../../utils/ApiError.js';
import { buildPlannerPrompt } from '../../prompts/plannerPrompt.js';
import {
  getSectionQualityIssues,
  repairSafeDayOmissions,
  validateDayBatch,
} from './stageSupport.js';

const MODEL = process.env.GROQ_ITINERARY_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';

export const getAdaptiveBatchSize = totalDays => {
  const policyLimit = totalDays > 17 ? 1 : totalDays > 7 ? 2 : 3;
  const configured = Number(process.env.GROQ_ITINERARY_BATCH_SIZE);
  return Number.isInteger(configured) && configured > 0
    ? Math.max(1, Math.min(policyLimit, configured))
    : policyLimit;
};

const buildMissingRanges = (totalDays, batchSize, completedDays) => {
  const ranges = [];
  let day = 1;
  while (day <= totalDays) {
    if (completedDays.has(day)) {
      day += 1;
      continue;
    }
    const start = day;
    let end = day;
    while (
      end < totalDays &&
      end - start + 1 < batchSize &&
      !completedDays.has(end + 1)
    ) {
      end += 1;
    }
    ranges.push({ start, end });
    day = end + 1;
  }
  return ranges;
};

const usedMajorPlaces = itinerary => {
  const seen = new Set();
  return itinerary.flatMap(day => day.schedule || [])
    .map(item => String(item.location || item.activity || '').trim())
    .filter(place => {
      const key = place.toLowerCase();
      if (!place || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 60);
};

const compactEvidenceForRange = (evidence, strategy, range, usedPlaces) => {
  if (!evidence) return null;
  const areas = (strategy?.dayThemes || [])
    .filter(theme => Number(theme.day) >= range.start && Number(theme.day) <= range.end)
    .map(theme => String(theme.primaryArea || '').toLowerCase())
    .filter(Boolean);
  const used = new Set(usedPlaces.map(place => place.toLowerCase()));
  const places = (evidence.places || []).filter(place =>
    !used.has(String(place.name || '').toLowerCase()));
  const relevant = places.filter(place => {
    const haystack = `${place.name || ''} ${place.address || ''}`.toLowerCase();
    return areas.some(area => haystack.includes(area) || area.includes(haystack));
  });
  const selected = [...relevant, ...places]
    .filter((place, index, all) =>
      all.findIndex(candidate => candidate.placeId === place.placeId) === index)
    .slice(0, 12);
  return {
    ...evidence,
    places: selected,
  };
};

const compactOverviewForRange = (strategy, logistics, range, usedPlaces) => ({
  summary: strategy?.summary,
  route: strategy?.route,
  dayThemes: (strategy?.dayThemes || []).filter(theme =>
    Number(theme.day) >= range.start && Number(theme.day) <= range.end),
  experiencePolicy: strategy?.experiencePolicy || null,
  budgetBreakdown: logistics?.budgetBreakdown,
  dailySpendingTargets: (logistics?.dailySpendingTargets || []).filter(target =>
    Number(target.day) >= range.start && Number(target.day) <= range.end),
  transportStrategy: (logistics?.transportStrategy || []).slice(0, 6),
  hotelSuggestions: (logistics?.hotelSuggestions || []).slice(0, 4),
  usedMajorPlaces,
});

export default async function dayStage(context) {
  const {
    trip, profile, memories, totalDays, options: agentOptions,
    requestPlannerSection, report, persistBatch,
  } = context;
  const completedDays = new Set(
    (context.itinerary || []).map(day => Number(day.day)).filter(Number.isInteger),
  );
  const batchSize = getAdaptiveBatchSize(totalDays);
  const ranges = buildMissingRanges(totalDays, batchSize, completedDays);

  if (completedDays.size) {
    await report({
      key: 'resume-days',
      agent: 'Day Architect Agent',
      status: 'completed',
      message: `Resuming after ${completedDays.size} saved day(s)`,
      detail: `Generation continues from the first missing day; completed batches will not be regenerated`,
    });
  }

  while (ranges.length) {
    if (
      Number.isFinite(Number(agentOptions?.deadlineAt)) &&
      Date.now() > Number(agentOptions.deadlineAt) - 60_000
    ) {
      const completedCount = context.itinerary.length;
      await report({
        key: 'deployment-checkpoint',
        agent: 'Deployment Capacity Manager',
        status: 'skipped',
        message: 'Saved progress before the hosting time limit',
        detail: `${completedCount}/${totalDays} day(s) are safe; resume to continue without regeneration`,
      });
      throw new ApiError(
        503,
        `Planning progress was safely saved through day ${completedCount}. Resume to continue within the hosting time limit.`,
      );
    }
    const range = ranges.shift();
    const key = `days-${range.start}-${range.end}`;
    const daysInSection = range.end - range.start + 1;
    const sectionLabel = range.start === range.end
      ? `day ${range.start}`
      : `days ${range.start}-${range.end}`;
    const usedPlaces = usedMajorPlaces(context.itinerary);
    const planOverview = compactOverviewForRange(
      context.strategy,
      context.logistics,
      range,
      usedPlaces,
    );
    const rangeEvidence = compactEvidenceForRange(
      context.factualEvidence,
      context.strategy,
      range,
      usedPlaces,
    );

    await persistBatch({
      key,
      startDay: range.start,
      endDay: range.end,
      status: 'running',
      attempts: 1,
    });
    await report({
      key,
      agent: 'Day Architect Agent',
      status: 'running',
      message: `Building detailed days ${range.start}-${range.end}`,
      detail: `${batchSize}-day maximum batch · completed immediately after validation`,
      modelCall: true,
    });

    const prompt = buildPlannerPrompt(trip, profile, memories, {
      ...agentOptions,
      liveResearch: '',
      factualEvidence: rangeEvidence,
      dayRange: range,
      planOverview,
    });
    const sectionMaxTokens = daysInSection === 1 ? 2100 : 3400;
    let section;
    let qualityIssues = [];
    try {
      section = await requestPlannerSection(prompt, {
        model: MODEL,
        max_tokens: sectionMaxTokens,
        truncatedMaxTokens: sectionMaxTokens + 400,
        temperature: 0.2,
        compactPrompt: `${prompt}

COMPACT RETRY MODE:
Return exactly ${sectionLabel}. Use 4 strong scheduled stops per day, 3 named meals, concise factual fields,
numeric costs, and dailyBudget. Keep details under 28 words. No markdown.`,
      });
      section?.dayWiseItinerary?.forEach(day =>
        repairSafeDayOmissions(day, trip, rangeEvidence));
      qualityIssues = getSectionQualityIssues(section);
    } catch (error) {
      if (daysInSection > 1) {
        await persistBatch({
          key,
          startDay: range.start,
          endDay: range.end,
          status: 'repaired',
          attempts: 1,
          error: 'Split into single-day batches after a bounded generation failure',
        });
        await report({
          key,
          agent: 'Day Architect Agent',
          status: 'skipped',
          message: `Batch ${range.start}-${range.end} paused; retrying one day at a time`,
          detail: `Saved days are preserved and only this section is being reduced`,
        });
        for (let day = range.end; day >= range.start; day -= 1) {
          ranges.unshift({ start: day, end: day });
        }
        continue;
      }
      await persistBatch({
        key,
        startDay: range.start,
        endDay: range.end,
        status: 'failed',
        attempts: 1,
        error: 'The model could not complete this saved day section',
      });
      throw new ApiError(
        502,
        `Planning progress was saved through day ${Math.max(0, range.start - 1)}. Retry to resume from day ${range.start}.`,
      );
    }

    if (!validateDayBatch(section, range.start, range.end)) {
      if (daysInSection > 1) {
        await persistBatch({
          key,
          startDay: range.start,
          endDay: range.end,
          status: 'repaired',
          attempts: 1,
          error: 'Incomplete batch split into single-day generation',
        });
        await report({
          key,
          agent: 'Day Architect Agent',
          status: 'skipped',
          message: `Batch ${range.start}-${range.end} was incomplete; retrying one day at a time`,
          detail: 'No completed earlier batch will be regenerated',
        });
        for (let day = range.end; day >= range.start; day -= 1) {
          ranges.unshift({ start: day, end: day });
        }
        continue;
      }

      await report({
        key: `${key}-retry`,
        agent: 'Day Architect Agent',
        status: 'running',
        message: `Repairing incomplete day ${range.start}`,
        detail: 'One final single-day schema correction',
        modelCall: true,
      });
      section = await requestPlannerSection(`${prompt}

CORRECTION: Return day ${range.start} exactly once with at least 4 schedule entries and 2 named meals.
Fix these issues:
${qualityIssues.slice(0, 6).map(issue => `- ${issue}`).join('\n') || '- incomplete JSON structure'}
Return valid JSON only.`, {
        model: MODEL,
        max_tokens: 2300,
        truncatedMaxTokens: 2600,
        temperature: 0.1,
      });
      section?.dayWiseItinerary?.forEach(day =>
        repairSafeDayOmissions(day, trip, rangeEvidence));
      qualityIssues = getSectionQualityIssues(section);
    }

    if (!validateDayBatch(section, range.start, range.end)) {
      await persistBatch({
        key,
        startDay: range.start,
        endDay: range.end,
        status: 'failed',
        attempts: 2,
        error: 'The day remained structurally incomplete after one targeted retry',
      });
      throw new ApiError(
        502,
        `Planning progress was saved through day ${Math.max(0, range.start - 1)}. Retry to resume from day ${range.start}.`,
      );
    }

    context.itinerary.push(...section.dayWiseItinerary);
    context.itinerary.sort((left, right) => Number(left.day) - Number(right.day));
    await persistBatch({
      key,
      startDay: range.start,
      endDay: range.end,
      status: 'completed',
      attempts: 1,
      days: section.dayWiseItinerary,
    });
    await report({
      key,
      agent: 'Day Architect Agent',
      status: 'completed',
      message: `Detailed days ${range.start}-${range.end} completed and saved`,
      detail: qualityIssues.length
        ? `${section.dayWiseItinerary.length} day(s) persisted; minor fields normalized locally`
        : `${section.dayWiseItinerary.length} day(s) persisted for safe resume`,
    });
  }
  return context;
}
