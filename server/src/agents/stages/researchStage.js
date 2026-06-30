import { getSafeTavilyErrorMessage } from '../../services/tavilyService.js';

export default async function researchStage(context) {
  const { options, report, researchTrip, trip } = context;
  if (!options.useWebSearch) {
    await report({
      key: 'research',
      agent: 'Research Agent',
      status: 'skipped',
      message: 'Live research disabled',
    });
    return context;
  }

  await report({
    key: 'research',
    agent: 'Research Agent',
    status: 'running',
    message: 'Checking current destination conditions',
    detail: 'Transport, closures, seasonal conditions, safety, and cost signals',
    modelCall: true,
  });
  try {
    const research = await researchTrip(trip);
    context.research = research.content;
    context.webResearchUsed = true;
    await report({
      key: 'research',
      agent: 'Research Agent',
      status: 'completed',
      message: research.cacheHit
        ? 'Reused recent travel research'
        : 'Current travel research collected',
      detail: research.cacheHit
        ? 'No new Tavily search call was needed'
        : `${research.executedTools?.length || 0} research tool call(s) used`,
    });
  } catch (error) {
    await report({
      key: 'research',
      agent: 'Research Agent',
      status: 'skipped',
      message: 'Live research unavailable; continuing cautiously',
      detail: getSafeTavilyErrorMessage(error),
    });
  }
  return context;
}
