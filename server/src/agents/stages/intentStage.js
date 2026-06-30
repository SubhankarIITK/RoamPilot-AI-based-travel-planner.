export default async function intentStage(context) {
  const { trip, totalDays, report } = context;
  await report({
    key: 'intent',
    agent: 'Intent Agent',
    status: 'completed',
    message: 'Traveler constraints normalized',
    detail: `${totalDays} days · ${trip.travelers} traveler(s) · ${trip.currency} ${trip.budget}`,
  });
  return context;
}
