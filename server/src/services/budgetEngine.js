const BUDGET_KEYS = [
  'transport',
  'stay',
  'food',
  'activities',
  'localTransport',
  'shoppingBuffer',
  'emergencyBuffer',
];

export const BUDGET_MODES = [
  'ai-managed',
  'budget-friendly',
  'balanced',
  'premium',
  'luxury',
  'hard-budget',
];

const MODE_RATES_INR = {
  'budget-friendly': {
    transport: 3500,
    roomNight: 1800,
    foodDay: 700,
    activitiesDay: 500,
    localTransportDay: 350,
    shoppingRate: 0.03,
  },
  balanced: {
    transport: 6500,
    roomNight: 3800,
    foodDay: 1400,
    activitiesDay: 1200,
    localTransportDay: 750,
    shoppingRate: 0.05,
  },
  premium: {
    transport: 13000,
    roomNight: 7500,
    foodDay: 2800,
    activitiesDay: 2800,
    localTransportDay: 1800,
    shoppingRate: 0.08,
  },
  luxury: {
    transport: 30000,
    roomNight: 16000,
    foodDay: 5500,
    activitiesDay: 6000,
    localTransportDay: 4000,
    shoppingRate: 0.1,
  },
};

// Static planning conversion factors prevent an exchange-rate API call during every plan.
// They are intentionally conservative estimates, not live quotes.
const INR_TO_CURRENCY = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
};

const money = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
};

const text = value => String(value || '').trim().toLowerCase();

const includesAny = (value, terms) => terms.some(term => value.includes(term));

const tripDays = trip => {
  if (!trip?.startDate || !trip?.endDate) return Math.max(1, Number(trip?.durationDays) || 5);
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const difference = Math.floor((end - start) / 86400000) + 1;
  return Number.isFinite(difference) ? Math.max(1, difference) : 5;
};

const normalizeBudgetMode = (trip, preferences = {}) => {
  const requested = text(
    trip?.budgetMode ||
    preferences.budget_mode ||
    preferences.budgetMode,
  ).replaceAll('_', '-').replaceAll(' ', '-');
  const aliases = {
    ai: 'ai-managed',
    automatic: 'ai-managed',
    'best-value': 'balanced',
    budget: 'budget-friendly',
    cheapest: 'budget-friendly',
    comfortable: 'balanced',
    'user-defined': 'hard-budget',
    fixed: 'hard-budget',
    hard: 'hard-budget',
  };
  const normalized = aliases[requested] || requested;
  if (BUDGET_MODES.includes(normalized)) return normalized;
  // Existing trips did not store budgetMode. Preserve their entered amount as a hard limit.
  return money(trip?.budget) > 0 ? 'hard-budget' : 'ai-managed';
};

const resolveComfortLevel = (trip, preferences, budgetMode) => {
  if (MODE_RATES_INR[budgetMode]) return budgetMode;
  const preferenceText = text([
    preferences.comfort_level,
    preferences.comfortLevel,
    preferences.accommodation,
    preferences.food_style,
    preferences.foodStyle,
    preferences.optimization_goal,
    preferences.optimizationGoal,
    trip?.hotelTier,
    trip?.foodStyle,
    trip?.planningMode,
  ].filter(Boolean).join(' '));
  if (includesAny(preferenceText, ['ultra luxury', 'luxury', 'private charter'])) return 'luxury';
  if (includesAny(preferenceText, ['premium', 'best experience', '5-star', 'five star'])) return 'premium';
  if (includesAny(preferenceText, ['budget', 'cheapest', 'backpacker', 'hostel'])) return 'budget-friendly';
  return 'balanced';
};

