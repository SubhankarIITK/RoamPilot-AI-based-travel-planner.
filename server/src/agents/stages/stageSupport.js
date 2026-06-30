const PLACEHOLDER_PATTERNS = [
  /\bmain local landmark\b/i,
  /\bcultural stop\b/i,
  /\bmarket,\s*museum,\s*viewpoint/i,
  /\bmarket or museum\b/i,
  /\bwell-reviewed\b/i,
  /\bchoose (the|a|nearby|any)\b/i,
  /\bnearby attraction\b/i,
  /\bhighest-priority verified attraction\b/i,
  /\blocal restaurant\b/i,
  /\blocal dish\b/i,
  /\bbudget locally\b/i,
  /\bverify\b/i,
  /\bto confirm\b/i,
  /\btbd\b/i,
  /\bn\/a\b/i,
  /\bplaceholder\b/i,
  /\bgeneric\b/i,
  /\bexact (venues|hours|prices)\b/i,
];

const normalizeText = value =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hasPlaceholderText = value =>
  typeof value === 'string' && PLACEHOLDER_PATTERNS.some(pattern => pattern.test(value));
const containsNumberOrFree = value => /\d|free|included|complimentary/i.test(String(value || ''));
const isTransitOnly = item =>
  /transfer|taxi|uber|metro|train|flight|airport|check.?in|check.?out|rest|break|buffer/i
    .test(`${item?.activity || ''} ${item?.location || ''}`);
const getNumericMinutes = value => {
  const minutes = Number(String(value || '').match(/(\d+(?:\.\d+)?)/)?.[1]);
  return Number.isFinite(minutes) ? minutes : null;
};

const collectPlaceholderPaths = (value, path = 'plan', paths = []) => {
  if (typeof value === 'string' && hasPlaceholderText(value)) paths.push(path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPlaceholderPaths(item, `${path}[${index}]`, paths));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) =>
      collectPlaceholderPaths(item, `${path}.${key}`, paths));
  }
  return paths;
};

export const repairSafeDayOmissions = (day, trip = {}) => {
  if (!day || !Array.isArray(day.schedule)) return day;

  day.schedule = day.schedule.map((item, index) => {
    const repaired = { ...item };
    const location = String(repaired.location || repaired.activity || 'the planned stop').trim();
    if (!repaired.activity || hasPlaceholderText(repaired.activity)) {
      const concreteLocation = !hasPlaceholderText(location)
        ? location
        : String(trip.destination || 'the scheduled venue').trim();
      repaired.activity = `Visit ${concreteLocation}`;
    }
    const activity = String(repaired.activity).trim();
    const duration = containsNumberOrFree(repaired.duration)
      ? repaired.duration
      : 'the planned time';

    if (!repaired.details || String(repaired.details).length < 35 ||
        hasPlaceholderText(repaired.details)) {
      repaired.details = `${activity} at ${location}; allow ${duration}, use the public entrance, and keep a short buffer before departure.`;
    }
    if (!containsNumberOrFree(repaired.travelTime)) {
      const existing = String(repaired.travelTime || '').trim();
      repaired.travelTime = index === 0
        ? '0 min (day starts at this stop)'
        : `15 min estimated from the previous stop${existing ? ` (${existing})` : ''}`;
    }
    if (!repaired.transport || hasPlaceholderText(repaired.transport)) {
      const travelMinutes = getNumericMinutes(repaired.travelTime);
      repaired.transport = index === 0
        ? 'Begin at this location'
        : travelMinutes !== null && travelMinutes <= 15 ? 'Walk' : 'Local taxi';
    }
    return repaired;
  });

  if (Array.isArray(day.meals)) {
    day.meals = day.meals.map((meal, index) => {
      const repaired = { ...meal };
      repaired.placeOrArea = String(
        repaired.placeOrArea || repaired.restaurantOrArea || repaired.restaurant ||
        repaired.place || repaired.venue || repaired.location || '',
      ).trim();
      if (!repaired.placeOrArea || hasPlaceholderText(repaired.placeOrArea)) {
        const schedule = day.schedule || [];
        const nearbyStop = index === 0
          ? schedule[0]
          : index === day.meals.length - 1
            ? schedule[schedule.length - 1]
            : schedule[Math.floor(schedule.length / 2)];
        repaired.placeOrArea = String(
          nearbyStop?.location || (index === 0 ? day.startArea : day.endArea) ||
          trip.destination || 'Central dining district',
        ).trim();
      }
      repaired.suggestion = String(
        repaired.suggestion || repaired.dishes || repaired.dish || repaired.food ||
        repaired.description || 'Choose a suitable local meal matching the traveler preferences',
      ).trim();
      if (!containsNumberOrFree(repaired.estimatedCost)) {
        const foodBudget = Number(day.dailyBudget?.food) || 0;
        const perMeal = foodBudget > 0
          ? Math.max(0, Math.round(foodBudget / Math.max(1, day.meals.length)))
          : 0;
        repaired.estimatedCost = `${trip.currency || 'INR'} ${perMeal}`;
      }
      return repaired;
    });
  }

  if (day.dailyBudget && typeof day.dailyBudget === 'object') {
    const activities = Number(day.dailyBudget.activities) || 0;
    const food = Number(day.dailyBudget.food) || 0;
    const localTransport = Number(day.dailyBudget.localTransport) || 0;
    const subtotal = activities + food + localTransport;
    if (subtotal > 0) {
      Object.assign(day.dailyBudget, { activities, food, localTransport, total: subtotal });
    }
  }
  return day;
};

