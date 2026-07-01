import test from 'node:test';
import assert from 'node:assert/strict';
import { runPlannerGraph } from '../src/agents/graph.js';
import { getAdaptiveBatchSize } from '../src/agents/stages/dayStage.js';
import criticStage from '../src/agents/stages/criticStage.js';
import repairStage from '../src/agents/stages/repairStage.js';

const createDay = (day, activity = `Detailed activity ${day}`) => ({
  day,
  date: `2026-07-0${day}`,
  theme: `Area ${day}`,
  summary: `A geographically efficient Panjim day ${day} with named stops, short walks, realistic meal breaks, and clear cost control.`,
  startArea: `Area ${day}`,
  endArea: `Area ${day}`,
  walkingEstimate: '4 km',
  advanceBookings: [],
  schedule: Array.from({ length: 5 }, (_, index) => ({
    time: `${String(9 + index * 2).padStart(2, '0')}:00`,
    duration: '1 hr',
    activity: index === 0 ? activity : `Fontainhas heritage stop ${day}.${index + 1}`,
    location: `Goa venue ${day}.${index + 1}`,
    details: 'Walk the named lane, photograph the chapel facade, and keep the stop bounded before the next nearby venue.',
    openingHours: '09:00-17:00',
    entryFee: 'INR 100',
    travelTime: '15 min',
    transport: 'Walk',
    routeDistance: '1.2 km',
    estimatedCost: 'INR 500',
    bookingRequired: false,
    bookingAdvice: '',
  })),
  meals: [
    { meal: 'Breakfast', time: '08:00', placeOrArea: `Cafe Bodega Goa ${day}`, suggestion: 'Poi, eggs, and strong coffee', estimatedCost: 'INR 300' },
    { meal: 'Lunch', time: '13:00', placeOrArea: `Ritz Classic Panjim ${day}`, suggestion: 'Goan fish thali or vegetarian xacuti plate', estimatedCost: 'INR 500' },
    { meal: 'Dinner', time: '19:30', placeOrArea: `Viva Panjim ${day}`, suggestion: 'Prawn curry rice or mushroom cafreal', estimatedCost: 'INR 700' },
  ],
  dailyBudget: { activities: 1000, food: 1500, localTransport: 500, total: 3000 },
  rainyDayAlternative: 'Specific museum in the same area.',
  localTip: 'Carry small cash.',
  paceNotes: 'Two seated breaks; finish by 20:30.',
});

