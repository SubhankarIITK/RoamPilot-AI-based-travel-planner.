export const AI_CREDIT_COSTS = Object.freeze({
  parseTripDescription: 1,
  planTrip: 18,
  chatTrip: 1,
  regenerateDay: 3,
  optimizeBudget: 2,
  createPackingList: 2,
  safetyGuide: 2,
  transformTrip: 6,
  researchTrip: 3,
  transcribeSpeech: 1,
});

// This guarantees that every metered AI feature can be tried once each week.
export const COMPLETE_TRIAL_CREDITS = Object.values(AI_CREDIT_COSTS)
  .reduce((total, cost) => total + cost, 0);

const creditPacks = {
  starter: {
    key: 'starter',
    name: 'Starter Pack',
    description: 'Enough for several complete travel plans and refinements.',
    credits: 60,
    displayPrice: 99,
    amountPaise: 9900,
    currency: 'INR',
    recommended: false,
  },
  explorer: {
    key: 'explorer',
    name: 'Explorer Pack',
    description: 'For frequent planning, chat, research, and day regeneration.',
    credits: 180,
    displayPrice: 249,
    amountPaise: 24900,
    currency: 'INR',
    recommended: true,
  },
  pro: {
    key: 'pro',
    name: 'Pro Pack',
    description: 'High-capacity credit pack for travel professionals and power users.',
    credits: 450,
    displayPrice: 499,
    amountPaise: 49900,
    currency: 'INR',
    recommended: false,
  },
};

export const WEEKLY_FREE_CREDIT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export const getWeeklyFreeCreditAllowance = () => {
  const configured = Number.parseInt(
    process.env.WEEKLY_FREE_CREDITS || String(COMPLETE_TRIAL_CREDITS),
    10,
  );
  const requested = Number.isInteger(configured) ? configured : COMPLETE_TRIAL_CREDITS;
  return Math.min(200, Math.max(COMPLETE_TRIAL_CREDITS, requested));
};

export const getCreditPacks = () => Object.values(creditPacks);
export const getCreditPack = packKey => creditPacks[packKey] || null;
export const getPublicCreditPacks = () => getCreditPacks().map(pack => ({ ...pack }));

// Compatibility aliases for older imports while the UI migrates from subscriptions.
export const getBillingPlans = getCreditPacks;
export const getBillingPlan = getCreditPack;
export const getPublicBillingPlans = getPublicCreditPacks;

export default creditPacks;
