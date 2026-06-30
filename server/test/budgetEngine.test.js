import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateTripBudget,
  normalizeBudgetPlan,
} from '../src/services/budgetEngine.js';

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
  assert.equal(logistics.budgetSummary.budgetClass, 'realistic');
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
  assert.equal(logistics.budgetSummary.status, 'insufficient');
  assert.equal(logistics.budgetSummary.budgetClass, 'insufficient');
  assert.equal(logistics.budgetSummary.savings, 0);
  assert.match(logistics.warnings[0], /realistic minimum is approximately INR 100000/);
});

test('budget engine classifies unrealistic surplus and bases emergency buffer on expected spend', () => {
  const logistics = normalizeBudgetPlan({
    budgetBreakdown: {
      transport: 20000,
      stay: 40000,
      food: 15000,
      activities: 10000,
      localTransport: 5000,
      shoppingBuffer: 5000,
      emergencyBuffer: 5000,
    },
  }, {
    budget: 1000000,
    currency: 'INR',
  });

  assert.equal(logistics.budgetSummary.expectedSpend, 100000);
  assert.equal(logistics.budgetSummary.budgetClass, 'unrealistic');
  assert.equal(logistics.budgetSummary.recommendedEmergencyBuffer, 10000);
  assert.ok(logistics.budgetSummary.savings > 800000);
});

test('AI-managed budget estimates every category without requiring a user amount', () => {
  const estimate = estimateTripBudget({
    origin: 'Kolkata',
    destination: 'Goa',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    travelers: 2,
    budget: 0,
    budgetMode: 'ai-managed',
    currency: 'INR',
  }, {
    comfort_level: 'Balanced',
    transport_mode: 'Flight',
  });

  assert.equal(estimate.budgetSummary.budgetMode, 'ai-managed');
  assert.equal(estimate.budgetSummary.verdict, 'comfortable');
  for (const key of [
    'transport', 'stay', 'food', 'activities', 'localTransport',
    'shoppingBuffer', 'emergencyBuffer',
  ]) {
    assert.ok(estimate.budgetBreakdown[key] > 0);
  }
  const subtotal = [
    'transport', 'stay', 'food', 'activities', 'localTransport',
    'shoppingBuffer', 'emergencyBuffer',
  ].reduce((sum, key) => sum + estimate.budgetBreakdown[key], 0);
  assert.equal(estimate.budgetBreakdown.totalEstimated, subtotal);
});

test('comfort modes increase estimates without consuming a user ceiling', () => {
  const trip = {
    origin: 'Kolkata',
    destination: 'Goa',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    travelers: 2,
    budget: 0,
    currency: 'INR',
  };
  const balanced = estimateTripBudget({ ...trip, budgetMode: 'balanced' });
  const premium = estimateTripBudget({ ...trip, budgetMode: 'premium' });
  const luxury = estimateTripBudget({ ...trip, budgetMode: 'luxury' });

  assert.ok(premium.budgetSummary.expectedSpend > balanced.budgetSummary.expectedSpend);
  assert.ok(luxury.budgetSummary.expectedSpend > premium.budgetSummary.expectedSpend);
});

test('hard budget is classified against the independent realistic estimate', () => {
  const estimate = estimateTripBudget({
    origin: 'Kolkata',
    destination: 'Switzerland',
    startDate: '2026-12-20',
    endDate: '2026-12-27',
    travelers: 4,
    budget: 50000,
    budgetMode: 'hard-budget',
    currency: 'INR',
  }, { comfort_level: 'Balanced' });

  assert.equal(estimate.budgetSummary.verdict, 'insufficient');
  assert.ok(estimate.budgetSummary.realisticMinimum > 50000);
  assert.equal(estimate.budgetSummary.savings, 0);
});

test('budget engine uses a complete Amadeus traveler quote when available', () => {
  const estimate = estimateTripBudget({
    origin: 'Kolkata',
    destination: 'Mumbai',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    travelers: 2,
    budget: 0,
    budgetMode: 'balanced',
    currency: 'INR',
  }, {
    factualEvidence: {
      flights: {
        offers: [{ totalPrice: 30000, currency: 'INR' }],
      },
    },
  });

  assert.equal(estimate.budgetBreakdown.transport, 32400);
  assert.match(estimate.budgetAssumptions.transportSource, /Amadeus/);
});
