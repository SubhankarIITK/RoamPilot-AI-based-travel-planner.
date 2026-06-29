import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTripStrategyPrompt } from '../src/prompts/plannerPrompt.js';

test('planner prompt includes accessibility, hotel, transport, and lifestyle constraints', () => {
  const prompt = buildTripStrategyPrompt(
    {
      title: 'Accessible Kolkata',
      origin: 'Mumbai',
      destination: 'Kolkata',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-03'),
      travelers: 2,
      budget: 90000,
      currency: 'INR',
      travelStyle: 'relaxed',
      planningMode: 'Spiritual/Cultural',
      mustVisitPlaces: [],
      avoidList: [],
      notes: '',
    },
    {
      budgetType: 'mid-range',
      foodPreference: 'vegetarian',
      hotelPreference: 'step-free boutique hotel',
      preferredTransport: ['metro', 'taxi'],
      travelPace: 'relaxed',
      interests: ['history'],
      medicalConstraints: 'Peanut allergy',
      accessibilityNeeds: 'Avoid stairs',
      dislikedThings: ['nightclubs'],
      preferredClimate: 'cool',
      adventureLevel: 2,
      nightlifePreference: 'none',
      shoppingPreference: 'low',
      languageComfort: ['English'],
      travelExperienceLevel: 'beginner',
      family: { travelers: 2 },
    },
  );

  assert.match(prompt, /step-free boutique hotel/);
  assert.match(prompt, /Avoid stairs/);
  assert.match(prompt, /Peanut allergy/);
  assert.match(prompt, /preferredTransport/);
  assert.match(prompt, /nightlifePreference/);
});