export const validateDayQuality = day => {
  const issues = [];
  if (!day?.theme || hasPlaceholderText(day.theme)) {
    issues.push(`day ${day?.day || '?'} has a generic theme`);
  }
  if (!day?.summary || String(day.summary).length < 35 || hasPlaceholderText(day.summary)) {
    issues.push(`day ${day?.day || '?'} needs a concrete purpose summary`);
  }
  if (!day?.startArea || hasPlaceholderText(day.startArea)) {
    issues.push(`day ${day?.day || '?'} start area is not concrete`);
  }
  if (!day?.endArea || hasPlaceholderText(day.endArea)) {
    issues.push(`day ${day?.day || '?'} end area is not concrete`);
  }
  if (!containsNumberOrFree(day.walkingEstimate)) {
    issues.push(`day ${day?.day || '?'} walking estimate needs a numeric distance/time`);
  }
  if (!day?.rainyDayAlternative || hasPlaceholderText(day.rainyDayAlternative)) {
    issues.push(`day ${day?.day || '?'} rainy alternative must name a real place`);
  }

  if (!Array.isArray(day.schedule) || day.schedule.length < 4) {
    issues.push(`day ${day?.day || '?'} needs at least 4 scheduled entries`);
  } else {
    day.schedule.forEach((item, index) => {
      const label = `day ${day.day} schedule ${index + 1}`;
      if (!item?.time || !/\d{1,2}:\d{2}/.test(String(item.time))) {
        issues.push(`${label} needs a clock time`);
      }
      if (!containsNumberOrFree(item?.duration)) issues.push(`${label} needs a realistic duration`);
      if (!item?.activity || String(item.activity).length < 8 ||
          hasPlaceholderText(item.activity)) issues.push(`${label} needs a concrete activity`);
      if (!item?.location || String(item.location).length < 4 ||
          hasPlaceholderText(item.location)) issues.push(`${label} needs a concrete venue or exact area`);
      if (!item?.details || String(item.details).length < 35 ||
          hasPlaceholderText(item.details)) issues.push(`${label} needs concrete practical details`);
      if (!containsNumberOrFree(item?.travelTime)) issues.push(`${label} needs numeric travel time`);
      if (!item?.transport || hasPlaceholderText(item.transport)) {
        issues.push(`${label} needs a concrete transport mode`);
      }
      if (!containsNumberOrFree(item?.estimatedCost)) {
        issues.push(`${label} needs a numeric/free estimated cost`);
      }
      if (item?.openingHours && hasPlaceholderText(item.openingHours)) {
        issues.push(`${label} has placeholder opening hours`);
      }
      if (item?.entryFee && !containsNumberOrFree(item.entryFee)) {
        issues.push(`${label} has non-numeric entry fee`);
      }
    });
  }

  if (!Array.isArray(day.meals) || day.meals.length < 2) {
    issues.push(`day ${day?.day || '?'} needs at least 2 named meals`);
  } else {
    day.meals.forEach((meal, index) => {
      const label = `day ${day.day} meal ${index + 1}`;
      if (!meal?.placeOrArea || hasPlaceholderText(meal.placeOrArea)) {
        issues.push(`${label} needs a named restaurant/cafe/food area`);
      }
      if (!meal?.suggestion || hasPlaceholderText(meal.suggestion)) {
        issues.push(`${label} needs concrete dishes or food plan`);
      }
      if (!containsNumberOrFree(meal?.estimatedCost)) {
        issues.push(`${label} needs numeric/free cost`);
      }
    });
  }

  const budget = day.dailyBudget || {};
  const subtotal = ['activities', 'food', 'localTransport']
    .reduce((sum, key) => sum + (Number(budget[key]) || 0), 0);
  const total = Number(budget.total) || 0;
  if (total <= 0) issues.push(`day ${day?.day || '?'} needs a positive daily budget total`);
  if (subtotal > 0 && total > 0 && Math.abs(subtotal - total) > Math.max(250, total * 0.2)) {
    issues.push(`day ${day?.day || '?'} daily budget total does not match category subtotal`);
  }
  return issues;
};

