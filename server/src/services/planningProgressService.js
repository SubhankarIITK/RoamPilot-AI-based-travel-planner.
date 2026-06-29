import PlanningRun from '../models/PlanningRun.js';

export const createPlanningRun = ({ workflowId, userId, tripId }) =>
  PlanningRun.findOneAndUpdate(
    { workflowId, userId },
    {
      $set: {
        tripId,
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
        error: String(error?.message || error || 'Planning failed').slice(0, 500),
      },
      $push: {
        steps: {
          key: 'failed',
          agent: 'Coordinator',
          status: 'failed',
          message: 'Planning workflow stopped',
          detail: String(error?.message || error || '').slice(0, 300),
          occurredAt: new Date(),
        },
      },
    },
    { new: true },
  );
