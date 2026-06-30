import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCriticalPlanQualityIssues,
  validatePlanQuality,
} from '../src/agents/stages/stageSupport.js';

const validBudget = {
  transport: 20000,
  stay: 30000,
  food: 15000,
  activities: 10000,
  localTransport: 5000,
  shoppingBuffer: 5000,
  emergencyBuffer: 10000,
  totalEstimated: 95000,
};

test('final validation requires exact budget arithmetic', () => {
  const issues = validatePlanQuality({
    dayWiseItinerary: [],
    budgetBreakdown: { ...validBudget, totalEstimated: 100000 },
    budgetSummary: { expectedSpend: 100000, verdict: 'comfortable' },
  }, 0);

  assert.ok(issues.includes('trip budget totalEstimated does not match budget category subtotal'));
});

test('final validation requires insufficient verdict and zero savings above a hard budget', () => {
  const issues = validatePlanQuality({
    dayWiseItinerary: [],
    budgetBreakdown: validBudget,
    budgetSummary: {
      expectedSpend: 95000,
      verdict: 'comfortable',
      savings: 5000,
    },
  }, 0, {
    budget: 90000,
    budgetMode: 'hard-budget',
  });

  assert.ok(issues.includes('hard budget is insufficient but budget verdict does not report it'));
  assert.ok(issues.includes('savings retained must be zero when the hard budget is insufficient'));
});

test('unconfirmed crore-level categories are critical quality failures', () => {
  const breakdown = {
    ...validBudget,
    stay: 10000000,
  };
  breakdown.totalEstimated = Object.entries(breakdown)
    .filter(([key]) => key !== 'totalEstimated')
    .reduce((sum, [, value]) => sum + value, 0);
  const issues = getCriticalPlanQualityIssues({
    dayWiseItinerary: [],
    budgetBreakdown: breakdown,
    budgetSummary: {
      expectedSpend: breakdown.totalEstimated,
      verdict: 'luxury',
      savings: 0,
    },
  }, 0);

  assert.ok(issues.some(issue => /crore-level/.test(issue)));
});
