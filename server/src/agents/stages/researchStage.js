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
    context.webResearchUsed = true;
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
        : 'Current travel research collected',
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
      detail: getSafeTavilyErrorMessage(error),
    });
  }
  return context;
}
