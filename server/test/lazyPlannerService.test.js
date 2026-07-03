import test from 'node:test';
import assert from 'node:assert/strict';
import { runPlannerGraph } from '../src/agents/graph.js';
import {
  buildDaySkeletons,
  buildLazyPlanShell,
  createLazyInputSignature,
  getLazyPlanStatus,
} from '../src/services/lazyPlannerService.js';

const trip = {
  title: 'Kyoto week',
  origin: 'Kolkata',
  destination: 'Kyoto',
  startDate: new Date('2026-10-01'),
  endDate: new Date('2026-10-03'),
  travelers: 2,
  budget: 0,
  budgetMode: 'ai-managed',
  currency: 'INR',
  travelStyle: 'balanced',
  planningMode: 'AI decides',
  mustVisitPlaces: ['Fushimi Inari Taisha'],
  avoidList: ['nightclubs'],
  notes: '',
};

const foundation = {
  strategy: {
    tripTitle: 'Kyoto temples and neighborhoods',
    summary: 'A stable route foundation.',
    destinations: ['Kyoto'],
    route: ['Central Kyoto', 'Higashiyama'],
    dayThemes: [
      {
        day: 1,
        date: '2026-10-01',
        theme: 'Arrival and central Kyoto',
        primaryArea: 'Central Kyoto',
        mustAccomplish: ['Kyoto Station orientation'],
        reason: 'Keep arrival day geographically compact.',
      },
      {
        day: 2,
        date: '2026-10-02',
        theme: 'Fushimi Inari Taisha and southern Kyoto',
        primaryArea: 'Fushimi',
        mustAccomplish: ['Fushimi Inari Taisha'],
        reason: 'Reserve the shrine for an early start.',
      },
      {
        day: 3,
        date: '2026-10-03',
        theme: 'Higashiyama and departure',
        primaryArea: 'Higashiyama',
        mustAccomplish: ['Kiyomizu-dera'],
        reason: 'Finish near the final sightseeing cluster.',
      },
    ],
  },
  logistics: {
    budgetBreakdown: {
      transport: 30000,
      stay: 24000,
      food: 12000,
      activities: 6000,
      localTransport: 5000,
      shoppingBuffer: 3000,
      emergencyBuffer: 8000,
      totalEstimated: 88000,
    },
    budgetSummary: { verdict: 'comfortable', expectedSpend: 88000 },
    dailySpendingTargets: [
      { day: 1, target: 5000, reason: 'Arrival day' },
      { day: 2, target: 8000, reason: 'Full day' },
      { day: 3, target: 6000, reason: 'Departure day' },
    ],
    transportStrategy: [],
    hotelSuggestions: [],
  },
};

test('foundation creates lightweight pending skeletons without itinerary detail', () => {
  const skeletons = buildDaySkeletons(trip, foundation);
  assert.equal(skeletons.length, 3);
  assert.equal(skeletons[0].budgetEnvelope, 5000);
  assert.equal(skeletons[1].cityZone, 'Fushimi');
  assert.deepEqual(skeletons[1].reservedMustVisitPlaces, ['Fushimi Inari Taisha']);
  assert.equal(skeletons[1].status, 'pending_detail_generation');
  assert.equal('schedule' in skeletons[1], false);
  assert.match(skeletons[1].previousDayContinuity, /Central Kyoto/);
  assert.match(skeletons[1].nextDayContinuity, /Higashiyama/);
});

test('lazy status distinguishes untouched, partial, repair, and finalizable plans', () => {
  const days = [1, 2, 3].map(day => ({ day, status: 'pending' }));
  assert.equal(getLazyPlanStatus(days), 'foundation_ready');
  days[0].status = 'completed';
  assert.equal(getLazyPlanStatus(days), 'partially_generated');
  days[1].status = 'completed';
  days[2].status = 'needs_repair';
  assert.equal(getLazyPlanStatus(days), 'repair_required');
  days[2].status = 'completed';
  assert.equal(getLazyPlanStatus(days), 'ready_to_finalize');
});

test('trip shell exposes only generated details and preserves final output field name', () => {
  const lazyPlan = {
    foundation,
    architectureVersion: 1,
    promptVersion: 'lazy-foundation-v1',
    status: 'partially_generated',
    validationIssues: [],
    finalizedPlan: null,
    days: [
      { day: 1, status: 'completed', detail: { day: 1, theme: 'Arrival', schedule: [], meals: [] } },
      { day: 2, status: 'pending', detail: null },
      { day: 3, status: 'pending', detail: null },
    ],
  };
  const shell = buildLazyPlanShell({ trip: { ...trip, aiPlan: null }, lazyPlan });
  assert.equal(shell.dayWiseItinerary.length, 1);
  assert.equal(shell.dayWiseItinerary[0].day, 1);
  assert.equal(shell.generationContext.lazyGeneration, true);
  assert.equal(shell.generationContext.completedDays, 1);
  assert.equal(shell.generationContext.totalDays, 3);
});

test('foundation signature is stable and changes with planning inputs', () => {
  const base = createLazyInputSignature({
    trip,
    instructions: 'Prefer early starts',
    planningAnswers: { pace: 'balanced' },
    useWebSearch: true,
  });
  const same = createLazyInputSignature({
    trip,
    instructions: 'Prefer early starts',
    planningAnswers: { pace: 'balanced' },
    useWebSearch: true,
  });
  const changed = createLazyInputSignature({
    trip,
    instructions: 'Prefer late starts',
    planningAnswers: { pace: 'balanced' },
    useWebSearch: true,
  });
  assert.equal(base, same);
  assert.notEqual(base, changed);
});

test('foundation-only graph exits before any day model call', async () => {
  let dayCalls = 0;
  const result = await runPlannerGraph({
    trip,
    profile: null,
    memories: [],
    options: {
      totalDays: 3,
      instructions: '',
      planningAnswers: {},
      useWebSearch: false,
      foundationOnly: true,
      resumeState: {},
    },
    researchTrip: async () => {
      throw new Error('Research is disabled');
    },
    requestJson: async prompt => {
      assert.match(prompt, /Planning Foundation agent/);
      return foundation;
    },
    requestPlannerSection: async () => {
      dayCalls += 1;
      throw new Error('Day generation must remain lazy');
    },
    report: async () => {},
    persistFoundation: async () => {},
    persistBatch: async () => {},
  });
  assert.equal(dayCalls, 0);
  assert.equal(result.foundation.strategy.dayThemes.length, 3);
  assert.equal(result.foundation.logistics.dailySpendingTargets.length, 3);
});