test('planner graph splits incomplete batches and repairs only critic-selected days', async () => {
  const trip = {
    title: 'Goa',
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
  const reports = [];
  let jsonCalls = 0;
  const requestJson = async prompt => {
    jsonCalls += 1;
    if (prompt.includes('Planning Foundation agent')) {
      return {
        strategy: {
          tripTitle: 'Detailed Goa',
          summary: 'Specific route.',
          destinations: ['Goa'],
          route: ['Panjim'],
          dayThemes: [1, 2, 3].map(day => ({ day, theme: `Theme ${day}`, primaryArea: `Area ${day}` })),
          researchSources: [],
        },
        logistics: {
          budgetBreakdown: { totalEstimated: 76000 },
          dailySpendingTargets: [1, 2, 3].map(day => ({ day, target: 3000 })),
          transportStrategy: [],
          hotelSuggestions: [],
          foodPlan: [],
          packingList: [],
          safetyTips: [],
          weatherNotes: [],
          alternatives: [],
          warnings: [],
          emergencyCard: {},
        },
      };
    }
    if (prompt.includes('Itinerary Critic agent')) {
      return {
        tripScore: { overall: 8, budgetRealism: 8, timeRealism: 7, safety: 8, routeEfficiency: 7, restBalance: 8, foodQuality: 8 },
        criticNotes: ['Day 2 needs a more specific first stop.'],
        repairDays: [{ day: 2, severity: 'important', instruction: 'Replace the first stop with a specific venue.' }],
      };
    }
    if (prompt.includes('Itinerary Repair agent')) return createDay(2, 'Critic-repaired venue');
    throw new Error('Unexpected prompt');
  };
  let plannerSectionCalls = 0;
  const savedBatches = [];
  const requestPlannerSection = async prompt => {
    plannerSectionCalls += 1;
    const [, start, end] = prompt.match(/days (\d+) through (\d+)/);
    if (plannerSectionCalls === 1) {
      return { dayWiseItinerary: [createDay(Number(start))] };
    }
    const days = Array.from(
      { length: Number(end) - Number(start) + 1 },
      (_, index) => createDay(Number(start) + index),
    );
    if (Number(start) === 1) {
      days[0].schedule[1].details = 'Visit the venue';
      days[0].schedule[1].travelTime = 'short walk';
      days[0].schedule[1].transport = '';
      days[0].meals[1].restaurant = days[0].meals[1].placeOrArea;
      days[0].meals[1].placeOrArea = '';
      days[0].meals[2].placeOrArea = '';
      days[0].dailyBudget.total = 9999;
    }
    return {
      dayWiseItinerary: days,
    };
  };

  const result = await runPlannerGraph({
    trip,
    profile: null,
    memories: [],
    options: {
      totalDays: 3,
      instructions: '',
      planningAnswers: {},
      useWebSearch: false,
    },
    researchTrip: async () => {
      throw new Error('Research should remain disabled');
    },
    requestJson,
    requestPlannerSection,
    report: async step => reports.push(step),
    persistBatch: async batch => savedBatches.push(batch),
  });

  assert.equal(result.plan.dayWiseItinerary.length, 3);
  assert.equal(plannerSectionCalls, 4);
  assert.equal(jsonCalls, 3);
  assert.match(result.plan.dayWiseItinerary[0].schedule[1].details, /public entrance/);
  assert.match(result.plan.dayWiseItinerary[0].schedule[1].travelTime, /15 min/);
  assert.equal(result.plan.dayWiseItinerary[0].schedule[1].transport, 'Walk');
  assert.equal(result.plan.dayWiseItinerary[0].meals[1].placeOrArea, 'Ritz Classic Panjim 1');
  assert.equal(result.plan.dayWiseItinerary[0].meals[2].placeOrArea, 'Goa venue 1.5');
  assert.equal(result.plan.dayWiseItinerary[0].dailyBudget.total, 3000);
  assert.equal(result.plan.dayWiseItinerary[1].schedule[0].activity, 'Critic-repaired venue');
  assert.equal(result.plan.dayWiseItinerary[0].schedule[0].activity, 'Detailed activity 1');
  assert.ok(!result.plan.criticNotes.some(note => /day 2/i.test(note)));
  assert.ok(reports.some(step => step.agent === 'Trip Strategy Agent'));
  assert.ok(reports.some(step => step.agent === 'Budget & Logistics Agent'));
  assert.ok(reports.some(step => step.agent === 'Itinerary Critic Agent'));
  assert.ok(reports.some(step => step.agent === 'Itinerary Repair Agent'));
  assert.ok(reports.some(step => /retrying one day at a time/.test(step.message)));
  assert.equal(savedBatches.filter(batch => batch.status === 'completed').length, 3);
});

test('long-trip batch sizing becomes more conservative as duration grows', () => {
  assert.equal(getAdaptiveBatchSize(7), 3);
  assert.equal(getAdaptiveBatchSize(8), 2);
  assert.equal(getAdaptiveBatchSize(15), 2);
  assert.equal(getAdaptiveBatchSize(18), 1);
  assert.equal(getAdaptiveBatchSize(20), 1);
});

test('complete resume skips the repeated critic model call', async () => {
  let modelCalls = 0;
  const reports = [];
  const itinerary = [createDay(1), createDay(2)];
  const context = await criticStage({
    trip: {},
    totalDays: 2,
    itinerary,
    options: {
      resumeState: { partialItinerary: itinerary },
    },
    requestJson: async () => {
      modelCalls += 1;
      throw new Error('Complete resume must not call the general critic');
    },
    report: async step => reports.push(step),
  });

  assert.equal(modelCalls, 0);
  assert.ok(reports.some(step => /Skipped a repeated general critic model call/.test(step.detail)));
  assert.ok(Array.isArray(context.repairDays));
});

test('failed model repair falls back to factual route data and persists the transfer', async () => {
  const day3 = createDay(3);
  const day4 = createDay(4);
  day3.endArea = 'Pahalgam';
  day4.startArea = 'Kangan';
  day4.endArea = 'Kangan';
  day4.schedule[0].travelTime = '0 min (day starts here)';
  const savedBatches = [];
  const reports = [];
  const context = await repairStage({
    trip: { currency: 'INR' },
    itinerary: [day3, day4],
    repairDays: [{
      day: 4,
      instruction: 'Continue from Pahalgam and add the transfer to Kangan.',
    }],
    strategy: {},
    logistics: {},
    factualEvidence: null,
    requestJson: async () => {
      throw new Error('Model unavailable');
    },
    estimateInterAreaTransfer: async () => ({
      minutes: 150,
      distanceKm: 100,
      mode: 'Pre-booked car',
      source: 'OpenRouteService',
    }),
    persistBatch: async batch => savedBatches.push(batch),
    report: async step => reports.push(step),
  });

  assert.equal(context.itinerary[1].startArea, 'Pahalgam');
  assert.match(context.itinerary[1].schedule[0].activity, /Pahalgam to Kangan/);
  assert.equal(context.itinerary[1].schedule[0].travelTime, '150 min (OpenRouteService)');
  assert.ok(savedBatches.some(batch => batch.status === 'repaired'));
  assert.ok(reports.some(step => /route data/.test(step.message)));
});

test('planner graph resumes from saved days without regenerating the foundation', async () => {
  const trip = {
    title: 'Goa',
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
    tripTitle: 'Detailed Goa',
    summary: 'A compact saved route.',
    destinations: ['Goa'],
    route: ['Panjim'],
    dayThemes: [1, 2, 3].map(day => ({
      day,
      theme: `Theme ${day}`,
      primaryArea: `Area ${day}`,
    })),
    researchSources: [],
  };
  const logistics = {
    budgetBreakdown: {
      transport: 20000,
      stay: 20000,
      food: 10000,
      activities: 10000,
      localTransport: 5000,
      shoppingBuffer: 2500,
      emergencyBuffer: 6750,
      totalEstimated: 74250,
    },
    budgetSummary: { expectedSpend: 74250, verdict: 'comfortable', savings: 5750 },
    dailySpendingTargets: [1, 2, 3].map(day => ({ day, target: 3000 })),
    transportStrategy: [],
    hotelSuggestions: [],
    foodPlan: [],
    packingList: [],
    safetyTips: [],
    weatherNotes: [],
    alternatives: [],
    warnings: [],
    emergencyCard: {},
  };
  let sectionCalls = 0;
  let criticCalls = 0;
  const reports = [];
  const savedBatches = [];

  const result = await runPlannerGraph({
    trip,
    profile: null,
    memories: [],
    options: {
      totalDays: 3,
      instructions: '',
      planningAnswers: {},
      useWebSearch: true,
      resumeState: {
        foundation: {
          strategy,
          logistics,
          budgetEstimate: {
            budgetBreakdown: logistics.budgetBreakdown,
            budgetSummary: logistics.budgetSummary,
          },
          research: 'saved research',
          factualEvidence: null,
          webResearchUsed: true,
        },
        partialItinerary: [createDay(1)],
      },
    },
    researchTrip: async () => {
      throw new Error('Research must not repeat during resume');
    },
    requestJson: async prompt => {
      assert.match(prompt, /Itinerary Critic agent/);
      criticCalls += 1;
      return {
        tripScore: {
          overall: 8,
          budgetRealism: 8,
          timeRealism: 8,
          safety: 8,
          routeEfficiency: 8,
          restBalance: 8,
          foodQuality: 8,
        },
        criticNotes: [],
        repairDays: [],
      };
    },
    requestPlannerSection: async prompt => {
      sectionCalls += 1;
      const [, start, end] = prompt.match(/days (\d+) through (\d+)/);
      return {
        dayWiseItinerary: Array.from(
          { length: Number(end) - Number(start) + 1 },
          (_, index) => createDay(Number(start) + index),
        ),
      };
    },
    report: async step => reports.push(step),
    persistBatch: async batch => savedBatches.push(batch),
  });

  assert.equal(result.plan.dayWiseItinerary.length, 3);
  assert.equal(sectionCalls, 1);
  assert.equal(criticCalls, 1);
  assert.ok(reports.some(step => /Resuming after 1 saved day/.test(step.message)));
  assert.ok(savedBatches.some(batch =>
    batch.status === 'completed' && batch.startDay === 2 && batch.endDay === 3));
});
