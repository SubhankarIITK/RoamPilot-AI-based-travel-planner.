import ApiError from '../../utils/ApiError.js';
import {
  buildLogisticsPrompt,
  buildPlanningFoundationPrompt,
  buildTripStrategyPrompt,
} from '../../prompts/plannerPrompt.js';
import { normalizeBudgetPlan } from '../../services/budgetEngine.js';
import {
  isLogisticsOverBudget,
  validateLogistics,
  validateStrategy,
} from './stageSupport.js';

const MODEL = process.env.GROQ_AGENT_MODEL ||
  process.env.GROQ_PLANNER_MODEL ||
  'meta-llama/llama-4-scout-17b-16e-instruct';

export default async function foundationStage(context) {
  const {
    trip, profile, memories, options, totalDays, requestJson, report,
  } = context;
  const agentOptions = {
    instructions: options.instructions,
    planningAnswers: options.planningAnswers,
    liveResearch: context.research,
  };
  context.agentOptions = agentOptions;

  await report({
    key: 'strategy',
    agent: 'Trip Strategy Agent',
    status: 'running',
    message: 'Designing the geographic route and daily themes',
    detail: 'Arrival, departure, pacing, must-visits, and one practical area cluster per day',
    modelCall: true,
  });
  await report({
    key: 'logistics',
    agent: 'Budget & Logistics Agent',
    status: 'running',
    message: 'Building budget and transport constraints with the route',
    detail: 'One shared foundation call avoids repeating the same trip context',
  });

  const foundationPrompt = buildPlanningFoundationPrompt(trip, profile, memories, agentOptions);
  const foundation = await requestJson(foundationPrompt, {
    model: MODEL,
    max_tokens: 2200,
    temperature: 0.15,
    retryPrompt: `${foundationPrompt}

COMPACT RETRY: Return only schema-valid JSON with strategy and logistics objects.
Include exactly ${totalDays} dayThemes and ${totalDays} dailySpendingTargets.
Keep arrays concise, use named places and numeric costs, and omit all optional prose.`,
  });
  context.strategy = foundation?.strategy;
  context.logistics = foundation?.logistics;

  if (!validateStrategy(context.strategy, totalDays)) {
    await report({
      key: 'strategy-retry',
      agent: 'Trip Strategy Agent',
      status: 'running',
      message: 'Correcting an incomplete daily strategy',
      detail: 'One bounded schema repair',
      modelCall: true,
    });
    context.strategy = await requestJson(
      `${buildTripStrategyPrompt(trip, profile, memories, agentOptions)}

CORRECTION: Return exactly ${totalDays} unique dayThemes numbered 1 through ${totalDays}.`,
      { model: MODEL, max_tokens: 1000, temperature: 0.1 },
    );
    if (!validateStrategy(context.strategy, totalDays)) {
      throw new ApiError(502, 'The strategy agent returned an incomplete day structure.');
    }
  }

  if (!validateLogistics(context.logistics, totalDays) ||
      isLogisticsOverBudget(context.logistics, trip)) {
    await report({
      key: 'logistics-retry',
      agent: 'Budget & Logistics Agent',
      status: 'running',
      message: isLogisticsOverBudget(context.logistics, trip)
        ? 'Rebalancing the plan to fit the stated budget'
        : 'Correcting incomplete daily budget targets',
      detail: 'Only the logistics section is regenerated',
      modelCall: true,
    });
    const correctionPrompt = `${buildLogisticsPrompt(
      trip, profile, context.strategy, agentOptions,
    )}

CORRECTION: Return exactly ${totalDays} dailySpendingTargets and every required logistics section.
The sum of every budgetBreakdown category must not exceed ${trip.currency} ${trip.budget}.`;
    context.logistics = await requestJson(correctionPrompt, {
      model: MODEL,
      max_tokens: 1600,
      temperature: 0.1,
      retryPrompt: `${correctionPrompt}

COMPACT RETRY: Keep all arrays concise and return valid JSON only.`,
    });
    if (!validateLogistics(context.logistics, totalDays)) {
      throw new ApiError(502, 'The logistics agent returned incomplete budget constraints.');
    }
  }

  context.logistics = normalizeBudgetPlan(context.logistics, trip);
  await report({
    key: 'strategy',
    agent: 'Trip Strategy Agent',
    status: 'completed',
    message: 'Route strategy approved',
    detail: `${context.strategy.route.length} route zone(s) and ${context.strategy.dayThemes.length} daily themes`,
  });
  await report({
    key: 'logistics',
    agent: 'Budget & Logistics Agent',
    status: 'completed',
    message: 'Budget and operating constraints approved',
    detail: `${trip.currency} ${context.logistics.budgetBreakdown.totalEstimated || trip.budget} estimated total`,
  });
  return context;
}
