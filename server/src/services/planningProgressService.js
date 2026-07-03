import PlanningRun from '../models/PlanningRun.js';
import { getSafeAIErrorMessage } from './aiErrorService.js';

const configuredStaleAfterMs = Number(process.env.PLANNING_STALE_AFTER_MS);
export const PLANNING_STALE_AFTER_MS = Number.isFinite(configuredStaleAfterMs)
  ? Math.max(60_000, configuredStaleAfterMs)
  : 90_000;

export const touchPlanningRun = workflowId =>
  PlanningRun.updateOne(
    { workflowId, status: 'running' },
    { $set: { updatedAt: new Date() } },
  );

export const reconcileStalePlanningRun = async run => {
  if (
    !run ||
    run.status !== 'running' ||
    Date.now() - new Date(run.updatedAt).getTime() <= PLANNING_STALE_AFTER_MS
  ) {
    return run;
  }

  const message =
    'Planning paused because the server stopped receiving workflow updates. Resume to continue from saved progress.';
  const result = await PlanningRun.updateOne(
    { _id: run._id, status: 'running', updatedAt: run.updatedAt },
    {
      $set: {
        status: 'failed',
        currentAgent: 'Paused',
        error: message,
      },
      $push: {
        steps: {
          key: 'stale-workflow',
          agent: 'Coordinator',
          status: 'failed',
          message: 'Planning workflow paused',
          detail: message,
          occurredAt: new Date(),
        },
      },
    },
  );

  if (result.modifiedCount > 0) {
    run.status = 'failed';
    run.currentAgent = 'Paused';
    run.error = message;
    run.steps = [
      ...(run.steps || []),
      {
        key: 'stale-workflow',
        agent: 'Coordinator',
        status: 'failed',
        message: 'Planning workflow paused',
        detail: message,
        occurredAt: new Date(),
      },
    ];
  }
  return run;
};

export const createPlanningRun = async ({
  workflowId,
  userId,
  tripId,
  resumeKey = '',
  totalDays = 0,
}) => {
  const previous = resumeKey
    ? await PlanningRun.findOne({
        workflowId: { $ne: workflowId },
        userId,
        tripId,
        resumeKey,
        status: { $in: ['running', 'failed'] },
        expiresAt: { $gt: new Date() },
      })
      .sort({ updatedAt: -1 })
      .lean()
    : null;

  return PlanningRun.findOneAndUpdate(
    { workflowId, userId },
    {
      $set: {
        tripId,
        resumeKey,
        totalDays,
        resumedFrom: previous?.workflowId || '',
        foundation: previous?.foundation || null,
        batches: previous?.batches || [],
        partialItinerary: previous?.partialItinerary || [],
        draftUpdatedAt: previous?.draftUpdatedAt || null,
        status: 'running',
        currentAgent: 'Coordinator',
        steps: [],
        modelCalls: 0,
        error: '',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

export const savePlanningFoundation = (workflowId, foundation) =>
  PlanningRun.findOneAndUpdate(
    { workflowId },
    {
      $set: {
        foundation,
        draftUpdatedAt: new Date(),
      },
    },
    { new: true },
  );

export const savePlanningBatch = async (
  workflowId,
  {
    key,
    startDay,
    endDay,
    status,
    attempts = 0,
    days = [],
    error = '',
  },
) => {
  const run = await PlanningRun.findOne({ workflowId });
  if (!run) return null;
  const nextBatch = {
    key,
    startDay,
    endDay,
    status,
    attempts,
    days,
    error: String(error || '').slice(0, 300),
    updatedAt: new Date(),
  };
  const index = run.batches.findIndex(batch => batch.key === key);
  if (index >= 0) run.batches[index] = nextBatch;
  else run.batches.push(nextBatch);

  if (['completed', 'repaired'].includes(status) && days.length) {
    const merged = new Map(
      (run.partialItinerary || []).map(day => [Number(day.day), day]),
    );
    days.forEach(day => merged.set(Number(day.day), day));
    run.partialItinerary = [...merged.values()]
      .sort((left, right) => Number(left.day) - Number(right.day));
  }
  run.draftUpdatedAt = new Date();
  run.markModified('batches');
  run.markModified('partialItinerary');
  return run.save();
};

export const reportPlanningStep = async (
  workflowId,
  { key, agent, status, message, detail = '', modelCall = false },
) => {
  const update = {
    $set: { currentAgent: agent },
    $push: {
      steps: {
        key,
        agent,
        status,
        message,
        detail: String(detail || '').slice(0, 300),
        occurredAt: new Date(),
      },
    },
  };
  if (modelCall) update.$inc = { modelCalls: 1 };
  return PlanningRun.findOneAndUpdate({ workflowId }, update, { new: true });
};

export const reportPlanningProviderUsage = async (
  report,
  providers = [],
  { forceCache = false } = {},
) => {
  for (const provider of providers) {
    const used = provider.status === 'used';
    const mode = forceCache && used ? 'research-cache' : provider.mode;
    const message = used
      ? mode === 'research-cache'
        ? 'Confirmed in cached plan data'
        : mode === 'cache'
          ? 'Reused cached API data'
          : 'Live API data used'
      : provider.status === 'not-configured'
        ? 'API key not configured'
        : provider.status === 'disabled'
          ? 'Optional API disabled'
        : provider.status === 'outside-forecast-window'
          ? 'Trip is outside the forecast window'
          : 'API data unavailable';
    await report({
      key: `api-${provider.key}`,
      agent: provider.label,
      status: used ? 'completed' : 'skipped',
      message,
      detail: provider.detail,
    });
  }
};

export const completePlanningRun = workflowId =>
  PlanningRun.findOneAndUpdate(
    { workflowId },
    {
      $set: { status: 'completed', currentAgent: 'Complete', error: '' },
    },
    { new: true },
  );

export const failPlanningRun = (workflowId, error) =>
  PlanningRun.findOneAndUpdate(
    { workflowId },
    {
      $set: {
        status: 'failed',
        currentAgent: 'Failed',
        error: getSafeAIErrorMessage(error, 'Planning could not be completed.'),
      },
      $push: {
        steps: {
          key: 'failed',
          agent: 'Coordinator',
          status: 'failed',
          message: 'Planning workflow stopped',
          detail: getSafeAIErrorMessage(error, 'Planning could not be completed.'),
          occurredAt: new Date(),
        },
      },
    },
    { new: true },
  );
