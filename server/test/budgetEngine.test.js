import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBudgetPlan } from '../src/services/budgetEngine.js';

test('budget engine reconciles arithmetic and preserves unspent budget', () => {
  const logistics = normalizeBudgetPlan({
    budgetBreakdown: {
      transport: 20000,
      stay: 50000,
      food: 20000,
      activities: 10000,
      localTransport: 5000,
      shoppingBuffer: 5000,
      emergencyBuffer: 10000,
      totalEstimated: 220000,
    },
    warnings: [],
  }, {
    budget: 150000,
    currency: 'INR',
  });

  assert.equal(logistics.budgetBreakdown.totalEstimated, 120000);
  assert.equal(logistics.budgetSummary.expectedSpend, 120000);
  assert.equal(logistics.budgetSummary.savings, 30000);
  assert.equal(logistics.budgetSummary.status, 'comfortable');
  assert.equal(logistics.budgetSummary.recommendedEmergencyBuffer, 12000);
  assert.ok(logistics.budgetSummary.optionalUpgradeBudget < 30000);
});

test('budget engine never labels an over-budget plan as comfortable', () => {
  const logistics = normalizeBudgetPlan({
    budgetBreakdown: {
      transport: 20000,
      stay: 30000,
      food: 20000,
      activities: 15000,
      localTransport: 10000,
      shoppingBuffer: 0,
      emergencyBuffer: 5000,
    },
    warnings: [],
  }, {
    budget: 90000,
    currency: 'INR',
  });

  assert.equal(logistics.budgetSummary.expectedSpend, 100000);
  assert.equal(logistics.budgetSummary.shortfall, 10000);
  assert.equal(logistics.budgetSummary.status, 'over-budget');
  assert.match(logistics.warnings[0], /exceeds the stated budget by 10000 INR/);
});
