export default async function intentStage(context) {
  const { trip, totalDays, report } = context;
  const budgetDetail = Number(trip.budget) > 0
    ? `${trip.currency} ${trip.budget} hard budget`
    : String(trip.budgetMode || 'AI-managed').replaceAll('-', ' ');
  await report({
    key: 'intent',
    agent: 'Intent Agent',
    status: 'completed',
    message: 'Traveler constraints normalized',
    detail: `${totalDays} days · ${trip.travelers} traveler(s) · ${budgetDetail}`,
  });
  return context;
}
