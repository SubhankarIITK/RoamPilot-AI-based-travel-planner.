import { buildRepairDayPrompt } from '../../prompts/plannerPrompt.js';
import { getSafeAIErrorMessage } from '../../services/aiErrorService.js';
import { repairSafeDayOmissions, validateDayQuality } from './stageSupport.js';

const MODEL = process.env.GROQ_AGENT_MODEL ||
  process.env.GROQ_PLANNER_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';

export default async function repairStage(context) {
  const { trip, requestJson, report } = context;
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
      repairSafeDayOmissions(repaired, trip);
      const repairedIssues = validateDayQuality(repaired);
      repaired.day = Number(repair.day);
      context.itinerary[index] = repaired;
      context.completedRepairDays.add(Number(repair.day));
      await report({
        key: `repair-${repair.day}`,
        agent: 'Itinerary Repair Agent',
        status: 'completed',
        message: `Day ${repair.day} repaired`,
        detail: repairedIssues.length
          ? `Critic instruction applied; ${repairedIssues.length} minor field note(s) remain`
          : 'Critic instruction applied without regenerating other days',
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
  return context;
}