const destinationFactors = trip => {
  const destination = text(trip?.destination);
  const origin = text(trip?.origin);
  let cost = 1;
  let longHaul = 1;

  if (includesAny(destination, ['switzerland', 'iceland', 'norway', 'denmark', 'monaco'])) cost = 2.25;
  else if (includesAny(destination, ['london', 'paris', 'france', 'germany', 'italy', 'europe', 'australia'])) cost = 1.75;
  else if (includesAny(destination, ['usa', 'united states', 'new york', 'canada'])) cost = 1.9;
  else if (includesAny(destination, ['japan', 'singapore', 'dubai', 'uae', 'maldives'])) cost = 1.6;
  else if (includesAny(destination, ['mumbai', 'delhi', 'goa', 'bangalore', 'bengaluru'])) cost = 1.15;

  const indianOrigin = !origin || includesAny(origin, [
    'india', 'mumbai', 'delhi', 'kolkata', 'chennai', 'bangalore', 'bengaluru',
    'hyderabad', 'pune', 'jaipur', 'ahmedabad', 'kochi',
  ]);
  if (indianOrigin) {
    if (includesAny(destination, ['usa', 'united states', 'canada', 'australia'])) longHaul = 10;
    else if (includesAny(destination, ['europe', 'switzerland', 'france', 'germany', 'italy', 'london', 'iceland', 'norway'])) longHaul = 7;
    else if (includesAny(destination, ['japan', 'singapore', 'dubai', 'uae', 'maldives'])) longHaul = 4;
  }
  return { cost, transport: longHaul };
};

const seasonFactor = trip => {
  if (!trip?.startDate) return 1;
  const date = new Date(trip.startDate);
  if (Number.isNaN(date.getTime())) return 1;
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  if ((month === 12 && day >= 18) || (month === 1 && day <= 7)) return 1.25;
  if ([5, 6].includes(month)) return 1.12;
  return 1;
};

const transportFactor = preferences => {
  const preference = text(
    preferences.transport_mode ||
    preferences.transportMode ||
    preferences.mobility,
  );
  if (includesAny(preference, ['private car', 'chauffeur', 'business class'])) return 1.5;
  if (includesAny(preference, ['flight', 'taxi'])) return 1.2;
  if (includesAny(preference, ['train', 'public transport', 'bus'])) return 0.75;
  return 1;
};

const stayPreferenceFactor = preferences => {
  const preference = text(
    preferences.hotelTier ||
    preferences.hotel_tier ||
    preferences.accommodation,
  );
  if (includesAny(preference, ['5-star', 'five star', 'luxury', 'premium area'])) return 1.25;
  if (includesAny(preference, ['hostel', 'budget transport hub', 'guesthouse'])) return 0.8;
  return 1;
};

const foodPreferenceFactor = preferences => {
  const preference = text(
    preferences.foodStyle ||
    preferences.food_style ||
    preferences.foodPreference,
  );
  if (includesAny(preference, ['fine dining', 'luxury', 'premium'])) return 1.3;
  if (includesAny(preference, ['budget-friendly', 'street food', 'self-catering'])) return 0.8;
  return 1;
};

const activityPreferenceFactor = (trip, preferences) => {
  const preference = text([
    trip?.travelStyle,
    trip?.planningMode,
    preferences.top_priority,
    preferences.activityStyle,
    preferences.optimization_goal,
  ].filter(Boolean).join(' '));
  if (includesAny(preference, ['packed', 'adventure', 'best experience'])) return 1.2;
  if (includesAny(preference, ['relaxed', 'slow travel', 'rest'])) return 0.85;
  return 1;
};

const localTransportPreferenceFactor = preferences => {
  const preference = text(preferences.mobility || preferences.transport_mode);
  if (includesAny(preference, ['private car', 'prefer taxis', 'minimal walking'])) return 1.35;
  if (includesAny(preference, ['walking is fine', 'public transport'])) return 0.8;
  return 1;
};

const currencyAmount = (inrAmount, currency) => {
  const rate = INR_TO_CURRENCY[String(currency || 'INR').toUpperCase()] || 1;
  return money(inrAmount * rate);
};

