import test from 'node:test';
import assert from 'node:assert/strict';
import { runPlannerGraph } from '../src/agents/graph.js';

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
  });

  assert.equal(result.plan.dayWiseItinerary.length, 3);
  assert.equal(plannerSectionCalls, 3);
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
  assert.ok(reports.some(step => /retrying smaller sections/.test(step.message)));
});
