import { buildCriticPrompt } from '../../prompts/plannerPrompt.js';
import { getSafeAIErrorMessage } from '../../services/aiErrorService.js';
import {
  fallbackCritique,
  getDeterministicRepairCandidates,
} from './stageSupport.js';

const MODEL = process.env.GROQ_AGENT_MODEL ||
  process.env.GROQ_PLANNER_MODEL ||
  'llama-3.3-70b-versatile';

export default async function criticStage(context) {
  const { trip, requestJson, report } = context;
  const deterministicRepairs = getDeterministicRepairCandidates(context.itinerary);
  const savedDays = context.options?.resumeState?.partialItinerary || [];
  const resumedDayCount = Number.isInteger(context.resumedDayCount)
    ? context.resumedDayCount
    : savedDays.length;
  const isCompleteResume =
    resumedDayCount >= context.totalDays &&
    context.itinerary.length >= context.totalDays;

  if (isCompleteResume) {
    context.critique = fallbackCritique();
    context.repairDays = deterministicRepairs;
    await report({
      key: 'critic',
      agent: 'Itinerary Critic Agent',
      status: 'skipped',
      message: deterministicRepairs.length
        ? `Resumed directly with ${deterministicRepairs.length} targeted final repair(s)`
        : 'Saved itinerary passed the deterministic recheck',
      detail: 'Skipped a repeated general critic model call to preserve capacity',
    });
    return context;
  }

  await report({
    key: 'critic',
    agent: 'Itinerary Critic Agent',
    status: 'running',
    message: 'Auditing the complete plan for real-world usability',
    detail: 'Narrative flow, pace, authenticity, personalization, and logical timing',
    modelCall: true,
  });
  let criticAvailable = true;
  try {
    context.critique = await requestJson(
      buildCriticPrompt(trip, context.strategy, context.logistics, context.itinerary),
      { model: MODEL, max_tokens: 900, temperature: 0.1 },
    );
  } catch (error) {
    criticAvailable = false;
    context.critique = fallbackCritique();
    await report({
      key: 'critic',
      agent: 'Itinerary Critic Agent',
      status: 'skipped',
      message: 'Critic response unavailable; keeping structurally validated days',
      detail: getSafeAIErrorMessage(error, 'The optional critic stage was unavailable.'),
    });
  }
  const qualitativeRepairs = Array.isArray(context.critique?.repairDays)
    ? context.critique.repairDays
      .filter(item => Number.isInteger(Number(item.day)))
      .slice(0, 2)
    : [];
  const repairsByDay = new Map();
  [...deterministicRepairs, ...qualitativeRepairs].forEach(repair => {
    if (!repairsByDay.has(Number(repair.day))) {
      repairsByDay.set(Number(repair.day), repair);
    }
  });
  context.repairDays = [...repairsByDay.values()].slice(0, 4);
  if (criticAvailable) {
    await report({
      key: 'critic',
      agent: 'Itinerary Critic Agent',
      status: 'completed',
      message: context.repairDays.length
        ? `Critic requested ${context.repairDays.length} targeted day repair(s)`
        : 'Critic approved the itinerary without rewrites',
      detail: (context.critique?.criticNotes || []).slice(0, 2).join(' | '),
    });
  }
  return context;
}
