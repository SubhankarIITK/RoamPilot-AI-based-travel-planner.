const BUDGET_KEYS = [
  'transport',
  'stay',
  'food',
  'activities',
  'localTransport',
  'shoppingBuffer',
  'emergencyBuffer',
];

const money = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
};

export const normalizeBudgetPlan = (logistics, trip) => {
  const next = logistics && typeof logistics === 'object' ? logistics : {};
  const source = next.budgetBreakdown && typeof next.budgetBreakdown === 'object'
    ? next.budgetBreakdown
    : {};
  const budgetBreakdown = Object.fromEntries(
    BUDGET_KEYS.map(key => [key, money(source[key])]),
  );
  const componentTotal = BUDGET_KEYS
    .map(key => budgetBreakdown[key])
    .reduce((total, value) => total + value, 0);
  budgetBreakdown.totalEstimated = componentTotal > 0
    ? componentTotal
    : money(source.totalEstimated);

  const availableBudget = money(trip?.budget);
  const expectedSpend = budgetBreakdown.totalEstimated;
  const savings = Math.max(0, availableBudget - expectedSpend);
  const shortfall = Math.max(0, expectedSpend - availableBudget);
  const coverageRatio = expectedSpend > 0 ? availableBudget / expectedSpend : 0;
  const budgetClass = expectedSpend <= 0
    ? 'unknown'
    : availableBudget > 0 && expectedSpend > availableBudget
      ? 'insufficient'
      : coverageRatio <= 1.25
        ? 'realistic'
        : coverageRatio <= 1.75
          ? 'generous'
          : coverageRatio <= 3
            ? 'luxury'
            : 'unrealistic';
  const status = budgetClass === 'insufficient'
    ? 'over-budget'
    : budgetClass === 'realistic'
      ? 'comfortable'
      : budgetClass;
  const recommendedEmergencyBuffer = expectedSpend > 0
    ? Math.round(expectedSpend * 0.1)
    : 0;

  next.budgetBreakdown = budgetBreakdown;
  next.budgetSummary = {
    availableBudget,
    expectedSpend,
    savings,
    shortfall,
    status,
    budgetClass,
    emergencyBuffer: budgetBreakdown.emergencyBuffer,
    shoppingBuffer: budgetBreakdown.shoppingBuffer,
    recommendedEmergencyBuffer,
    optionalUpgradeBudget: Math.max(
      0,
      savings - Math.max(0, recommendedEmergencyBuffer - budgetBreakdown.emergencyBuffer),
    ),
  };

  const warnings = Array.isArray(next.warnings) ? [...next.warnings] : [];
  if (availableBudget > 0 && expectedSpend > availableBudget) {
    warnings.push(
      `Expected spend exceeds the stated budget by ${expectedSpend - availableBudget} ${trip.currency || 'currency units'}.`,
    );
  }
  if (
    recommendedEmergencyBuffer > 0 &&
    budgetBreakdown.emergencyBuffer < recommendedEmergencyBuffer
  ) {
    warnings.push(
      `Emergency buffer is below the recommended ${recommendedEmergencyBuffer} ${trip.currency || 'currency units'}; preserve part of the savings before optional upgrades.`,
    );
  }
  next.warnings = [...new Set(warnings)].slice(0, 12);
  return next;
};
