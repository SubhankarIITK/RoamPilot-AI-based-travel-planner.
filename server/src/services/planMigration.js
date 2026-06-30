export const migratePlanV1ToV2 = aiPlan => {
  if (!aiPlan || typeof aiPlan !== 'object') return null;
  return {
    ...aiPlan,
    schemaVersion: 2,
    generatedAt: aiPlan.generatedAt || new Date().toISOString(),
    workflowVersion: aiPlan.generationContext?.workflowVersion ?? 7,
  };
};
