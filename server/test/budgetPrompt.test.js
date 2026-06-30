import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLogisticsPrompt } from '../src/prompts/plannerPrompt.js';

test('logistics prompt treats deterministic budget output as source of truth', () => {
  const trip = {
    title: 'Goa Value Trip',
    origin: 'Kolkata',
    destination: 'Goa',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-03'),
    travelers: 2,
    budget: 20000,
    budgetMode: 'hard-budget',
    currency: 'INR',
    travelStyle: 'balanced',
    planningMode: 'Hidden Gems',
  };
  const prompt = buildLogisticsPrompt(trip, null, {
    route: ['Panjim'],
    dayThemes: [1, 2, 3].map(day => ({ day, theme: `Theme ${day}` })),
  }, {
    budgetEstimate: {
      budgetBreakdown: {
        transport: 15000,
        stay: 12000,
        food: 6000,
        activities: 3000,
        localTransport: 2000,
        shoppingBuffer: 1000,
        emergencyBuffer: 3900,
        totalEstimated: 42900,
      },
      budgetSummary: { verdict: 'insufficient', shortfall: 22900 },
      budgetAssumptions: { pricesAreEstimated: true },
      warnings: ['The fixed budget is insufficient.'],
    },
  });

  assert.match(prompt, /DETERMINISTIC BUDGET ENGINE — SOURCE OF TRUTH/);
  assert.match(prompt, /Copy the deterministic budget categories exactly/);
  assert.match(prompt, /must not replace them/);
  assert.match(prompt, /"verdict":"insufficient"/);
});