const classifyBudget = (availableBudget, expectedSpend, hasHardBudget) => {
  if (expectedSpend <= 0) return 'comfortable';
  if (!hasHardBudget || availableBudget <= 0) return 'comfortable';
  const coverageRatio = availableBudget / expectedSpend;
  if (coverageRatio < 1) return 'insufficient';
  if (coverageRatio <= 1.25) return 'comfortable';
  if (coverageRatio <= 1.75) return 'generous';
  if (coverageRatio <= 3) return 'luxury';
  return 'unrealistic';
};

export const estimateTripBudget = (trip, preferences = {}) => {
  const budgetMode = normalizeBudgetMode(trip, preferences);
  const comfortLevel = resolveComfortLevel(trip, preferences, budgetMode);
  const rates = MODE_RATES_INR[comfortLevel];
  const days = tripDays(trip);
  const nights = Math.max(1, days - 1);
  const travelers = Math.max(1, Number(trip?.travelers) || 1);
  const rooms = Math.max(1, Math.ceil(travelers / 2));
  const destination = destinationFactors(trip);
  const seasonal = seasonFactor(trip);
  const currency = String(trip?.currency || 'INR').toUpperCase();
  const stayFactor = destination.cost * seasonal;
  const experienceFactor = destination.cost * Math.min(seasonal, 1.12);

  const componentsInr = {
    transport: rates.transport * travelers * destination.transport *
      transportFactor(preferences) * seasonal,
    stay: rates.roomNight * rooms * nights * stayFactor * stayPreferenceFactor(preferences),
    food: rates.foodDay * travelers * days * experienceFactor * foodPreferenceFactor(preferences),
    activities: rates.activitiesDay * travelers * days * experienceFactor *
      activityPreferenceFactor(trip, preferences),
    localTransport: rates.localTransportDay * travelers * days * destination.cost *
      localTransportPreferenceFactor(preferences),
  };
  const preBufferTotal = Object.values(componentsInr).reduce((sum, value) => sum + value, 0);
  componentsInr.shoppingBuffer = preBufferTotal * rates.shoppingRate;
  // The emergency reserve is always tied to realistic spend, never the entered ceiling.
  componentsInr.emergencyBuffer =
    (preBufferTotal + componentsInr.shoppingBuffer) * 0.1;

  const budgetBreakdown = Object.fromEntries(
    BUDGET_KEYS.map(key => [key, currencyAmount(componentsInr[key], currency)]),
  );
  budgetBreakdown.totalEstimated = BUDGET_KEYS
    .reduce((sum, key) => sum + budgetBreakdown[key], 0);

  const availableBudget = money(trip?.budget);
  const hasHardBudget = budgetMode === 'hard-budget' && availableBudget > 0;
  const expectedSpend = budgetBreakdown.totalEstimated;
  const verdict = classifyBudget(availableBudget, expectedSpend, hasHardBudget);
  const shortfall = verdict === 'insufficient'
    ? Math.max(0, expectedSpend - availableBudget)
    : 0;
  const savings = hasHardBudget && verdict !== 'insufficient'
    ? Math.max(0, availableBudget - expectedSpend)
    : 0;
  const warnings = [];

  if (verdict === 'insufficient') {
    warnings.push(
      `The fixed budget is insufficient. A realistic minimum is approximately ${currency} ${expectedSpend}; the shortfall is ${currency} ${shortfall}.`,
    );
  }
  if (verdict === 'unrealistic') {
    warnings.push(
      `The entered budget is unusually high for this trip. Expected spend is capped at a realistic ${comfortLevel} estimate; confirm separately if ultra-luxury or private travel is intended.`,
    );
  }

  return {
    budgetBreakdown,
    budgetSummary: {
      budgetMode,
      comfortLevel,
      verdict,
      status: verdict,
      budgetClass: verdict === 'comfortable' ? 'realistic' : verdict,
      availableBudget,
      realisticMinimum: expectedSpend,
      expectedSpend,
      savings,
      shortfall,
      emergencyBuffer: budgetBreakdown.emergencyBuffer,
      shoppingBuffer: budgetBreakdown.shoppingBuffer,
      recommendedEmergencyBuffer: budgetBreakdown.emergencyBuffer,
      optionalUpgradeBudget: verdict === 'insufficient' ? 0 : savings,
      requiresConfirmation: verdict === 'unrealistic',
    },
    budgetAssumptions: {
      days,
      nights,
      travelers,
      rooms,
      comfortLevel,
      seasonAdjustment: seasonal,
      destinationCostAdjustment: destination.cost,
      stayPreferenceAdjustment: stayPreferenceFactor(preferences),
      foodPreferenceAdjustment: foodPreferenceFactor(preferences),
      activityPreferenceAdjustment: activityPreferenceFactor(trip, preferences),
      localTransportAdjustment: localTransportPreferenceFactor(preferences),
      transportSource: 'deterministic destination estimate',
      pricesAreEstimated: true,
    },
    warnings,
  };
};

