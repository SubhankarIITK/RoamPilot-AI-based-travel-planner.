const billingPlans = {
  explorer: {
    key: 'explorer',
    name: 'Explorer',
    description: 'For occasional trips and lighter AI planning.',
    monthlyCredits: 100,
    displayPrice: 499,
    currency: 'INR',
    stripePriceId: process.env.STRIPE_EXPLORER_PRICE_ID || '',
    features: ['100 AI credits per month', 'Detailed itinerary generation', 'AI trip chat', 'Live travel research'],
  },
  navigator: {
    key: 'navigator',
    name: 'Navigator',
    description: 'For frequent travelers who refine and compare plans.',
    monthlyCredits: 300,
    displayPrice: 999,
    currency: 'INR',
    stripePriceId: process.env.STRIPE_NAVIGATOR_PRICE_ID || '',
    features: ['300 AI credits per month', 'Everything in Explorer', 'More regenerations and transformations', 'Priority plan allowance'],
    recommended: true,
  },
  voyager: {
    key: 'voyager',
    name: 'Voyager',
    description: 'For travel professionals and AI-heavy planning.',
    monthlyCredits: 800,
    displayPrice: 1999,
    currency: 'INR',
    stripePriceId: process.env.STRIPE_VOYAGER_PRICE_ID || '',
    features: ['800 AI credits per month', 'Everything in Navigator', 'High-volume AI chat and research', 'Best cost per credit'],
  },
};

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
});

export const WEEKLY_FREE_CREDIT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export const getWeeklyFreeCreditAllowance = () => {
  const configured = Number.parseInt(process.env.WEEKLY_FREE_CREDITS || '5', 10);
  return Number.isInteger(configured) ? Math.min(100, Math.max(0, configured)) : 5;
};

export const getBillingPlans = () => Object.values(billingPlans);

export const getBillingPlan = planKey => billingPlans[planKey] || null;

export const getBillingPlanByPriceId = priceId =>
  getBillingPlans().find(plan => plan.stripePriceId && plan.stripePriceId === priceId) || null;

export const getPublicBillingPlans = () =>
  getBillingPlans().map(({ stripePriceId, ...plan }) => ({
    ...plan,
    checkoutAvailable: Boolean(
      stripePriceId &&
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET
    ),
  }));

export default billingPlans;
