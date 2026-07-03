import { getSafeTavilyErrorMessage } from '../../services/tavilyService.js';
import { reportPlanningProviderUsage } from '../../services/planningProgressService.js';

export default async function researchStage(context) {
  const { options, report, researchTrip, trip } = context;
  if (options.resumeState?.foundation) {
    await report({
      key: 'research',
      agent: 'Research Agent',
      status: 'completed',
      message: 'Reused saved research checkpoint',
      detail: 'No external research call was repeated',
    });
    await reportPlanningProviderUsage(
      report,
      context.factualEvidence?.providerUsage || [],
      { forceCache: true },
    );
    return context;
  }
  await report({
    key: 'research',
    agent: 'Research Agent',
    status: 'running',
    message: options.useWebSearch
      ? 'Checking destination places and current conditions'
      : 'Checking destination facts with structured APIs',
    detail: options.useWebSearch
      ? 'Major places, experiences, transport, closures, weather, safety, and costs'
      : 'Geoapify, routing, weather, and holiday data remain active without Tavily',
  });
  try {
    const research = await researchTrip(trip);
    const supportingMarker = 'GENERAL WEB RESEARCH (supporting reference only):';
    context.research = research.evidence && research.content.includes(supportingMarker)
      ? research.content.split(supportingMarker).at(-1).trim()
      : research.evidence
        ? ''
        : research.content;
    context.factualEvidence = research.evidence || null;
    context.webResearchUsed = Boolean(research.webSearchUsed);
    await reportPlanningProviderUsage(
      report,
      research.providerUsage || research.evidence?.providerUsage || [],
    );
    await report({
      key: 'research',
      agent: 'Research Agent',
      status: 'completed',
      message: research.cacheHit
        ? 'Reused recent travel research'
        : research.webSearchUsed
          ? 'Current travel research collected'
          : 'Structured travel data collected',
      detail: research.cacheHit
        ? 'No new external travel-data call was needed'
        : `${research.executedTools?.length || 0} factual/search source(s) used`,
    });
  } catch (error) {
    await report({
      key: 'research',
      agent: 'Research Agent',
      status: 'skipped',
      message: 'Live research unavailable; continuing cautiously',
      detail: options.useWebSearch
        ? getSafeTavilyErrorMessage(error)
        : 'Structured providers were unavailable; the plan will label unsupported facts as estimated.',
    });
  }
  return context;
}