export const normalizeBudgetPlan = (logistics, trip, deterministicEstimate = null) => {
  const next = logistics && typeof logistics === 'object' ? { ...logistics } : {};
  const estimate = deterministicEstimate || null;
  const source = estimate?.budgetBreakdown ||
    (next.budgetBreakdown && typeof next.budgetBreakdown === 'object'
      ? next.budgetBreakdown
      : {});
  const budgetBreakdown = Object.fromEntries(
    BUDGET_KEYS.map(key => [key, money(source[key])]),
  );
  const componentTotal = BUDGET_KEYS
    .reduce((total, key) => total + budgetBreakdown[key], 0);
  budgetBreakdown.totalEstimated = componentTotal > 0
    ? componentTotal
    : money(source.totalEstimated);

  if (estimate) {
    next.budgetBreakdown = budgetBreakdown;
    next.budgetSummary = { ...estimate.budgetSummary, expectedSpend: componentTotal };
    next.budgetAssumptions = estimate.budgetAssumptions;
    next.warnings = [...new Set([
      ...(estimate.warnings || []),
      ...(Array.isArray(next.warnings) ? next.warnings : []),
    ])].slice(0, 12);
    return next;
  }

  const availableBudget = money(trip?.budget);
  const hasHardBudget = availableBudget > 0;
  const expectedSpend = budgetBreakdown.totalEstimated;
  const verdict = classifyBudget(availableBudget, expectedSpend, hasHardBudget);
  const savings = verdict === 'insufficient' ? 0 : Math.max(0, availableBudget - expectedSpend);
  const shortfall = verdict === 'insufficient' ? Math.max(0, expectedSpend - availableBudget) : 0;
  const recommendedEmergencyBuffer = expectedSpend > 0 ? Math.round(expectedSpend * 0.1) : 0;

  next.budgetBreakdown = budgetBreakdown;
  next.budgetSummary = {
    budgetMode: hasHardBudget ? 'hard-budget' : 'ai-managed',
    comfortLevel: 'balanced',
    verdict,
    status: verdict,
    budgetClass: verdict === 'comfortable' ? 'realistic' : verdict,
    availableBudget,
    realisticMinimum: expectedSpend,
    expectedSpend,
    savings,
    shortfall,
    emergencyBuffer: budgetBreakdown.emergencyBuffer,
    shoppingBuffer: budgetBreakdown.shoppingBuffer,
    recommendedEmergencyBuffer,
    optionalUpgradeBudget: verdict === 'insufficient' ? 0 : Math.max(
      0,
      savings - Math.max(0, recommendedEmergencyBuffer - budgetBreakdown.emergencyBuffer),
    ),
    requiresConfirmation: verdict === 'unrealistic',
  };

  const warnings = Array.isArray(next.warnings) ? [...next.warnings] : [];
  if (verdict === 'insufficient') {
    warnings.push(
      `The fixed budget is insufficient. A realistic minimum is approximately ${trip.currency || ''} ${expectedSpend}.`,
    );
  }
  if (verdict === 'unrealistic') {
    warnings.push('The entered budget is unusually high; expected spend was not increased to consume it.');
  }
  next.warnings = [...new Set(warnings)].slice(0, 12);
  return next;
};
