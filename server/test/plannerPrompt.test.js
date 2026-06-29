import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCriticPrompt,
  buildLogisticsPrompt,
  buildPlannerPrompt,
  buildTripStrategyPrompt,
} from '../src/prompts/plannerPrompt.js';

test('planner prompt requests the exact inclusive trip duration and detailed schedule', () => {
  const prompt = buildPlannerPrompt({
    title: 'Goa Vacation',
    origin: 'Kolkata',
    destination: 'Goa',
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-07-13'),
    travelers: 2,
    budget: 80000,
    currency: 'INR',
    travelStyle: 'balanced',
    planningMode: 'Hidden Gems',
    mustVisitPlaces: [],
    avoidList: [],
    notes: '',
  }, null);

  assert.match(prompt, /Duration: 13 days/);
  assert.match(prompt, /Include exactly 13 objects in dayWiseItinerary/);
  assert.match(prompt, /5-7 chronological schedule entries/);
  assert.match(prompt, /bookingRequired/);
  assert.match(prompt, /rainyDayAlternative/);
});

test('specialist prompts divide strategy, logistics, and critic responsibilities', () => {
  const trip = {
    title: 'Detailed Goa',
    origin: 'Kolkata',
    destination: 'Goa',
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-07-03'),
    travelers: 2,
    budget: 80000,
    currency: 'INR',
    travelStyle: 'balanced',
    planningMode: 'Hidden Gems',
    mustVisitPlaces: [],
    avoidList: [],
    notes: '',
  };
  const strategy = {
    route: ['Panjim'],
    dayThemes: [1, 2, 3].map(day => ({ day, theme: `Theme ${day}` })),
  };
  const logistics = {
    budgetBreakdown: { totalEstimated: 75000 },
    dailySpendingTargets: [1, 2, 3].map(day => ({ day, target: 5000 })),
  };
  const itinerary = [1, 2, 3].map(day => ({
    day,
    theme: `Theme ${day}`,
    schedule: [{ time: '09:00', activity: 'Specific place', location: 'Panjim' }],
    meals: [],
  }));

  assert.match(buildTripStrategyPrompt(trip, null), /exactly 3 dayThemes/);
  assert.match(buildLogisticsPrompt(trip, null, strategy), /exactly 3 dailySpendingTargets/);
  assert.match(buildCriticPrompt(trip, strategy, logistics, itinerary), /Return at most 3 repairDays/);
});

test('planner prompt includes custom instructions and live research safely', () => {
  const prompt = buildPlannerPrompt(
    {
      title: 'Goa Vacation',
      origin: 'Kolkata',
      destination: 'Goa',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-03'),
      travelers: 2,
      budget: 80000,
      currency: 'INR',
      travelStyle: 'balanced',
      planningMode: 'Hidden Gems',
      mustVisitPlaces: [],
      avoidList: [],
      notes: '',
    },
    null,
    [],
    {
      instructions: 'Make every day detailed and minimize walking.',
      liveResearch: 'A museum is closed on Mondays. https://example.com/museum',
      planningAnswers: { daily_pace: 'Relaxed', food_style: 'Local and authentic' },
    },
  );

  assert.match(prompt, /Make every day detailed and minimize walking/);
  assert.match(prompt, /A museum is closed on Mondays/);
  assert.match(prompt, /untrusted reference data/);
  assert.match(prompt, /researchSources/);
  assert.match(prompt, /daily_pace/);
  assert.match(prompt, /Local and authentic/);
});

test('planner prompt can request one bounded itinerary batch', () => {
  const prompt = buildPlannerPrompt(
    {
      title: 'Amazon Forest',
      origin: 'Kolkata',
      destination: 'Amazon Forest',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-13'),
      travelers: 2,
      budget: 180000,
      currency: 'INR',
      travelStyle: 'balanced',
      planningMode: 'Adventure',
      mustVisitPlaces: [],
      avoidList: [],
      notes: '',
    },
    null,
    [],
    {
      dayRange: { start: 4, end: 6 },
      planOverview: { route: ['Manaus', 'Amazon lodge'] },
    },
  );

  assert.match(prompt, /ONLY itinerary days 4 through 6/);
  assert.match(prompt, /exactly 3 day objects numbered 4 through 6/);
  assert.match(prompt, /Manaus → Amazon lodge/);
});
