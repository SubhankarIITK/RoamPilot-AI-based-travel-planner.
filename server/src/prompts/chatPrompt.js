export const buildChatPrompt = (trip, chatHistory) => {
  const planContext = trip.aiPlan
    ? {
        summary: trip.aiPlan.summary || '',
        route: trip.aiPlan.route || [],
        budget: trip.aiPlan.budgetBreakdown || {},
        warnings: (trip.aiPlan.warnings || []).slice(0, 5),
        days: (trip.aiPlan.dayWiseItinerary || []).slice(0, 14).map(day => ({
          day: day.day,
          date: day.date,
          theme: day.theme,
          area: `${day.startArea || ''} to ${day.endArea || ''}`.trim(),
          stops: (day.schedule || []).slice(0, 6).map(item => item.activity),
          meals: (day.meals || []).slice(0, 3).map(meal => meal.placeOrArea),
        })),
      }
    : null;
  const planSummary = planContext
    ? `Current canonical trip plan: ${JSON.stringify(planContext).slice(0, 5000)}`
    : 'No plan generated yet.';

  return [
    {
      role: 'system',
      content: `You are RoamPilot, an expert AI travel companion. You are helping the user with their trip to ${trip.destination}.
${planSummary}
Be helpful, concise, and practical. If asked to modify the itinerary, describe changes clearly.
Format responses with clean GitHub-flavored Markdown:
- Use short headings and bullet lists for detailed itinerary changes.
- Use tables only for compact comparisons or summaries, with one logical item per row.
- Keep table cells concise and never place an entire multi-day itinerary in one cell.
- Do not output raw HTML except a simple <br> inside a table cell when necessary.
If the user asks for JSON changes, return a valid JSON patch or the full updated section.`,
    },
    ...chatHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
  ];
};
