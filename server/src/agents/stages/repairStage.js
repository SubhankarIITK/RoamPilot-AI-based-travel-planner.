import { buildRepairDayPrompt } from '../../prompts/plannerPrompt.js';
import { estimateInterAreaTransfer } from '../../services/travelIntelligenceService.js';
import { repairSafeDayOmissions, validateDayQuality } from './stageSupport.js';

const MODEL = process.env.GROQ_AGENT_MODEL ||
  process.env.GROQ_PLANNER_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';

const normalizePlace = value =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const isBroadArea = value =>
  /^(north|south|central|east|west)\b|\b(region|district|islands)\b/i
    .test(String(value || '').trim());

const localityFromStop = value => {
  const parts = String(value || '').split(',').map(part => part.trim()).filter(Boolean);
  const selected = parts.length > 1 ? parts.at(-1) : parts[0] || '';
  return selected
    .replace(/\b(beach|waterfall|market|fort|museum|park)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const findEvidencePlace = (value, evidence) => {
  const target = normalizePlace(value);
  return (evidence?.places || []).find(place => {
    const name = normalizePlace(place.name);
    return name === target ||
      (name.length >= 5 && target.includes(name)) ||
      (target.length >= 5 && name.includes(target));
  }) || null;
};

const getRouteEndpoint = (day, { fromEnd = false } = {}) => {
  const schedule = day?.schedule || [];
  const candidates = fromEnd ? [...schedule].reverse() : schedule.slice(1);
  for (const item of candidates) {
    const value = String(item?.location || item?.activity || '').trim();
    if (
      !value ||
      /start the day|begin at|hotel|restaurant|cafe|lunch|dinner|breakfast/i
        .test(`${item?.activity || ''} ${value}`)
    ) continue;
    const locality = localityFromStop(value);
    if (locality && !isBroadArea(locality)) return { value, locality };
  }
  return null;
};

const applyDeterministicTransferRepair = async (context, repair, index) => {
  if (!/transfer|continue from/i.test(String(repair.instruction || ''))) return null;
  const current = context.itinerary[index];
  const previous = context.itinerary.find(day =>
    Number(day.day) === Number(current.day) - 1);
  const previousEndArea = String(previous?.endArea || '').trim();
  const currentStartArea = String(current?.startArea || '').trim();
  if (!previousEndArea || !currentStartArea) return null;

  const fromStop = getRouteEndpoint(previous, { fromEnd: true });
  const toStop = getRouteEndpoint(current);
  const fromEvidence = findEvidencePlace(fromStop?.value, context.factualEvidence);
  const toEvidence = findEvidencePlace(toStop?.value, context.factualEvidence);
  const fromArea = isBroadArea(previousEndArea)
    ? fromStop?.locality || previousEndArea
    : previousEndArea;
  const toArea = isBroadArea(currentStartArea)
    ? toEvidence?.name || toStop?.locality || currentStartArea
    : currentStartArea;

  const routeLookup =
    context.estimateInterAreaTransfer || estimateInterAreaTransfer;
  const route = await routeLookup(fromArea, toArea, {
    fromLocation: fromEvidence,
    toLocation: toEvidence,
  });
  if (
    !route ||
    !Number.isFinite(Number(route.minutes)) ||
    !Number.isFinite(Number(route.distanceKm)) ||
    Number(route.minutes) > 8 * 60
  ) return null;

  const repaired = structuredClone(current);
  const firstStop = repaired.schedule?.[0] || {};
  repaired.startArea = previousEndArea;
  repaired.schedule[0] = {
    ...firstStop,
    time: firstStop.time || '08:00',
    duration: `${Math.round(route.minutes)} min`,
    activity: `Transfer from ${fromArea} to ${toArea}`,
    location: `${fromArea} to ${toArea}`,
    details:
      `Take a ${route.mode.toLowerCase()} from ${fromArea} to ${toArea}; ` +
      `${route.distanceKm} km and ${Math.round(route.minutes)} min using ${route.source}.`,
    travelTime: `${Math.round(route.minutes)} min (${route.source})`,
    transport: route.mode,
    routeDistance: `${route.distanceKm} km (${route.source})`,
    bookingRequired: true,
    bookingAdvice: 'Pre-book the transfer and reconfirm pickup time one day before departure.',
  };
  repairSafeDayOmissions(repaired, context.trip, context.factualEvidence);
  return repaired;
};

export default async function repairStage(context) {
  const { trip, requestJson, report, persistBatch } = context;
  context.completedRepairDays = new Set();
  for (const repair of context.repairDays) {
    const index = context.itinerary.findIndex(day => Number(day.day) === Number(repair.day));
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
      const prompt = buildRepairDayPrompt(
        trip,
        context.strategy,
        context.logistics,
        context.itinerary[index],
        repair.instruction,
      );
      const repaired = await requestJson(prompt, {
        model: MODEL,
        max_tokens: 2000,
        temperature: 0.18,
        retryPrompt: `${prompt}

COMPACT RETRY: Return one valid JSON day object only. Keep exactly 4 strong schedule
entries and 3 meals, preserve every schema key, and keep each text field under 25 words.`,
      });
      if (!Array.isArray(repaired?.schedule) || repaired.schedule.length < 4) {
        throw new Error('Repair output was structurally incomplete');
      }
      repairSafeDayOmissions(repaired, trip, context.factualEvidence);
      const repairedIssues = validateDayQuality(repaired);
      repaired.day = Number(repair.day);
      context.itinerary[index] = repaired;
      context.completedRepairDays.add(Number(repair.day));
      await persistBatch({
        key: `repair-day-${repair.day}`,
        startDay: Number(repair.day),
        endDay: Number(repair.day),
        status: 'repaired',
        attempts: 1,
        days: [repaired],
      });
      await report({
        key: `repair-${repair.day}`,
        agent: 'Itinerary Repair Agent',
        status: 'completed',
        message: `Day ${repair.day} repaired`,
        detail: repairedIssues.length
          ? `Critic instruction applied; ${repairedIssues.length} minor field note(s) remain`
          : 'Critic instruction applied without regenerating other days',
      });
    } catch {
      const fallback = await applyDeterministicTransferRepair(context, repair, index)
        .catch(() => null);
      if (fallback) {
        context.itinerary[index] = fallback;
        context.completedRepairDays.add(Number(repair.day));
        await persistBatch({
          key: `repair-day-${repair.day}`,
          startDay: Number(repair.day),
          endDay: Number(repair.day),
          status: 'repaired',
          attempts: 1,
          days: [fallback],
        });
        await report({
          key: `repair-${repair.day}`,
          agent: 'Itinerary Repair Agent',
          status: 'completed',
          message: `Day ${repair.day} transfer repaired with route data`,
          detail: 'The failed model repair was replaced using geocoding and OpenRouteService.',
        });
        continue;
      }
      await report({
        key: `repair-${repair.day}`,
        agent: 'Itinerary Repair Agent',
        status: 'skipped',
        message: `Day ${repair.day} repair was unavailable`,
        detail: 'The original complete day was kept because the optional refinement could not be applied.',
      });
    }
  }
  return context;
}
