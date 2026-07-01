import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCriticalPlanQualityIssues,
  getDeterministicRepairCandidates,
  repairSafeDayOmissions,
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

test('cross-day duplicate attractions request repair without blocking a complete plan', () => {
  const days = [1, 2].map(day => ({
    day,
    startArea: 'Fort',
    endArea: 'Fort',
    rainyDayAlternative: 'Dr. Bhau Daji Lad Museum indoor galleries for 90 minutes.',
    schedule: [{
      time: '10:00',
      duration: '1 hr',
      activity: 'Visit Gateway of India',
      location: 'Gateway of India',
      details: 'Use the waterfront entrance and allow time for the security queue before continuing.',
      travelTime: '15 min',
      transport: 'Walk',
      estimatedCost: 'INR 0',
    }],
    meals: [],
    dailyBudget: {},
  }));
  const repairs = getDeterministicRepairCandidates(days);
  const critical = getCriticalPlanQualityIssues({
    dayWiseItinerary: days,
    budgetBreakdown: validBudget,
    budgetSummary: { expectedSpend: 95000, verdict: 'comfortable' },
  }, 2);

  assert.equal(repairs[0].day, 2);
  assert.match(repairs[0].instruction, /Replace the repeated attraction/);
  assert.ok(!critical.some(issue => /duplicate attraction\/location/.test(issue)));
});

test('repeatable meal, hotel, and road stops are not treated as duplicate attractions', () => {
  const repeatedStops = [
    {
      activity: 'Lunch at Chandra Cafe',
      location: 'Railway Station Road, Curchorem',
    },
    {
      activity: 'Check-in to Chatrapati Hotel',
      location: 'Chatrapati Hotel',
    },
  ];
  const days = [1, 2].map(day => ({
    day,
    startArea: 'Curchorem',
    endArea: 'Curchorem',
    rainyDayAlternative: 'Braganza House indoor museum galleries for 90 minutes.',
    schedule: repeatedStops.map(item => ({
      ...item,
      time: '12:00',
      duration: '1 hr',
      details: 'Use the named entrance and keep this practical support stop within the planned hour.',
      travelTime: '10 min',
      transport: 'Walk',
      estimatedCost: 'INR 500',
    })),
    meals: [],
    dailyBudget: {},
  }));

  const issues = validatePlanQuality({
    destinations: ['Goa'],
    route: ['Curchorem'],
    dayWiseItinerary: days,
  }, 2);
  const repairs = getDeterministicRepairCandidates(days);

  assert.ok(!issues.some(issue => /duplicate attraction\/location/.test(issue)));
  assert.ok(!repairs.some(repair => /repeated attraction/.test(repair.instruction)));
});

test('multiple deterministic issues on one day are merged into one repair instruction', () => {
  const day1 = {
    day: 1,
    startArea: 'Panjim',
    endArea: 'Panjim',
    rainyDayAlternative: 'Goa State Museum indoor galleries for 90 minutes.',
    schedule: [{
      activity: 'Visit Aguada Fort',
      location: 'Aguada Fort',
      travelTime: '15 min',
    }],
  };
  const day2 = {
    day: 2,
    startArea: 'Calangute',
    endArea: 'Calangute',
    rainyDayAlternative: 'Museum of Goa indoor galleries for 90 minutes.',
    schedule: [{
      activity: 'Visit Aguada Fort',
      location: 'Aguada Fort',
      travelTime: '0 min',
    }],
  };

  const repairs = getDeterministicRepairCandidates([day1, day2]);
  const day2Repair = repairs.find(repair => repair.day === 2);
  assert.match(day2Repair.instruction, /continue from Panjim/i);
  assert.match(day2Repair.instruction, /repeated attraction/i);
});

test('equivalent centre and center spellings do not create a false transfer failure', () => {
  const days = [1, 2].map(day => ({
    day,
    theme: `Oslo day ${day}`,
    summary: 'A practical Oslo day with named stops, realistic timing, meal breaks, and a bounded walking route.',
    startArea: day === 1 ? 'Oslo City Centre' : 'Oslo city center',
    endArea: 'Oslo City Centre',
    walkingEstimate: '3 km',
    rainyDayAlternative: 'Oslo City Museum indoor galleries for 90 minutes.',
    schedule: [{
      time: '09:00',
      duration: '1 hr',
      activity: 'Explore Oslo City Museum',
      location: 'Oslo City Museum',
      details: 'Enter through the main museum entrance and follow the permanent city-history galleries.',
      travelTime: '0 min',
      transport: 'Begin at this location',
      estimatedCost: 'NOK 180',
    }],
    meals: [],
    dailyBudget: {},
  }));

  const issues = validatePlanQuality({ destinations: ['Oslo'], route: ['Oslo'], dayWiseItinerary: days }, 2);
  assert.ok(!issues.some(issue => /transition changes area/i.test(issue)));
});

test('rainy alternatives use API-verified indoor places and otherwise request repair', () => {
  const day = {
    day: 1,
    startArea: 'Oslo',
    endArea: 'Oslo',
    schedule: [{
      activity: 'Explore Frogner Park',
      location: 'Frogner Park',
    }],
    walkingEstimate: '2 km',
    rainyDayAlternative: 'Visit a nearby attraction',
  };
  repairSafeDayOmissions(day, {}, {
    places: [{
      name: 'Oslo City Museum',
      type: 'museum',
      address: 'Frognerveien 67, Oslo',
      placeId: 'museum-1',
    }],
  });

  assert.match(day.rainyDayAlternative, /Oslo City Museum/);
  assert.equal(day.rainyAlternativeFactualStatus, 'api-verified-place');
  assert.ok(!getDeterministicRepairCandidates([day])
    .some(repair => /rainy-day alternative/i.test(repair.instruction)));

  const unresolved = {
    day: 2,
    schedule: [{
      activity: 'Explore Bryggen',
      location: 'Bryggen',
    }],
    rainyDayAlternative: 'Visit a nearby attraction',
  };
  assert.ok(getDeterministicRepairCandidates([unresolved])
    .some(repair => /rainy-day alternative/i.test(repair.instruction)));

  const transitOnly = {
    day: 3,
    schedule: [
      { activity: 'Travel to Oslo Airport', location: 'Oslo Airport' },
      { activity: 'Check-in for flight', location: 'Oslo Airport' },
    ],
    rainyDayAlternative: '',
  };
  assert.ok(!getDeterministicRepairCandidates([transitOnly])
    .some(repair => /rainy-day alternative/i.test(repair.instruction)));
});