export const validateDayBatch = (section, start, end) => {
  const days = section?.dayWiseItinerary;
  if (!Array.isArray(days) || days.length !== end - start + 1) return false;
  const expected = new Set(Array.from({ length: end - start + 1 }, (_, index) => start + index));
  return days.every(day =>
    expected.delete(Number(day.day)) &&
    Array.isArray(day.schedule) && day.schedule.length >= 4 &&
    Array.isArray(day.meals) && day.meals.length >= 2
  ) && expected.size === 0;
};

export const getSectionQualityIssues = section =>
  (section?.dayWiseItinerary || []).flatMap(day => validateDayQuality(day));

export const validateStrategy = (strategy, totalDays) =>
  strategy && Array.isArray(strategy.dayThemes) &&
  strategy.dayThemes.length === totalDays &&
  new Set(strategy.dayThemes.map(item => Number(item.day))).size === totalDays &&
  Array.isArray(strategy.route);

export const validateLogistics = (logistics, totalDays) =>
  logistics?.budgetBreakdown &&
  Array.isArray(logistics.dailySpendingTargets) &&
  logistics.dailySpendingTargets.length === totalDays &&
  new Set(logistics.dailySpendingTargets.map(item => Number(item.day))).size === totalDays;

export const isLogisticsOverBudget = (logistics, trip) => {
  const available = Number(trip?.budget) || 0;
  if (available <= 0) return false;
  const breakdown = logistics?.budgetBreakdown || {};
  const estimated = [
    'transport', 'stay', 'food', 'activities', 'localTransport',
    'shoppingBuffer', 'emergencyBuffer',
  ].reduce((sum, key) => sum + (Number(breakdown[key]) || 0), 0);
  return estimated > available;
};

export const normalizeScore = score => {
  const keys = [
    'overall', 'budgetRealism', 'timeRealism', 'safety',
    'routeEfficiency', 'restBalance', 'foodQuality',
  ];
  return Object.fromEntries(keys.map(key => {
    const value = Number(score?.[key]);
    return [key, Number.isFinite(value) ? Math.min(10, Math.max(1, Math.round(value))) : 7];
  }));
};

export const fallbackCritique = () => ({
  criticNotes: ['Critic model unavailable; structural validation and deterministic budget checks were used.'],
  repairDays: [],
  tripScore: {
    overall: 7,
    budgetRealism: 7,
    timeRealism: 7,
    safety: 7,
    routeEfficiency: 7,
    restBalance: 7,
    foodQuality: 7,
  },
});

export const validatePlanQuality = (plan, expectedDays) => {
  const issues = [];
  if (!Array.isArray(plan?.dayWiseItinerary) ||
      plan.dayWiseItinerary.length !== expectedDays) {
    issues.push(`plan must contain exactly ${expectedDays} days`);
  }
  const placeholderPaths = collectPlaceholderPaths(plan).slice(0, 12);
  if (placeholderPaths.length) {
    const affectedStops = placeholderPaths.map(path => {
      const match = path.match(/dayWiseItinerary\[(\d+)\]\.schedule\[(\d+)\]/);
      return match ? `day ${Number(match[1]) + 1}, stop ${Number(match[2]) + 1}` : '';
    }).filter(Boolean);
    issues.push(affectedStops.length
      ? `generic wording remains in ${[...new Set(affectedStops)].join(' and ')}`
      : 'some supporting plan text still needs a more specific description');
  }

  const seenAttractions = new Map();
  const destinationKey = normalizeText(plan?.destinations?.[0] || '');
  for (const day of plan?.dayWiseItinerary || []) {
    issues.push(...validateDayQuality(day));
    for (const item of day.schedule || []) {
      if (isTransitOnly(item)) continue;
      const key = normalizeText(item.location || item.activity);
      if (key.length < 4 || key === destinationKey) continue;
      const previousDay = seenAttractions.get(key);
      if (previousDay && Number(previousDay) !== Number(day.day)) {
        issues.push(`duplicate attraction/location "${item.location || item.activity}" on days ${previousDay} and ${day.day}`);
      } else {
        seenAttractions.set(key, day.day);
      }
    }
  }

  const budget = plan?.budgetBreakdown || {};
  const totalEstimated = Number(budget.totalEstimated) || 0;
  const subtotal = [
    'transport', 'stay', 'food', 'activities', 'localTransport',
    'shoppingBuffer', 'emergencyBuffer',
  ].reduce((sum, key) => sum + (Number(budget[key]) || 0), 0);
  if (totalEstimated > 0 && subtotal > 0 &&
      Math.abs(totalEstimated - subtotal) > Math.max(1000, totalEstimated * 0.15)) {
    issues.push('trip budget totalEstimated does not match budget category subtotal');
  }
  return [...new Set(issues)];
};
