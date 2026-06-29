export const buildChatPrompt = (trip, chatHistory) => {
  const planSummary = trip.aiPlan
    ? `Current trip plan summary: ${trip.aiPlan.summary || ''}, destinations: ${trip.aiPlan.destinations?.join(', ') || ''}`
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
